import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { AudioBridge, MediaStreamSessionHandle, NoOpAudioBridge } from './audio-bridge';
import { callService } from './call.service';
import { CallSessionData } from '../../integrations/twilio/twilio.types';
import { logger } from '../../utils/logger';

class BrowserMediaStreamSession implements MediaStreamSessionHandle {
  constructor(
    public readonly callSid: string,
    public streamSid: string,
    public callerNumber: string,
    public callId: string,
    private readonly ws: WebSocket
  ) {}

  sendAudio(payload: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'media', payload }));
  }

  sendMark(name: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'mark', name }));
  }

  clearAudio(): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'clear' }));
  }

  sendTranscript(role: string, text: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'transcript', role, text }));
  }

  sendStatus(status: string): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'status', status }));
  }
}

export class BrowserStreamHandler {
  private readonly sessions = new Map<string, BrowserMediaStreamSession>();
  private audioBridge: AudioBridge = new NoOpAudioBridge();

  setAudioBridge(bridge: AudioBridge): void {
    this.audioBridge = bridge;
  }

  handleConnection(ws: WebSocket): void {
    let session: BrowserMediaStreamSession | null = null;
    
    logger.info('Browser WebSocket connected');

    ws.on('message', (data) => {
      void this.handleMessage(ws, data.toString(), session, (s) => {
        session = s;
      });
    });

    ws.on('close', () => {
      void this.handleClose(session);
    });

    ws.on('error', (error) => {
      logger.error('Browser stream WebSocket error', {
        callSid: session?.callSid,
        error: error.message,
      });
    });
  }

  private async handleMessage(
    ws: WebSocket,
    raw: string,
    session: BrowserMediaStreamSession | null,
    setSession: (session: BrowserMediaStreamSession) => void
  ): Promise<void> {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      logger.warn('Invalid browser stream message received');
      return;
    }

    switch (message.type) {
      case 'start':
        session = this.handleStart(ws);
        setSession(session);
        break;
      case 'media':
        if (session && message.payload) {
          this.audioBridge.onCallerAudio(session, message.payload);
        }
        break;
      case 'stop':
        if (session) {
          await this.finalizeSession(session.callSid);
        }
        break;
      default:
        logger.debug('Unhandled browser stream event', { type: message.type });
    }
  }

  private handleStart(ws: WebSocket): BrowserMediaStreamSession {
    const callSid = `web_${uuidv4()}`;
    const streamSid = `stream_${uuidv4()}`;
    const callerNumber = 'Browser Guest';

    const session = new BrowserMediaStreamSession(callSid, streamSid, callerNumber, 'pending', ws);
    this.sessions.set(callSid, session);

    void this.initializeSession(callSid, streamSid, callerNumber, session);

    return session;
  }

  private async initializeSession(
    callSid: string,
    streamSid: string,
    callerNumber: string,
    session: BrowserMediaStreamSession
  ): Promise<void> {
    const result = await callService.handleIncomingCall(callSid, callerNumber, 'WEB');
    const callId = result.callId;

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

    logger.info('Browser media stream session started', {
      callSid,
      streamSid,
      callerNumber,
      callId,
    });

    // Notify browser of connection
    if (session['ws'].readyState === WebSocket.OPEN) {
      session['ws'].send(JSON.stringify({ type: 'connected', callId, callSid }));
    }

    try {
      await this.audioBridge.onSessionStart(session, sessionData);
    } catch (error) {
      logger.error('Failed to start audio bridge for browser call', {
        callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleClose(session: BrowserMediaStreamSession | null): Promise<void> {
    if (!session) return;
    await this.finalizeSession(session.callSid);
  }

  private async finalizeSession(callSid: string): Promise<void> {
    const session = this.sessions.get(callSid);
    if (!session) return;

    this.sessions.delete(callSid);

    try {
      await this.audioBridge.onSessionEnd(session);
    } catch (error) {
      logger.error('Error during browser audio bridge session end', {
        callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await callService.handleStatusUpdate(callSid, 'completed');
    logger.info('Browser media stream session finalized', { callSid });
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const browserStreamHandler = new BrowserStreamHandler();
