import { CallSessionData } from '../../integrations/twilio/twilio.types';

export interface MediaStreamSessionHandle {
  callSid: string;
  streamSid: string;
  callerNumber: string;
  callId: string;
  sendAudio(payload: string): void;
  sendMark(name: string): void;
  clearAudio(): void;
  sendTranscript?(role: string, text: string): void;
  sendStatus?(status: string): void;
}

export interface AudioBridge {
  onSessionStart(session: MediaStreamSessionHandle, context: CallSessionData): Promise<void>;
  onCallerAudio(session: MediaStreamSessionHandle, payload: string): void;
  onSessionEnd(session: MediaStreamSessionHandle): Promise<void>;
}

export class NoOpAudioBridge implements AudioBridge {
  async onSessionStart(_session: MediaStreamSessionHandle, _context: CallSessionData): Promise<void> {
    // Phase 3 will replace this with OpenAI Realtime integration
  }

  onCallerAudio(_session: MediaStreamSessionHandle, _payload: string): void {
    // Audio received from caller — forwarded to OpenAI in Phase 3
  }

  async onSessionEnd(_session: MediaStreamSessionHandle): Promise<void> {
    // Cleanup handled in Phase 3
  }
}
