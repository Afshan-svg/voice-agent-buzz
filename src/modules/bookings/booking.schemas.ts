import { BookingStatus, CallStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const listBookingsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(BookingStatus).optional(),
  search: z.string().trim().min(1).optional(),
  checkInFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkInTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const listCallsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(CallStatus).optional(),
  search: z.string().trim().min(1).optional(),
});

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;

export function buildBookingWhere(query: ListBookingsQuery): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { bookingId: { contains: query.search, mode: 'insensitive' } },
      { guestName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { roomType: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.checkInFrom || query.checkInTo) {
    where.checkIn = {
      ...(query.checkInFrom ? { gte: new Date(query.checkInFrom) } : {}),
      ...(query.checkInTo ? { lte: new Date(query.checkInTo) } : {}),
    };
  }

  return where;
}

export function buildCallWhere(query: ListCallsQuery): Prisma.CallWhereInput {
  const where: Prisma.CallWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { callSid: { contains: query.search, mode: 'insensitive' } },
      { callerNumber: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export const checkAvailabilitySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  guests: z.coerce.number().int().min(1).max(20),
});

export const createBookingSchema = z.object({
  name: z.string().min(1, 'Guest name is required'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Valid email is required'),
  roomType: z.string().min(1, 'Room type is required'),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  guests: z.coerce.number().int().min(1).max(20),
});

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
});

export const transferToHumanSchema = z.object({
  reason: z.string().min(1, 'Transfer reason is required'),
});

export const sendWhatsAppSchema = z.object({
  bookingId: z.string().min(1, 'Booking ID is required'),
});

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
