import twilio from 'twilio';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const { VoiceResponse } = twilio.twiml;

function isTwilioConfigured(): boolean {
  const sid = env.TWILIO_ACCOUNT_SID?.trim();
  const token = env.TWILIO_AUTH_TOKEN?.trim();

  if (!sid || !token) {
    return false;
  }

  if (!sid.startsWith('AC')) {
    logger.warn('Twilio disabled — TWILIO_ACCOUNT_SID must start with AC');
    return false;
  }

  if (token.startsWith('your-') || token === 'your-twilio-auth-token') {
    return false;
  }

  return true;
}

export class TwilioService {
  private readonly client: twilio.Twilio | null;

  constructor() {
    this.client = isTwilioConfigured()
      ? twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!)
      : null;

    if (!this.client) {
      logger.warn('Twilio client not configured — phone and WhatsApp features disabled');
    }
  }

  getMediaStreamUrl(): string {
    const url = new URL(env.PUBLIC_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/webhooks/twilio/media-stream';
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  buildIncomingCallTwiml(callSid: string, callerNumber: string): string {
    const response = new VoiceResponse();
    const streamUrl = this.getMediaStreamUrl();
    const streamStatusCallbackUrl = new URL(
      '/webhooks/twilio/stream-status',
      env.PUBLIC_URL
    ).toString();

    const connect = response.connect();
    const stream = connect.stream({
      url: streamUrl,
      statusCallback: streamStatusCallbackUrl,
      statusCallbackMethod: 'POST',
    });

    stream.parameter({ name: 'callSid', value: callSid });
    stream.parameter({ name: 'callerNumber', value: callerNumber });

    logger.info('Generated incoming call TwiML', { callSid, streamUrl });

    return response.toString();
  }

  buildTransferTwiml(transferNumber: string): string {
    const response = new VoiceResponse();
    response.say({ voice: 'Polly.Joanna' }, 'Please hold while I transfer you to a team member.');
    response.dial(transferNumber);
    return response.toString();
  }

  async createOutboundCall(to: string): Promise<{ callSid: string; status: string; url: string }> {
    const client = this.client;
    const from = env.TWILIO_PHONE_NUMBER;

    if (!client) {
      throw new Error('Twilio client is not configured');
    }

    if (!from) {
      throw new Error('TWILIO_PHONE_NUMBER is not configured');
    }

    if (!env.PUBLIC_URL) {
      throw new Error('PUBLIC_URL is not configured');
    }

    const url = new URL('/webhooks/twilio/incoming', env.PUBLIC_URL).toString();

    const payload = {
      to,
      from,
      url,
      method: 'POST' as const,
    };

    logger.info('Twilio outbound call API payload', {
      timestamp: new Date().toISOString(),
      route: 'client.calls.create',
      payload,
    });

    const call = await client.calls.create(payload);

    logger.info('Outbound test call created', {
      timestamp: new Date().toISOString(),
      callSid: call.sid,
      status: call.status,
      to,
      from,
      url,
    });

    return {
      callSid: call.sid,
      status: call.status,
      url,
    };
  }

  async transferCall(callSid: string): Promise<void> {
    const client = this.client;
    const transferNumber = env.TWILIO_HUMAN_TRANSFER_NUMBER;

    if (!client) {
      throw new Error('Twilio client is not configured');
    }

    if (!transferNumber) {
      throw new Error('TWILIO_HUMAN_TRANSFER_NUMBER is not configured');
    }

    const twiml = this.buildTransferTwiml(transferNumber);

    await client.calls(callSid).update({ twiml });

    logger.info('Call transferred to human', { callSid, transferNumber });
  }

  async sendWhatsAppMessage(toPhone: string, body: string): Promise<{ messageSid: string; status: string }> {
    const client = this.client;
    const from = env.TWILIO_WHATSAPP_NUMBER;

    if (!client) {
      throw new Error('Twilio client is not configured');
    }

    if (!from) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is not configured');
    }

    const to = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
    const fromAddress = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    const statusCallback = new URL('/webhooks/twilio/whatsapp/status', env.PUBLIC_URL).toString();

    const message = await client.messages.create({
      from: fromAddress,
      to,
      body,
      statusCallback,
    });

    logger.info('WhatsApp message sent', {
      to,
      messageSid: message.sid,
      status: message.status,
    });

    return {
      messageSid: message.sid,
      status: message.status,
    };
  }

  getWhatsAppFromAddress(): string {
    const from = env.TWILIO_WHATSAPP_NUMBER;

    if (!from) {
      throw new Error('TWILIO_WHATSAPP_NUMBER is not configured');
    }

    return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  }

  validateWebhookSignature(
    signature: string | undefined,
    url: string,
    params: Record<string, string>
  ): boolean {
    if (!env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio signature validation skipped — TWILIO_AUTH_TOKEN not configured');
      return true;
    }

    if (!signature) {
      return false;
    }

    return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, url, params);
  }

  getClient(): twilio.Twilio | null {
    return this.client;
  }
}

export const twilioService = new TwilioService();
