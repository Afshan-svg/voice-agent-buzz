import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { bookingDashboardService } from '../modules/bookings/booking-dashboard.service';
import { listBookingsQuerySchema } from '../modules/bookings/booking.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = listBookingsQuerySchema.parse(req.query);
    const result = await bookingDashboardService.listBookings(query);

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const booking = await bookingDashboardService.getBooking(req.params.id);

    res.json({
      success: true,
      data: booking,
    });
  })
);

export default router;
