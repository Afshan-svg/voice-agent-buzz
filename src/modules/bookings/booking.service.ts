import { BookingStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { bookingRepository } from '../../repositories/booking.repository';
import { roomRepository } from '../../repositories/room.repository';
import { formatDateOnly, nightsBetween, parseDateOnly, todayUtc } from '../../utils/dates';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import {
  CancelBookingInput,
  CreateBookingInput,
} from './booking.schemas';
import { roomService } from '../rooms/room.service';

export class BookingService {
  private async generateBookingId(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const bookingId = `BH-${Math.floor(1000 + Math.random() * 9000)}`;
      const existing = await bookingRepository.findByBookingId(bookingId);

      if (!existing) {
        return bookingId;
      }
    }

    throw new Error('Unable to generate a unique booking ID. Please try again.');
  }

  async createBooking(
    input: CreateBookingInput,
    callId?: string
  ): Promise<{
    bookingId: string;
    guestName: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
    nights: number;
  }> {
    const checkInDate = parseDateOnly(input.checkIn);
    const checkOutDate = parseDateOnly(input.checkOut);
    const nights = nightsBetween(checkInDate, checkOutDate);

    if (checkInDate < todayUtc()) {
      throw new Error('Check-in date cannot be in the past');
    }

    const resolvedRoomType = await roomService.resolveRoomType(input.roomType);

    if (!resolvedRoomType) {
      const allRooms = await roomRepository.findAll();
      const roomNames = allRooms.map((room) => room.name).join(', ');
      throw new Error(`Invalid room type. Available options: ${roomNames}`);
    }

    const room = await roomRepository.findByName(resolvedRoomType);

    if (!room || !room.available) {
      throw new Error(`Room "${resolvedRoomType}" is not available`);
    }

    if (room.capacity < input.guests) {
      throw new Error(
        `"${resolvedRoomType}" accommodates up to ${room.capacity} guests`
      );
    }

    const overlaps = await bookingRepository.countOverlappingBookings(
      resolvedRoomType,
      checkInDate,
      checkOutDate
    );

    if (overlaps > 0) {
      throw new Error(
        `"${resolvedRoomType}" is not available for the selected dates`
      );
    }

    const bookingId = await this.generateBookingId();
    const totalPrice = room.price * nights;

    let callConnect = {};
    if (callId) {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (call) {
        callConnect = { call: { connect: { id: callId } } };
      }
    }

    await bookingRepository.create({
      bookingId,
      guestName: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase(),
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: input.guests,
      totalPrice,
      status: BookingStatus.CONFIRMED,
      room: { connect: { name: resolvedRoomType } },
      ...callConnect,
    });

    logger.info('Booking created', { bookingId, callId, roomType: resolvedRoomType });

    return {
      bookingId,
      guestName: input.name.trim(),
      roomType: resolvedRoomType,
      checkIn: formatDateOnly(checkInDate),
      checkOut: formatDateOnly(checkOutDate),
      guests: input.guests,
      totalPrice,
      nights,
    };
  }

  async cancelBooking(input: CancelBookingInput): Promise<{
    bookingId: string;
    guestName: string;
    status: string;
  }> {
    const booking = await bookingRepository.findByBookingId(input.bookingId.trim());

    if (!booking) {
      throw new Error(`Booking ${input.bookingId} was not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return {
        bookingId: booking.bookingId,
        guestName: booking.guestName,
        status: 'already_cancelled',
      };
    }

    await bookingRepository.updateByBookingId(booking.bookingId, {
      status: BookingStatus.CANCELLED,
    });

    logger.info('Booking cancelled', { bookingId: booking.bookingId });

    return {
      bookingId: booking.bookingId,
      guestName: booking.guestName,
      status: 'cancelled',
    };
  }

  async getBookingForWhatsApp(bookingId: string) {
    const booking = await bookingRepository.findByBookingId(bookingId.trim());

    if (!booking) {
      throw new Error(`Booking ${bookingId} was not found`);
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error(`Booking ${bookingId} has been cancelled`);
    }

    return booking;
  }

  async getBookingById(bookingId: string) {
    const booking = await bookingRepository.findByBookingId(bookingId.trim());

    if (!booking) {
      throw new AppError(404, `Booking ${bookingId} was not found`);
    }

    return booking;
  }
}

export const bookingService = new BookingService();
