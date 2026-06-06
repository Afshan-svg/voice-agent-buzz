import { Call, CallStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getSkip } from '../utils/pagination';
import { isUuid } from '../utils/identifiers';

const callInclude = {
  transcript: true,
  summary: true,
  bookings: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.CallInclude;

export type CallWithRelations = Prisma.CallGetPayload<{ include: typeof callInclude }>;

export class CallRepository {
  async create(data: { callSid: string; callerNumber: string; channel?: 'PHONE' | 'WEB' }): Promise<Call> {
    return prisma.call.create({
      data: {
        callSid: data.callSid,
        callerNumber: data.callerNumber,
        status: CallStatus.ACTIVE,
        channel: data.channel ?? 'PHONE',
      },
    });
  }

  async findByCallSid(callSid: string): Promise<Call | null> {
    return prisma.call.findUnique({ where: { callSid } });
  }

  async updateByCallSid(
    callSid: string,
    data: Prisma.CallUpdateInput
  ): Promise<Call> {
    return prisma.call.update({
      where: { callSid },
      data,
    });
  }

  async findById(id: string): Promise<CallWithRelations | null> {
    return prisma.call.findUnique({
      where: { id },
      include: callInclude,
    });
  }

  async findByIdOrCallSid(identifier: string): Promise<CallWithRelations | null> {
    if (isUuid(identifier)) {
      const byId = await this.findById(identifier);
      if (byId) {
        return byId;
      }
    }

    return prisma.call.findUnique({
      where: { callSid: identifier },
      include: callInclude,
    });
  }

  async findMany(
    where: Prisma.CallWhereInput,
    page: number,
    limit: number
  ): Promise<{ calls: CallWithRelations[]; total: number }> {
    const skip = getSkip(page, limit);

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where,
        include: callInclude,
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.call.count({ where }),
    ]);

    return { calls, total };
  }
}

export const callRepository = new CallRepository();
