import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Render sets RENDER_EXTERNAL_URL; use it for Twilio/webhooks when PUBLIC_URL is unset.
if (!process.env.PUBLIC_URL && process.env.RENDER_EXTERNAL_URL) {
  process.env.PUBLIC_URL = process.env.RENDER_EXTERNAL_URL;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('24h'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime'),
  OPENAI_REALTIME_VOICE: z
    .enum(['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'])
    .default('shimmer'),
  OPENAI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  OPENAI_SUMMARY_MODEL: z.string().default('gpt-4o-mini'),

  UPLOAD_DIR: z.string().default('./uploads'),
  KNOWLEDGE_MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
  KNOWLEDGE_CHUNK_SIZE: z.coerce.number().default(1000),
  KNOWLEDGE_CHUNK_OVERLAP: z.coerce.number().default(200),
  KNOWLEDGE_SEARCH_LIMIT: z.coerce.number().default(5),
  KNOWLEDGE_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.7),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VALIDATE_SIGNATURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),
  TWILIO_HUMAN_TRANSFER_NUMBER: z.string().optional(),
  TEST_CALL_TO_NUMBER: z.string().optional(),

  HOTEL_NAME: z.string().default('BuzznessAI Luxury Hotel'),

  DASHBOARD_USERNAME: z.string().default('admin'),
  DASHBOARD_PASSWORD: z.string().min(4).default('admin123'),

  WHATSAPP_AUTO_SEND_CONFIRMATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  WHATSAPP_AUTO_SEND_CANCELLATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const twilioSignatureValidationEnabled =
  env.TWILIO_VALIDATE_SIGNATURE ?? isProduction;
