import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { whatsAppService } from '../modules/whatsapp/whatsapp.service';
import { listWhatsAppMessagesSchema } from '../modules/whatsapp/whatsapp.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const query = listWhatsAppMessagesSchema.parse(req.query);
    const result = await whatsAppService.listMessages(query.page, query.limit, {
      bookingId: query.bookingId,
      status: query.status,
    });

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  '/messages/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const message = await whatsAppService.getMessage(req.params.id);

    res.json({
      success: true,
      data: message,
    });
  })
);

router.post(
  '/bookings/:bookingId/confirmation',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await whatsAppService.sendBookingConfirmation(req.params.bookingId);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/bookings/:bookingId/cancellation',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await whatsAppService.sendBookingCancellation(req.params.bookingId);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

export default router;
