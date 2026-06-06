import { CallStatus } from '@prisma/client';
import { ZodError } from 'zod';
import { twilioService } from '../integrations/twilio/twilio.service';
import { callRepository } from '../repositories/call.repository';
import { bookingService } from '../modules/bookings/booking.service';
import {
  cancelBookingSchema,
  checkAvailabilitySchema,
  createBookingSchema,
  sendWhatsAppSchema,
  transferToHumanSchema,
} from '../modules/bookings/booking.schemas';
import { roomService } from '../modules/rooms/room.service';
import { whatsAppService, maybeSendBookingConfirmation, maybeSendBookingCancellation } from '../modules/whatsapp/whatsapp.service';
import { logger } from '../utils/logger';

export interface ToolExecutionContext {
  callSid: string;
  callId: string;
  callerNumber: string;
}

type SessionEndHandler = (callSid: string) => Promise<void>;

export class ToolExecutorService {
  private sessionEndHandler: SessionEndHandler | null = null;

  registerSessionEndHandler(handler: SessionEndHandler): void {
    this.sessionEndHandler = handler;
  }

  async execute(
    name: string,
    argsJson: string,
    context: ToolExecutionContext
  ): Promise<string> {
    let args: unknown;

    try {
      args = JSON.parse(argsJson);
    } catch {
      return this.errorResult('Invalid tool arguments JSON');
    }

    logger.info('Executing realtime tool', {
      callSid: context.callSid,
      callId: context.callId,
      name,
    });

    try {
      switch (name) {
        case 'check_room_availability':
          return await this.checkRoomAvailability(args);

        case 'create_booking':
          return await this.createBooking(args, context);

        case 'cancel_booking':
          return await this.cancelBooking(args);

        case 'transfer_to_human':
          return await this.transferToHuman(args, context);

        case 'send_whatsapp_confirmation':
          return await this.sendWhatsAppConfirmation(args);

        default:
          return this.errorResult(`Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const message = Object.values(error.flatten().fieldErrors)
          .flat()
          .filter(Boolean)
          .join('; ');
        return this.errorResult(message || 'Validation failed');
      }

      const message = error instanceof Error ? error.message : 'Tool execution failed';
      logger.warn('Tool execution failed', {
        callSid: context.callSid,
        name,
        error: message,
      });
      return this.errorResult(message);
    }
  }

  private async checkRoomAvailability(args: unknown): Promise<string> {
    const input = checkAvailabilitySchema.parse(args);
    const result = await roomService.checkAvailability(input);

    if (result.availableRooms.length === 0) {
      return JSON.stringify({
        success: true,
        ...result,
        message: 'No rooms are available for the requested dates and guest count.',
      });
    }

    return JSON.stringify({
      success: true,
      ...result,
      message: `Found ${result.availableRooms.length} available room(s).`,
    });
  }

  private async createBooking(args: unknown, context: ToolExecutionContext): Promise<string> {
    const input = createBookingSchema.parse(args);
    const booking = await bookingService.createBooking(input, context.callId);
    const whatsapp = await maybeSendBookingConfirmation(booking.bookingId);

    return JSON.stringify({
      success: true,
      bookingId: booking.bookingId,
      guestName: booking.guestName,
      roomType: booking.roomType,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      totalPrice: booking.totalPrice,
      nights: booking.nights,
      whatsappSent: Boolean(whatsapp?.sent),
      whatsappTo: whatsapp?.to ?? null,
      message: whatsapp?.sent
        ? `Reservation confirmed. Booking ID is ${booking.bookingId}. WhatsApp confirmation sent to ${whatsapp.to}.`
        : `Reservation confirmed. Booking ID is ${booking.bookingId}.`,
    });
  }

  private async cancelBooking(args: unknown): Promise<string> {
    const input = cancelBookingSchema.parse(args);
    const result = await bookingService.cancelBooking(input);
    const whatsapp =
      result.status === 'cancelled'
        ? await maybeSendBookingCancellation(result.bookingId)
        : null;

    return JSON.stringify({
      success: true,
      ...result,
      whatsappSent: Boolean(whatsapp?.sent),
      message:
        result.status === 'already_cancelled'
          ? `Booking ${result.bookingId} was already cancelled.`
          : whatsapp?.sent
            ? `Booking ${result.bookingId} has been cancelled. WhatsApp notification sent.`
            : `Booking ${result.bookingId} has been cancelled.`,
    });
  }

  private async transferToHuman(
    args: unknown,
    context: ToolExecutionContext
  ): Promise<string> {
    const input = transferToHumanSchema.parse(args);

    if (context.callSid.startsWith('web_')) {
      return JSON.stringify({
        success: false,
        transferred: false,
        reason: input.reason,
        message: 'Cannot transfer web calls to a human receptionist.',
      });
    }

    await twilioService.transferCall(context.callSid);

    await callRepository.updateByCallSid(context.callSid, {
      status: CallStatus.TRANSFERRED,
      endTime: new Date(),
    });

    if (this.sessionEndHandler) {
      await this.sessionEndHandler(context.callSid);
    }

    return JSON.stringify({
      success: true,
      transferred: true,
      reason: input.reason,
      message: 'The guest is being transferred to a human receptionist now.',
    });
  }

  private async sendWhatsAppConfirmation(args: unknown): Promise<string> {
    const input = sendWhatsAppSchema.parse(args);
    const result = await whatsAppService.sendBookingConfirmation(input.bookingId);

    return JSON.stringify({
      success: true,
      ...result,
      message: `WhatsApp confirmation sent to ${result.to}.`,
    });
  }

  private errorResult(message: string): string {
    return JSON.stringify({ success: false, error: message });
  }
}

export const toolExecutorService = new ToolExecutorService();
