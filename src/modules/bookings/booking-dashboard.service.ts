import { formatDateOnly } from '../../utils/dates';
import { buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { AppError } from '../../utils/errors';
import {
  bookingRepository,
  BookingWithRelations,
} from '../../repositories/booking.repository';
import {
  buildBookingWhere,
  ListBookingsQuery,
} from './booking.schemas';

function serializeBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    bookingId: booking.bookingId,
    guestName: booking.guestName,
    phone: booking.phone,
    email: booking.email,
    roomType: booking.roomType,
    checkIn: formatDateOnly(booking.checkIn),
    checkOut: formatDateOnly(booking.checkOut),
    guests: booking.guests,
    status: booking.status,
    totalPrice: booking.totalPrice,
    callId: booking.callId,
    call: booking.call,
    room: booking.room,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

export class BookingDashboardService {
  async listBookings(query: ListBookingsQuery): Promise<PaginatedResult<ReturnType<typeof serializeBooking>>> {
    const where = buildBookingWhere(query);
    const { bookings, total } = await bookingRepository.findMany(
      where,
      query.page,
      query.limit
    );

    return buildPaginatedResult(
      bookings.map(serializeBooking),
      total,
      query.page,
      query.limit
    );
  }

  async getBooking(identifier: string) {
    const booking = await bookingRepository.findByIdOrBookingId(identifier);

    if (!booking) {
      throw new AppError(404, 'Booking not found');
    }

    return serializeBooking(booking);
  }
}

export const bookingDashboardService = new BookingDashboardService();
