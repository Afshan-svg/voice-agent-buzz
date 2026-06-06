import { WhatsAppMessageStatus } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listWhatsAppMessagesSchema = paginationSchema.extend({
  bookingId: z.string().trim().min(1).optional(),
  status: z.nativeEnum(WhatsAppMessageStatus).optional(),
});

export type ListWhatsAppMessagesQuery = z.infer<typeof listWhatsAppMessagesSchema>;
