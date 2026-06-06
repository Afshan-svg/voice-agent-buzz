import { env } from '../../config/env';
import { formatDateOnly } from '../../utils/dates';

export interface BookingMessageData {
  guestName: string;
  bookingId: string;
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  guests: number;
  totalPrice?: number | null;
}

export function buildBookingConfirmationMessage(booking: BookingMessageData): string {
  const lines = [
    'Booking Confirmed',
    '',
    booking.guestName,
    booking.bookingId,
    `Check-In: ${formatDateOnly(booking.checkIn)}`,
    `Check-Out: ${formatDateOnly(booking.checkOut)}`,
    `Room Type: ${booking.roomType}`,
    `Guests: ${booking.guests}`,
  ];

  if (booking.totalPrice) {
    lines.push(`Total: ₹${booking.totalPrice.toLocaleString('en-IN')}`);
  }

  lines.push('', `Thank you for choosing ${env.HOTEL_NAME}.`);

  return lines.join('\n');
}

export function buildBookingCancellationMessage(booking: BookingMessageData): string {
  return [
    'Booking Cancelled',
    '',
    booking.guestName,
    booking.bookingId,
    `Check-In: ${formatDateOnly(booking.checkIn)}`,
    `Check-Out: ${formatDateOnly(booking.checkOut)}`,
    `Room Type: ${booking.roomType}`,
    '',
    `Your reservation at ${env.HOTEL_NAME} has been cancelled.`,
    'We hope to welcome you again soon.',
  ].join('\n');
}
