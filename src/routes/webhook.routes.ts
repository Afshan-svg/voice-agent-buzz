import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateTwilioWebhook } from '../middleware/twilioAuth';
import { logTwilioWebhook } from '../middleware/twilioWebhookLogger';
import { twilioService } from '../integrations/twilio/twilio.service';
import { callService } from '../modules/calls/call.service';
import { mediaStreamHandler } from '../modules/calls/media-stream.handler';
import { whatsAppService } from '../modules/whatsapp/whatsapp.service';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

const incomingCallSchema = z.object({
  CallSid: z.string().min(1),
  From: z.string().min(1),
  To: z.string().optional(),
  CallStatus: z.string().optional(),
});

const statusCallbackSchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.string().min(1),
  CallDuration: z.string().optional(),
});

const whatsAppStatusSchema = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
});

router.post(
  '/incoming',
  logTwilioWebhook('POST /webhooks/twilio/incoming'),
  validateTwilioWebhook,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = incomingCallSchema.parse(req.body);

    await callService.handleIncomingCall(payload.CallSid, payload.From);

    const twiml = twilioService.buildIncomingCallTwiml(payload.CallSid, payload.From);

    logger.info('Twilio incoming webhook TwiML sent', {
      timestamp: new Date().toISOString(),
      route: 'POST /webhooks/twilio/incoming',
      callSid: payload.CallSid,
      callerNumber: payload.From,
      twimlLength: twiml.length,
    });

    res.type('text/xml').send(twiml);
  })
);

router.post(
  '/status',
  logTwilioWebhook('POST /webhooks/twilio/status'),
  validateTwilioWebhook,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = statusCallbackSchema.parse(req.body);

    logger.info('Twilio status webhook processed', {
      timestamp: new Date().toISOString(),
      route: 'POST /webhooks/twilio/status',
      callSid: payload.CallSid,
      callStatus: payload.CallStatus,
      callDuration: payload.CallDuration ?? null,
    });

    await callService.handleStatusUpdate(
      payload.CallSid,
      payload.CallStatus,
      payload.CallDuration
    );

    res.status(200).send('OK');
  })
);

router.post(
  '/whatsapp/status',
  validateTwilioWebhook,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = whatsAppStatusSchema.parse(req.body);

    await whatsAppService.handleDeliveryStatus(payload);

    res.status(200).send('OK');
  })
);

const streamStatusSchema = z.object({
  CallSid: z.string().min(1),
  StreamSid: z.string().optional(),
  StreamEvent: z.string().optional(),
  Timestamp: z.string().optional(),
});

router.post(
  '/stream-status',
  logTwilioWebhook('POST /webhooks/twilio/stream-status'),
  validateTwilioWebhook,
  (req: Request, res: Response) => {
    const payload = streamStatusSchema.parse(req.body);

    logger.info('Twilio stream status webhook processed', {
      timestamp: new Date().toISOString(),
      route: 'POST /webhooks/twilio/stream-status',
      callSid: payload.CallSid,
      streamSid: payload.StreamSid ?? null,
      streamEvent: payload.StreamEvent ?? null,
    });

    res.status(200).send('OK');
  }
);

router.get('/sessions', (_req: Request, res: Response) => {
  res.json({
    success: true,
    activeSessions: mediaStreamHandler.getActiveSessionCount(),
  });
});

export default router;

export { mediaStreamHandler };
