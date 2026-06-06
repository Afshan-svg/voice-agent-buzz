import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { env, isProduction } from '../config/env';
import { twilioService } from '../integrations/twilio/twilio.service';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';
import { formatPhoneNumber } from '../utils/phone';

const router = Router();

if (isProduction) {
  router.use((_req, _res, next) => {
    next(new AppError(404, 'Resource not found'));
  });
}

const callMeSchema = z.object({
  to: z.string().optional(),
});

router.post(
  '/call-me',
  asyncHandler(async (req: Request, res: Response) => {
    if (isProduction) {
      throw new AppError(404, 'Resource not found');
    }

    const body = callMeSchema.parse(req.body ?? {});
    const rawTo = body.to ?? env.TEST_CALL_TO_NUMBER ?? env.TWILIO_HUMAN_TRANSFER_NUMBER;

    if (!rawTo) {
      throw new AppError(
        400,
        'No destination number configured. Set TEST_CALL_TO_NUMBER or TWILIO_HUMAN_TRANSFER_NUMBER in .env'
      );
    }

    const to = formatPhoneNumber(rawTo);
    const result = await twilioService.createOutboundCall(to);

    res.json({
      success: true,
      message: 'Twilio is calling your phone now. Answer to speak with Sofia.',
      data: {
        callSid: result.callSid,
        status: result.status,
        to,
        from: env.TWILIO_PHONE_NUMBER,
        webhookUrl: result.url,
      },
    });
  })
);

export default router;
