import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import webhookRoutes from './webhook.routes';
import callsRoutes from './calls.routes';
import bookingsRoutes from './bookings.routes';
import analyticsRoutes from './analytics.routes';
import knowledgeRoutes from './knowledge.routes';
import whatsappRoutes from './whatsapp.routes';
import testRoutes from './test.routes';
import { isProduction } from '../config/env';

const router = Router();

router.use(healthRoutes);
router.use('/auth', authRoutes);
router.use('/webhooks/twilio', webhookRoutes);
router.use('/calls', callsRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/whatsapp', whatsappRoutes);

if (!isProduction) {
  router.use('/test', testRoutes);
}

export default router;
