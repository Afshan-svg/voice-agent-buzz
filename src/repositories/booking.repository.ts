import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getSkip } from '../utils/pagination';
import { isUuid } from '../utils/identifiers';

const bookingInclude = {
  call: {
    select: {
      id: true,
      callSid: true,
      callerNumber: true,
      status: true,
      startTime: true,
      endTime: true,
      duration: true,
    },
  },
  room: {
    select: {
      id: true,
      name: true,
      price: true,
      capacity: true,
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

export class BookingRepository {
  async findByBookingId(bookingId: string): Promise<Booking | null> {
    return prisma.booking.findUnique({
      where: { bookingId },
    });
  }

  async countOverlappingBookings(
    roomType: string,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: string
  ): Promise<number> {
    return prisma.booking.count({
      where: {
        roomType,
        status: BookingStatus.CONFIRMED,
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeBookingId ? { bookingId: { not: excludeBookingId } } : {}),
      },
    });
  }

  async create(data: Prisma.BookingCreateInput): Promise<Booking> {
    return prisma.booking.create({ data });
  }

  async updateByBookingId(
    bookingId: string,
    data: Prisma.BookingUpdateInput
  ): Promise<Booking> {
    return prisma.booking.update({
      where: { bookingId },
      data,
    });
  }

  async findById(id: string): Promise<BookingWithRelations | null> {
    return prisma.booking.findUnique({
      where: { id },
      include: bookingInclude,
    });
  }

  async findByIdOrBookingId(identifier: string): Promise<BookingWithRelations | null> {
    const byBookingId = await this.findByBookingIdWithRelations(identifier);
    if (byBookingId) {
      return byBookingId;
    }

    if (isUuid(identifier)) {
      return this.findById(identifier);
    }

    return null;
  }

  async findByBookingIdWithRelations(bookingId: string): Promise<BookingWithRelations | null> {
    return prisma.booking.findUnique({
      where: { bookingId },
      include: bookingInclude,
    });
  }

  async findMany(
    where: Prisma.BookingWhereInput,
    page: number,
    limit: number
  ): Promise<{ bookings: BookingWithRelations[]; total: number }> {
    const skip = getSkip(page, limit);

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }
}

export const bookingRepository = new BookingRepository();
