import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

function extractCallSid(req: Request): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  const fromBody = body?.CallSid ?? body?.callSid;

  if (typeof fromBody === 'string') {
    return fromBody;
  }

  const fromQuery = req.query.CallSid ?? req.query.callSid;

  if (typeof fromQuery === 'string') {
    return fromQuery;
  }

  return undefined;
}

export function logTwilioWebhook(route: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const callSid = extractCallSid(req);

    logger.info('Twilio webhook request', {
      timestamp: new Date().toISOString(),
      route,
      method: req.method,
      path: req.originalUrl,
      callSid: callSid ?? null,
      callStatus: (req.body as Record<string, unknown>)?.CallStatus ?? null,
      direction: (req.body as Record<string, unknown>)?.Direction ?? null,
    });

    next();
  };
}

export function logMediaStreamConnection(callSid: string | null, event: string): void {
  logger.info('Twilio media stream event', {
    timestamp: new Date().toISOString(),
    route: '/webhooks/twilio/media-stream',
    event,
    callSid,
  });
}
