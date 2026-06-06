import { buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { AppError } from '../../utils/errors';
import { callRepository, CallWithRelations } from '../../repositories/call.repository';
import { buildCallWhere, ListCallsQuery } from '../bookings/booking.schemas';

function serializeCall(call: CallWithRelations, detailed = false) {
  const base = {
    id: call.id,
    callSid: call.callSid,
    callerNumber: call.callerNumber,
    status: call.status,
    startTime: call.startTime.toISOString(),
    endTime: call.endTime?.toISOString() ?? null,
    duration: call.duration,
    sentiment: call.sentiment,
    bookingCount: call.bookings.length,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };

  if (!detailed) {
    return base;
  }

  return {
    ...base,
    transcript: call.transcript?.content ?? null,
    summary: call.summary
      ? {
          intent: call.summary.intent,
          summary: call.summary.summary,
          sentiment: call.summary.sentiment,
          actionItems: call.summary.actionItems,
          createdAt: call.summary.createdAt.toISOString(),
        }
      : null,
    bookings: call.bookings.map((booking) => ({
      id: booking.id,
      bookingId: booking.bookingId,
      guestName: booking.guestName,
      roomType: booking.roomType,
      status: booking.status,
      checkIn: booking.checkIn.toISOString().slice(0, 10),
      checkOut: booking.checkOut.toISOString().slice(0, 10),
      totalPrice: booking.totalPrice,
    })),
  };
}

export class CallDashboardService {
  async listCalls(
    query: ListCallsQuery
  ): Promise<PaginatedResult<ReturnType<typeof serializeCall>>> {
    const where = buildCallWhere(query);
    const { calls, total } = await callRepository.findMany(where, query.page, query.limit);

    return buildPaginatedResult(
      calls.map((call) => serializeCall(call)),
      total,
      query.page,
      query.limit
    );
  }

  async getCall(identifier: string) {
    const call = await callRepository.findByIdOrCallSid(identifier);

    if (!call) {
      throw new AppError(404, 'Call not found');
    }

    return serializeCall(call, true);
  }
}

export const callDashboardService = new CallDashboardService();
