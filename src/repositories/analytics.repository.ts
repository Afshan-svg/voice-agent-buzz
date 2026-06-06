import { BookingStatus, CallStatus, Prisma, WhatsAppMessageStatus } from '@prisma/client';
import { prisma } from '../config/database';

export interface AnalyticsDateRange {
  from?: Date;
  to?: Date;
}

function callDateFilter(range: AnalyticsDateRange): Prisma.CallWhereInput {
  if (!range.from && !range.to) {
    return {};
  }

  return {
    startTime: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

function bookingDateFilter(range: AnalyticsDateRange): Prisma.BookingWhereInput {
  if (!range.from && !range.to) {
    return {};
  }

  return {
    createdAt: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  };
}

export class AnalyticsRepository {
  async getOverview(range: AnalyticsDateRange) {
    const callWhere = callDateFilter(range);
    const bookingWhere = bookingDateFilter(range);

    const [
      totalCalls,
      activeCalls,
      transferredCalls,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      durationAggregate,
      revenueAggregate,
      roomGroups,
      whatsappSent,
    ] = await Promise.all([
      prisma.call.count({ where: callWhere }),
      prisma.call.count({ where: { ...callWhere, status: CallStatus.ACTIVE } }),
      prisma.call.count({ where: { ...callWhere, status: CallStatus.TRANSFERRED } }),
      prisma.booking.count({ where: bookingWhere }),
      prisma.booking.count({
        where: { ...bookingWhere, status: BookingStatus.CONFIRMED },
      }),
      prisma.booking.count({
        where: { ...bookingWhere, status: BookingStatus.CANCELLED },
      }),
      prisma.call.aggregate({
        where: {
          ...callWhere,
          duration: { not: null },
        },
        _avg: { duration: true },
      }),
      prisma.booking.aggregate({
        where: {
          ...bookingWhere,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          totalPrice: { not: null },
        },
        _sum: { totalPrice: true },
      }),
      prisma.booking.groupBy({
        by: ['roomType'],
        where: {
          ...bookingWhere,
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
        },
        _count: { roomType: true },
        orderBy: { _count: { roomType: 'desc' } },
        take: 1,
      }),
      prisma.whatsAppMessage.count({
        where: {
          status: {
            in: [
              WhatsAppMessageStatus.SENT,
              WhatsAppMessageStatus.DELIVERED,
              WhatsAppMessageStatus.READ,
            ],
          },
          ...(range.from || range.to
            ? {
                createdAt: {
                  ...(range.from ? { gte: range.from } : {}),
                  ...(range.to ? { lte: range.to } : {}),
                },
              }
            : {}),
        },
      }),
    ]);

    const mostRequestedRoom =
      roomGroups.length > 0
        ? {
            name: roomGroups[0].roomType,
            count: roomGroups[0]._count.roomType,
          }
        : null;

    return {
      totalCalls,
      activeCalls,
      transferredCalls,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      averageCallDuration: Math.round(durationAggregate._avg.duration ?? 0),
      revenueGenerated: revenueAggregate._sum.totalPrice ?? 0,
      mostRequestedRoom,
      whatsappMessagesSent: whatsappSent,
    };
  }

  async getSentimentBreakdown(range: AnalyticsDateRange) {
    const groups = await prisma.callSummary.groupBy({
      by: ['sentiment'],
      where: {
        call: callDateFilter(range),
      },
      _count: { sentiment: true },
    });

    return groups.map((group) => ({
      sentiment: group.sentiment,
      count: group._count.sentiment,
    }));
  }

  async getDailyCallVolume(range: AnalyticsDateRange, days = 7) {
    const end = range.to ?? new Date();
    const start =
      range.from ?? new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const calls = await prisma.call.findMany({
      where: {
        startTime: {
          gte: start,
          lte: end,
        },
      },
      select: {
        startTime: true,
      },
    });

    const buckets = new Map<string, number>();

    for (const call of calls) {
      const key = call.startTime.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, calls: count }));
  }
}

export const analyticsRepository = new AnalyticsRepository();
