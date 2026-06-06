import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { callDashboardService } from '../modules/calls/call-dashboard.service';
import { listCallsQuerySchema } from '../modules/bookings/booking.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = listCallsQuerySchema.parse(req.query);
    const result = await callDashboardService.listCalls(query);

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const call = await callDashboardService.getCall(req.params.id);

    res.json({
      success: true,
      data: call,
    });
  })
);

export default router;
