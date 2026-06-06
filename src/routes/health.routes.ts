import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, string> = {
    api: 'ok',
    database: 'unknown',
    redis: 'unknown',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    const redis = getRedis();
    const pong = await redis.ping();
    checks.redis = pong === 'PONG' ? 'ok' : 'error';
  } catch {
    checks.redis = 'error';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    service: 'buzznessai-hotel-receptionist',
    version: '1.0.0',
    checks,
    timestamp: new Date().toISOString(),
  });
});

export default router;
