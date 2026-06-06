import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt']);

const storage = multer.memoryStorage();

export const knowledgeUpload = multer({
  storage,
  limits: {
    fileSize: env.KNOWLEDGE_MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';

    if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new AppError(400, 'Only PDF, DOCX, and TXT files are allowed'));
      return;
    }

    cb(null, true);
  },
});
