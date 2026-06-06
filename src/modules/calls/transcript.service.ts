import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { TranscriptEntry } from '../../integrations/openai/realtime.types';
import { callSummaryService } from './call-summary.service';

export class TranscriptService {
  async save(callId: string, entries: TranscriptEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const content = entries as unknown as Prisma.InputJsonValue;

    await prisma.transcript.upsert({
      where: { callId },
      create: {
        callId,
        content,
      },
      update: {
        content,
      },
    });

    void callSummaryService.generateIfReady(callId);
  }
}

export const transcriptService = new TranscriptService();
