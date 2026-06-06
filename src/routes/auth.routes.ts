import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { generateToken } from '../middleware/auth';
import { AppError } from '../utils/errors';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post(
  '/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = loginSchema.parse(req.body);

    if (username !== env.DASHBOARD_USERNAME || password !== env.DASHBOARD_PASSWORD) {
      throw new AppError(401, 'Invalid credentials');
    }

    const token = generateToken({
      userId: 'dashboard-admin',
      role: 'admin',
    });

    res.json({
      success: true,
      data: {
        token,
        expiresIn: env.JWT_EXPIRES_IN,
        tokenType: 'Bearer',
      },
    });
  })
);

export default router;
