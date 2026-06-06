import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { analyticsService } from '../modules/analytics/analytics.service';
import {
  analyticsQuerySchema,
  parseAnalyticsDateRange,
} from '../modules/analytics/analytics.schemas';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = analyticsQuerySchema.parse(req.query);
    const range = parseAnalyticsDateRange(query);
    const data = await analyticsService.getDashboard(range);

    res.json({
      success: true,
      data,
    });
  })
);

export default router;
