import { Prisma, Sentiment } from '@prisma/client';
import { prisma } from '../config/database';

export class CallSummaryRepository {
  async findByCallId(callId: string) {
    return prisma.callSummary.findUnique({
      where: { callId },
    });
  }

  async upsert(
    callId: string,
    data: {
      intent: string;
      summary: string;
      sentiment: Sentiment;
      actionItems: string[];
    }
  ) {
    const actionItems = data.actionItems as unknown as Prisma.InputJsonValue;

    return prisma.callSummary.upsert({
      where: { callId },
      create: {
        callId,
        intent: data.intent,
        summary: data.summary,
        sentiment: data.sentiment,
        actionItems,
      },
      update: {
        intent: data.intent,
        summary: data.summary,
        sentiment: data.sentiment,
        actionItems,
      },
    });
  }
}

export const callSummaryRepository = new CallSummaryRepository();
