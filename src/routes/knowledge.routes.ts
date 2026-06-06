import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { knowledgeUpload } from '../middleware/upload';
import { knowledgeService } from '../modules/knowledge/knowledge.service';
import { paginationSchema } from '../utils/pagination';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  knowledgeUpload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError(400, 'No file uploaded. Use multipart field name "file".');
    }

    const result = await knowledgeService.uploadFile(req.file);

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const query = paginationSchema.parse(req.query);
    const result = await knowledgeService.listFiles(query.page, query.limit);

    res.json({
      success: true,
      ...result,
    });
  })
);

router.get(
  '/search',
  asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({
      q: z.string().min(3),
      limit: z.coerce.number().int().min(1).max(10).optional(),
    });

    const { q, limit } = schema.parse(req.query);
    const results = await knowledgeService.search(q, limit);

    res.json({
      success: true,
      data: results,
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await knowledgeService.deleteFile(req.params.id);

    res.json({
      success: true,
      message: 'Knowledge file deleted',
    });
  })
);

export default router;
