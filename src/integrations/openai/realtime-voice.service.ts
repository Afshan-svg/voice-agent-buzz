import WebSocket from 'ws';
import { env } from '../../config/env';
import { OPENAI_TOOLS, SOFIA_SYSTEM_PROMPT } from '../../config/prompts';
import { getRedis, RedisKeys } from '../../config/redis';
import { knowledgeService } from '../../modules/knowledge/knowledge.service';
import { MediaStreamSessionHandle } from '../../modules/calls/audio-bridge';
import { transcriptService } from '../../modules/calls/transcript.service';
import { CallSessionData } from '../twilio/twilio.types';
import { logger } from '../../utils/logger';
import { realtimeToolHandler } from './realtime-tool.handler';
import {
  RealtimeClientEvent,
  RealtimeServerEvent,
  RealtimeSessionConfig,
  TranscriptEntry,
} from './realtime.types';

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

export class RealtimeSession {
  private ws: WebSocket | null = null;
  private sessionReady = false;
  private readonly transcript: TranscriptEntry[] = [];
  private readonly pendingAudio: string[] = [];
  private userTranscriptBuffer = '';
  private closed = false;

  constructor(
    private readonly twilioSession: MediaStreamSessionHandle,
    private readonly config: RealtimeSessionConfig
  ) {}

  async connect(): Promise<void> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const url = `${OPENAI_REALTIME_URL}?model=${encodeURIComponent(env.OPENAI_REALTIME_MODEL)}`;

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
      });

      const timeout = setTimeout(() => {
        reject(new Error('OpenAI Realtime connection timeout'));
      }, 15000);

      let sessionConfigured = false;

      this.ws.on('open', () => {
        logger.info('OpenAI Realtime WebSocket connected', {
          callSid: this.config.callSid,
          model: env.OPENAI_REALTIME_MODEL,
        });
      });

      this.ws.on('message', (data) => {
        void this.handleMessage(data.toString(), (eventType, errorMessage) => {
          if (eventType === 'error') {
            clearTimeout(timeout);
            reject(new Error(errorMessage ?? 'OpenAI Realtime error'));
            return;
          }

          if (eventType === 'session.created' && !sessionConfigured) {
            sessionConfigured = true;
            this.configureSession();
            return;
          }

          if (eventType === 'session.updated' && !this.sessionReady) {
            clearTimeout(timeout);
            this.sessionReady = true;
            this.flushPendingAudio();
            this.triggerGreeting();
            resolve();
          }
        });
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('OpenAI Realtime WebSocket error', {
          callSid: this.config.callSid,
          error: error.message,
        });
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(timeout);

        if (!this.sessionReady) {
          reject(
            new Error(
              `OpenAI Realtime WebSocket closed before session ready: ${reason.toString() || code}`
            )
          );
        }

        logger.info('OpenAI Realtime WebSocket closed', {
          callSid: this.config.callSid,
          code,
          reason: reason.toString(),
        });
      });
    });
  }

  appendAudio(payload: string): void {
    if (this.closed) {
      return;
    }

    if (!this.sessionReady || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingAudio.push(payload);

      if (this.pendingAudio.length > 150) {
        this.pendingAudio.shift();
      }

      return;
    }

    this.send({ type: 'input_audio_buffer.append', audio: payload });
  }

  private flushPendingAudio(): void {
    while (this.pendingAudio.length > 0) {
      const chunk = this.pendingAudio.shift();

      if (chunk) {
        this.send({ type: 'input_audio_buffer.append', audio: chunk });
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }

    this.ws = null;

    await this.persistTranscript();
  }

  private configureSession(): void {
    const instructions = `${SOFIA_SYSTEM_PROMPT}

Hotel name: ${env.HOTEL_NAME}
Caller phone number: ${this.config.callerNumber}

Language: Always speak English. Match the guest's language only if they clearly speak another language and prefer it.

Begin by warmly greeting the caller in English and asking how you may assist them today.`;

    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions,
        output_modalities: ['audio'],
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            transcription: { model: 'whisper-1', language: 'en' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.6,
              prefix_padding_ms: 300,
              silence_duration_ms: 700,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: {
            format: { type: 'audio/pcmu' },
            voice: env.OPENAI_REALTIME_VOICE,
          },
        },
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
      },
    });
  }

  private triggerGreeting(): void {
    this.send({
      type: 'response.create',
      response: {
        output_modalities: ['audio'],
        instructions:
          'Greet the caller warmly in English as Sofia from the hotel reception. Introduce yourself briefly and ask how you can help them today.',
      },
    });
  }

  private async handleMessage(
    raw: string,
    onLifecycle?: (eventType: string, errorMessage?: string) => void
  ): Promise<void> {
    let event: RealtimeServerEvent;

    try {
      event = JSON.parse(raw) as RealtimeServerEvent;
    } catch {
      logger.warn('Invalid OpenAI Realtime message', { callSid: this.config.callSid });
      return;
    }

    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        onLifecycle?.(event.type);
        break;

      case 'response.created':
        if (this.twilioSession.sendStatus) {
          this.twilioSession.sendStatus('thinking');
        }
        break;

      case 'response.done':
      case 'response.cancelled':
      case 'response.canceled':
        if (this.twilioSession.sendStatus) {
          this.twilioSession.sendStatus('idle');
        }
        break;

      case 'response.audio.delta':
      case 'response.output_audio.delta':
        if (this.twilioSession.sendStatus) {
          this.twilioSession.sendStatus('speaking');
        }
        this.handleAudioDelta(event);
        break;

      case 'input_audio_buffer.speech_started':
        this.handleSpeechStarted();
        break;

      case 'response.function_call_arguments.done':
        await this.handleFunctionCall(event);
        break;

      case 'conversation.item.input_audio_transcription.delta':
        if (typeof event.delta === 'string') {
          this.userTranscriptBuffer += event.delta;
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
        void this.captureTranscript(event);
        break;

      case 'error': {
        const errorMessage =
          typeof event.error === 'object' &&
          event.error !== null &&
          'message' in event.error &&
          typeof event.error.message === 'string'
            ? event.error.message
            : 'OpenAI Realtime error';

        logger.error('OpenAI Realtime error event', {
          callSid: this.config.callSid,
          error: event.error,
        });

        onLifecycle?.('error', errorMessage);
        break;
      }

      default:
        logger.debug('OpenAI Realtime event', {
          callSid: this.config.callSid,
          type: event.type,
        });
    }
  }

  private handleAudioDelta(event: RealtimeServerEvent): void {
    const delta = event.delta;

    if (typeof delta !== 'string' || delta.length === 0) {
      return;
    }

    this.twilioSession.sendAudio(delta);
  }

  private handleSpeechStarted(): void {
    logger.debug('Caller speech started — clearing playback buffer', {
      callSid: this.config.callSid,
    });

    this.twilioSession.clearAudio();
    if (this.twilioSession.sendStatus) {
      this.twilioSession.sendStatus('listening');
    }
  }

  private async handleFunctionCall(event: RealtimeServerEvent): Promise<void> {
    const callId = event.call_id;
    const name = event.name;
    const args = event.arguments;

    if (typeof callId !== 'string' || typeof name !== 'string' || typeof args !== 'string') {
      logger.warn('Malformed function call event', { callSid: this.config.callSid, event });
      return;
    }

    const output = await realtimeToolHandler.execute(name, args, {
      callSid: this.config.callSid,
      callId: this.config.callId,
      callerNumber: this.config.callerNumber,
    });

    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output,
      },
    });

    this.send({ type: 'response.create' });
  }

  private async captureTranscript(event: RealtimeServerEvent): Promise<void> {
    const isUserEvent = event.type === 'conversation.item.input_audio_transcription.completed';
    let text = '';

    if (isUserEvent) {
      if (typeof event.transcript === 'string' && event.transcript.trim().length > 0) {
        text = event.transcript.trim();
      } else if (this.userTranscriptBuffer.trim().length > 0) {
        text = this.userTranscriptBuffer.trim();
      }

      this.userTranscriptBuffer = '';
    } else if (typeof event.transcript === 'string') {
      text = event.transcript.trim();
    }

    if (text.length === 0) {
      return;
    }

    const role = isUserEvent ? 'user' : 'assistant';

    this.addTranscriptEntry(role, text);

    if (role === 'user') {
      await this.injectKnowledgeContext(text);
    }
  }

  private async injectKnowledgeContext(userQuery: string): Promise<void> {
    try {
      const results = await knowledgeService.search(userQuery);

      if (results.length === 0) {
        return;
      }

      const context = knowledgeService.formatContextForPrompt(results);

      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `Use the following hotel knowledge to answer the guest accurately. Do not mention that you searched a knowledge base.\n\n${context}`,
            },
          ],
        },
      });

      logger.debug('Injected knowledge context into realtime session', {
        callSid: this.config.callSid,
        chunks: results.length,
        query: userQuery.slice(0, 120),
      });
    } catch (error) {
      logger.warn('Failed to inject knowledge context', {
        callSid: this.config.callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private addTranscriptEntry(role: TranscriptEntry['role'], text: string): void {
    const entry: TranscriptEntry = {
      role,
      text,
      timestamp: new Date().toISOString(),
    };

    this.transcript.push(entry);
    void this.syncTranscriptToRedis();

    if (this.twilioSession.sendTranscript) {
      this.twilioSession.sendTranscript(role, text);
    }
  }

  private async syncTranscriptToRedis(): Promise<void> {
    try {
      const redis = getRedis();
      await redis.setex(
        RedisKeys.callContext(this.config.callSid),
        7200,
        JSON.stringify({ transcript: this.transcript })
      );
    } catch (error) {
      logger.warn('Failed to sync transcript to Redis', {
        callSid: this.config.callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async persistTranscript(): Promise<void> {
    try {
      await transcriptService.save(this.config.callId, this.transcript);
      logger.info('Call transcript saved', {
        callSid: this.config.callSid,
        callId: this.config.callId,
        entries: this.transcript.length,
      });
    } catch (error) {
      logger.error('Failed to save call transcript', {
        callSid: this.config.callSid,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private send(event: RealtimeClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(event));
  }
}

export class RealtimeVoiceService {
  private readonly sessions = new Map<string, RealtimeSession>();

  async startSession(
    twilioSession: MediaStreamSessionHandle,
    context: CallSessionData
  ): Promise<void> {
    const existing = this.sessions.get(context.callSid);

    if (existing) {
      await existing.disconnect();
      this.sessions.delete(context.callSid);
    }

    const session = new RealtimeSession(
      twilioSession,
      {
        callSid: context.callSid,
        callId: context.callId,
        callerNumber: context.callerNumber,
      }
    );

    this.sessions.set(context.callSid, session);

    try {
      await session.connect();
      logger.info('Realtime voice session started', {
        callSid: context.callSid,
        callId: context.callId,
      });
    } catch (error) {
      this.sessions.delete(context.callSid);
      throw error;
    }
  }

  appendCallerAudio(callSid: string, payload: string): void {
    this.sessions.get(callSid)?.appendAudio(payload);
  }

  async endSession(callSid: string): Promise<void> {
    const session = this.sessions.get(callSid);

    if (!session) {
      return;
    }

    this.sessions.delete(callSid);
    await session.disconnect();

    logger.info('Realtime voice session ended', { callSid });
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }
}

export const realtimeVoiceService = new RealtimeVoiceService();
