import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export function parseAnalyticsDateRange(query: AnalyticsQuery): { from?: Date; to?: Date } {
  const from = query.from
    ? new Date(`${query.from}T00:00:00.000Z`)
    : undefined;
  const to = query.to
    ? new Date(`${query.to}T23:59:59.999Z`)
    : undefined;

  return { from, to };
}
