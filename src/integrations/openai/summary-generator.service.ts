import { Sentiment } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env';
import { TranscriptEntry } from '../../integrations/openai/realtime.types';
import { logger } from '../../utils/logger';

const summarySchema = z.object({
  intent: z.string().min(1),
  summary: z.string().min(1),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED']),
  actionItems: z.array(z.string()),
});

export class SummaryGeneratorService {
  private formatTranscript(entries: TranscriptEntry[]): string {
    return entries
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
      .join('\n');
  }

  async generate(entries: TranscriptEntry[]): Promise<{
    intent: string;
    summary: string;
    sentiment: Sentiment;
    actionItems: string[];
  }> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (entries.length === 0) {
      throw new Error('Transcript is empty');
    }

    const transcript = this.formatTranscript(entries);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_SUMMARY_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You analyze luxury hotel receptionist phone calls.
Return JSON with:
- intent: primary reason for the call (short phrase)
- summary: 2-4 sentence summary of what happened
- sentiment: one of POSITIVE, NEUTRAL, NEGATIVE, MIXED
- actionItems: array of follow-up tasks for hotel staff (empty array if none)`,
          },
          {
            role: 'user',
            content: `Analyze this call transcript:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('OpenAI summary generation failed', {
        status: response.status,
        body: errorBody,
      });
      throw new Error('Failed to generate call summary');
    }

    const payload = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = payload.choices[0]?.message?.content;

    if (!content) {
      throw new Error('Empty summary response from OpenAI');
    }

    const parsed = summarySchema.parse(JSON.parse(content));

    return {
      intent: parsed.intent,
      summary: parsed.summary,
      sentiment: parsed.sentiment as Sentiment,
      actionItems: parsed.actionItems,
    };
  }
}

export const summaryGeneratorService = new SummaryGeneratorService();
