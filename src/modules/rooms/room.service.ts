import { roomRepository } from '../../repositories/room.repository';
import { bookingRepository } from '../../repositories/booking.repository';
import { formatDateOnly, nightsBetween, parseDateOnly, todayUtc } from '../../utils/dates';
import { CheckAvailabilityInput } from '../bookings/booking.schemas';

export interface AvailableRoom {
  name: string;
  pricePerNight: number;
  capacity: number;
  totalPrice: number;
  nights: number;
}

export class RoomService {
  async checkAvailability(input: CheckAvailabilityInput): Promise<{
    checkIn: string;
    checkOut: string;
    guests: number;
    nights: number;
    availableRooms: AvailableRoom[];
  }> {
    const checkInDate = parseDateOnly(input.checkIn);
    const checkOutDate = parseDateOnly(input.checkOut);
    const nights = nightsBetween(checkInDate, checkOutDate);

    if (checkInDate < todayUtc()) {
      throw new Error('Check-in date cannot be in the past');
    }

    const candidateRooms = await roomRepository.findAllAvailable(input.guests);
    const availableRooms: AvailableRoom[] = [];

    for (const room of candidateRooms) {
      const overlaps = await bookingRepository.countOverlappingBookings(
        room.name,
        checkInDate,
        checkOutDate
      );

      if (overlaps === 0) {
        availableRooms.push({
          name: room.name,
          pricePerNight: room.price,
          capacity: room.capacity,
          totalPrice: room.price * nights,
          nights,
        });
      }
    }

    return {
      checkIn: formatDateOnly(checkInDate),
      checkOut: formatDateOnly(checkOutDate),
      guests: input.guests,
      nights,
      availableRooms,
    };
  }

  async resolveRoomType(roomType: string): Promise<string | null> {
    const room = await roomRepository.findByName(roomType.trim());
    return room?.name ?? null;
  }
}

export const roomService = new RoomService();
