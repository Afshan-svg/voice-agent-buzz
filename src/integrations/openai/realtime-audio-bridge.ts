import {
  AudioBridge,
  MediaStreamSessionHandle,
} from '../../modules/calls/audio-bridge';
import { CallSessionData } from '../twilio/twilio.types';
import { logger } from '../../utils/logger';
import { realtimeVoiceService } from './realtime-voice.service';

export class RealtimeAudioBridge implements AudioBridge {
  async onSessionStart(
    session: MediaStreamSessionHandle,
    context: CallSessionData
  ): Promise<void> {
    await realtimeVoiceService.startSession(session, context);
  }

  onCallerAudio(session: MediaStreamSessionHandle, payload: string): void {
    realtimeVoiceService.appendCallerAudio(session.callSid, payload);
  }

  async onSessionEnd(session: MediaStreamSessionHandle): Promise<void> {
    await realtimeVoiceService.endSession(session.callSid);
  }
}

export function createAudioBridge(): AudioBridge {
  return new RealtimeAudioBridge();
}

export function logAudioBridgeFallback(reason: string): void {
  logger.warn(`Using NoOpAudioBridge: ${reason}`);
}
