import { CallStatus } from '@prisma/client';
import { getRedis, RedisKeys } from '../../config/redis';
import { CallSessionData } from '../../integrations/twilio/twilio.types';
import { callRepository } from '../../repositories/call.repository';
import { logger } from '../../utils/logger';
import { callSummaryService } from './call-summary.service';

const SESSION_TTL_SECONDS = 7200;

export class CallService {
  async handleIncomingCall(
    callSid: string,
    callerNumber: string,
    channel: 'PHONE' | 'WEB' = 'PHONE'
  ): Promise<{ callId: string }> {
    const existing = await callRepository.findByCallSid(callSid);

    if (existing) {
      logger.info('Reusing existing call record for incoming webhook', { callSid });
      return { callId: existing.id };
    }

    const call = await callRepository.create({ callSid, callerNumber, channel });

    logger.info('Created call record', {
      callId: call.id,
      callSid,
      callerNumber,
    });

    return { callId: call.id };
  }

  async saveSession(session: CallSessionData): Promise<void> {
    const redis = getRedis();
    await redis.setex(
      RedisKeys.activeCall(session.callSid),
      SESSION_TTL_SECONDS,
      JSON.stringify(session)
    );
  }

  async getSession(callSid: string): Promise<CallSessionData | null> {
    const redis = getRedis();
    const raw = await redis.get(RedisKeys.activeCall(callSid));

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CallSessionData;
  }

  async updateSession(callSid: string, updates: Partial<CallSessionData>): Promise<void> {
    const session = await this.getSession(callSid);

    if (!session) {
      return;
    }

    const updated = { ...session, ...updates };
    await this.saveSession(updated);
  }

  async removeSession(callSid: string): Promise<void> {
    const redis = getRedis();
    await redis.del(RedisKeys.activeCall(callSid));
    await redis.del(RedisKeys.callContext(callSid));
    await redis.del(RedisKeys.bookingDraft(callSid));
  }

  async handleStatusUpdate(
    callSid: string,
    callStatus: string,
    callDuration?: string
  ): Promise<void> {
    const terminalStatuses = ['completed', 'busy', 'failed', 'no-answer', 'canceled'];

    if (!terminalStatuses.includes(callStatus)) {
      return;
    }

    const call = await callRepository.findByCallSid(callSid);

    if (!call) {
      logger.warn('Status callback for unknown call', { callSid, callStatus });
      return;
    }

    if (call.status !== CallStatus.ACTIVE) {
      return;
    }

    const statusMap: Record<string, CallStatus> = {
      completed: CallStatus.COMPLETED,
      busy: CallStatus.FAILED,
      failed: CallStatus.FAILED,
      'no-answer': CallStatus.FAILED,
      canceled: CallStatus.FAILED,
    };

    const duration = callDuration ? parseInt(callDuration, 10) : undefined;
    const endTime = new Date();

    await callRepository.updateByCallSid(callSid, {
      status: statusMap[callStatus] ?? CallStatus.COMPLETED,
      endTime,
      duration: duration ?? Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000),
    });

    await this.removeSession(callSid);

    void callSummaryService.generateByCallSid(callSid);

    logger.info('Call status updated', { callSid, callStatus, duration });
  }

  async markStreamEnded(callSid: string): Promise<void> {
    await this.updateSession(callSid, { status: 'ended' });
  }
}

export const callService = new CallService();
