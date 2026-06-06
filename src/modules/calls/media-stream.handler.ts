import WebSocket from 'ws';
import {
  AudioBridge,
  MediaStreamSessionHandle,
  NoOpAudioBridge,
} from './audio-bridge';
import { callService } from './call.service';
import {
  CallSessionData,
  OutboundMediaStreamMessage,
  TwilioMediaStreamMessage,
} from '../../integrations/twilio/twilio.types';
import { logger } from '../../utils/logger';
import { logMediaStreamConnection } from '../../middleware/twilioWebhookLogger';

class MediaStreamSession implements MediaStreamSessionHandle {
  constructor(
    public readonly callSid: string,
    public streamSid: string,
    public callerNumber: string,
    public callId: string,
    private readonly ws: WebSocket
  ) {}

  sendAudio(payload: string): void {
    this.send({ event: 'media', streamSid: this.streamSid, media: { payload } });
  }

  sendMark(name: string): void {
    this.send({ event: 'mark', streamSid: this.streamSid, mark: { name } });
  }

  clearAudio(): void {
    this.send({ event: 'clear', streamSid: this.streamSid });
  }

  private send(message: OutboundMediaStreamMessage): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }
}

export class MediaStreamHandler {
  private readonly sessions = new Map<string, MediaStreamSession>();
  private audioBridge: AudioBridge = new NoOpAudioBridge();

  setAudioBridge(bridge: AudioBridge): void {
    this.audioBridge = bridge;
  }

  handleConnection(ws: WebSocket): void {
    let session: MediaStreamSession | null = null;

    logMediaStreamConnection(null, 'websocket_connected');

    ws.on('message', (data) => {
      void this.handleMessage(ws, data.toString(), session, (s) => {
        session = s;
      });
    });

    ws.on('close', () => {
      void this.handleClose(session);
    });

    ws.on('error', (error) => {
      logger.error('Media stream WebSocket error', {
        callSid: session?.callSid,
        error: error.message,
      });
    });
  }

  private async handleMessage(
    ws: WebSocket,
    raw: string,
    session: MediaStreamSession | null,
    setSession: (session: MediaStreamSession) => void
  ): Promise<void> {
    let message: TwilioMediaStreamMessage;

    try {
      message = JSON.parse(raw) as TwilioMediaStreamMessage;
    } catch {
      logger.warn('Invalid media stream message received');
      return;
    }

    switch (message.event) {
      case 'connected':
        logMediaStreamConnection(session?.callSid ?? null, 'connected');
        logger.info('Twilio media stream connected', {
          timestamp: new Date().toISOString(),
          route: '/webhooks/twilio/media-stream',
          protocol: message.protocol,
          version: message.version,
        });
        break;

      case 'start':
        session = this.handleStart(ws, message);
        setSession(session);
        logMediaStreamConnection(session.callSid, 'start');
        logger.info('Twilio media stream started', {
          timestamp: new Date().toISOString(),
          route: '/webhooks/twilio/media-stream',
          callSid: session.callSid,
          streamSid: session.streamSid,
          callerNumber: session.callerNumber,
        });
        break;

      case 'media':
        if (session && message.media.track === 'inbound') {
          this.audioBridge.onCallerAudio(session, message.media.payload);
        }
        break;

      case 'mark':
        logger.debug('Media stream mark received', {
          callSid: session?.callSid,
          mark: message.mark.name,
        });
        break;

      case 'dtmf':
        logger.info('DTMF received', {
          callSid: session?.callSid,
          digit: message.dtmf.digit,
        });
        break;

      case 'stop':
        logMediaStreamConnection(session?.callSid ?? message.stop.callSid, 'stop');
        logger.info('Media stream stop received', {
          timestamp: new Date().toISOString(),
          route: '/webhooks/twilio/media-stream',
          callSid: message.stop.callSid,
          streamSid: message.streamSid,
        });
        await this.finalizeSession(message.stop.callSid);
        break;

      default:
        logger.debug('Unhandled media stream event', { event: (message as { event: string }).event });
    }
  }

  private handleStart(
    ws: WebSocket,
    message: Extract<TwilioMediaStreamMessage, { event: 'start' }>
  ): MediaStreamSession {
    const { callSid, streamSid, customParameters } = message.start;
    const callerNumber = customParameters.callerNumber ?? 'unknown';

    const session = new MediaStreamSession(callSid, streamSid, callerNumber, 'pending', ws);
    this.sessions.set(callSid, session);

    void this.initializeSession(callSid, streamSid, callerNumber, session);

    return session;
  }

  private async initializeSession(
    callSid: string,
    streamSid: string,
    callerNumber: string,
    session: MediaStreamSession
  ): Promise<void> {
    let callId: string;
    const existingCall = await callService.getSession(callSid);

    if (existingCall) {
      callId = existingCall.callId;
    } else {
      const result = await callService.handleIncomingCall(callSid, callerNumber);
      callId = result.callId;
    }

    const sessionData: CallSessionData = {
      callSid,
      streamSid,
      callerNumber,
      callId,
      startedAt: new Date().toISOString(),
      status: 'active',
    };

    await callService.saveSession(sessionData);

    session.callId = callId;

    logger.info('Media stream session started', {
      callSid,
      streamSid,
      callerNumber,
      callId,
    });

    try {
      await this.audioBridge.onSessionStart(session, sessionData);
    } catch (error) {
      logger.error('Failed to start audio bridge for call', {
        callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleClose(session: MediaStreamSession | null): Promise<void> {
    if (!session) {
      return;
    }

    await this.finalizeSession(session.callSid);
  }

  private async finalizeSession(callSid: string): Promise<void> {
    const session = this.sessions.get(callSid);

    if (!session) {
      return;
    }

    this.sessions.delete(callSid);

    try {
      await this.audioBridge.onSessionEnd(session);
    } catch (error) {
      logger.error('Error during audio bridge session end', {
        callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await callService.markStreamEnded(callSid);

    logger.info('Media stream session finalized', { callSid });
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const mediaStreamHandler = new MediaStreamHandler();
