import { Request, Response, NextFunction } from 'express';
import { env, twilioSignatureValidationEnabled } from '../config/env';
import { twilioService } from '../integrations/twilio/twilio.service';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

function getWebhookUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' ? forwardedProto.split(',')[0]?.trim() : req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${req.originalUrl}`;
}

export function validateTwilioWebhook(req: Request, _res: Response, next: NextFunction): void {
  if (!twilioSignatureValidationEnabled || !env.TWILIO_AUTH_TOKEN) {
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string | undefined;
  const url = getWebhookUrl(req);
  const params = req.body as Record<string, string>;

  const isValid = twilioService.validateWebhookSignature(signature, url, params);

  if (!isValid) {
    logger.warn('Invalid Twilio webhook signature', { url, path: req.path });
    next(new AppError(403, 'Invalid Twilio signature'));
    return;
  }

  next();
}
