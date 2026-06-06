import { prisma } from '../../config/database';
import { callSummaryRepository } from '../../repositories/call-summary.repository';
import { summaryGeneratorService } from '../../integrations/openai/summary-generator.service';
import { TranscriptEntry } from '../../integrations/openai/realtime.types';
import { logger } from '../../utils/logger';

const inFlight = new Set<string>();

export class CallSummaryService {
  async generateIfReady(callId: string): Promise<void> {
    if (inFlight.has(callId)) {
      return;
    }

    inFlight.add(callId);

    try {
      const existing = await callSummaryRepository.findByCallId(callId);

      if (existing) {
        return;
      }

      const call = await prisma.call.findUnique({
        where: { id: callId },
        include: { transcript: true },
      });

      if (!call?.transcript?.content) {
        return;
      }

      const entries = call.transcript.content as unknown as TranscriptEntry[];

      if (!Array.isArray(entries) || entries.length === 0) {
        return;
      }

      const generated = await summaryGeneratorService.generate(entries);

      await callSummaryRepository.upsert(callId, generated);

      await prisma.call.update({
        where: { id: callId },
        data: { sentiment: generated.sentiment },
      });

      logger.info('Call summary generated', {
        callId,
        intent: generated.intent,
        sentiment: generated.sentiment,
      });
    } catch (error) {
      logger.error('Failed to generate call summary', {
        callId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlight.delete(callId);
    }
  }

  async generateByCallSid(callSid: string): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { callSid },
      select: { id: true },
    });

    if (!call) {
      return;
    }

    await this.generateIfReady(call.id);
  }
}

export const callSummaryService = new CallSummaryService();
