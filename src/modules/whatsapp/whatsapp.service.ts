import { WhatsAppMessageStatus, WhatsAppMessageType } from '@prisma/client';
import { twilioService } from '../../integrations/twilio/twilio.service';
import { env } from '../../config/env';
import { whatsAppRepository } from '../../repositories/whatsapp.repository';
import { buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { formatPhoneNumber, toWhatsAppAddress } from '../../utils/phone';
import { AppError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { bookingService } from '../bookings/booking.service';
import {
  buildBookingCancellationMessage,
  buildBookingConfirmationMessage,
} from './whatsapp.templates';

export interface SendWhatsAppResult {
  id: string;
  messageSid: string | null;
  sent: boolean;
  to: string;
  bookingId: string;
  messageType: WhatsAppMessageType;
  status: WhatsAppMessageStatus;
}

export class WhatsAppService {
  private mapTwilioStatus(status: string): WhatsAppMessageStatus {
    const statusMap: Record<string, WhatsAppMessageStatus> = {
      queued: WhatsAppMessageStatus.QUEUED,
      sending: WhatsAppMessageStatus.QUEUED,
      sent: WhatsAppMessageStatus.SENT,
      delivered: WhatsAppMessageStatus.DELIVERED,
      failed: WhatsAppMessageStatus.FAILED,
      undelivered: WhatsAppMessageStatus.UNDELIVERED,
      read: WhatsAppMessageStatus.READ,
    };

    return statusMap[status.toLowerCase()] ?? WhatsAppMessageStatus.SENT;
  }

  async sendBookingConfirmation(bookingId: string): Promise<SendWhatsAppResult> {
    const booking = await bookingService.getBookingForWhatsApp(bookingId);
    const to = formatPhoneNumber(booking.phone);
    const message = buildBookingConfirmationMessage(booking);

    return this.sendMessage({
      bookingId: booking.bookingId,
      toPhone: to,
      messageType: WhatsAppMessageType.BOOKING_CONFIRMATION,
      body: message,
    });
  }

  async sendBookingCancellation(bookingId: string): Promise<SendWhatsAppResult> {
    const booking = await bookingService.getBookingById(bookingId);

    if (!booking) {
      throw new AppError(404, `Booking ${bookingId} was not found`);
    }

    const to = formatPhoneNumber(booking.phone);
    const message = buildBookingCancellationMessage(booking);

    return this.sendMessage({
      bookingId: booking.bookingId,
      toPhone: to,
      messageType: WhatsAppMessageType.BOOKING_CANCELLATION,
      body: message,
    });
  }

  async handleDeliveryStatus(payload: {
    MessageSid: string;
    MessageStatus: string;
    ErrorCode?: string;
    ErrorMessage?: string;
  }): Promise<void> {
    const record = await whatsAppRepository.findByMessageSid(payload.MessageSid);

    if (!record) {
      logger.warn('WhatsApp status callback for unknown message', {
        messageSid: payload.MessageSid,
        status: payload.MessageStatus,
      });
      return;
    }

    const status = this.mapTwilioStatus(payload.MessageStatus);
    const errorMessage =
      payload.ErrorMessage ??
      (payload.ErrorCode ? `Twilio error code ${payload.ErrorCode}` : undefined);

    await whatsAppRepository.updateById(record.id, {
      status,
      ...(errorMessage ? { errorMessage } : {}),
    });

    logger.info('WhatsApp message status updated', {
      messageSid: payload.MessageSid,
      status,
    });
  }

  async listMessages(
    page: number,
    limit: number,
    filters?: { bookingId?: string; status?: WhatsAppMessageStatus }
  ): Promise<PaginatedResult<ReturnType<typeof this.serializeMessage>>> {
    const { messages, total } = await whatsAppRepository.findMany(
      {
        ...(filters?.bookingId ? { bookingId: filters.bookingId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
      },
      page,
      limit
    );

    return buildPaginatedResult(
      messages.map((message) => this.serializeMessage(message)),
      total,
      page,
      limit
    );
  }

  async getMessage(id: string) {
    const message = await whatsAppRepository.findById(id);

    if (!message) {
      throw new AppError(404, 'WhatsApp message not found');
    }

    return this.serializeMessage(message);
  }

  private async sendMessage(input: {
    bookingId: string;
    toPhone: string;
    messageType: WhatsAppMessageType;
    body: string;
  }): Promise<SendWhatsAppResult> {
    const fromPhone = twilioService.getWhatsAppFromAddress();
    const record = await whatsAppRepository.create({
      bookingId: input.bookingId,
      toPhone: input.toPhone,
      fromPhone,
      messageType: input.messageType,
      body: input.body,
    });

    try {
      const result = await twilioService.sendWhatsAppMessage(
        toWhatsAppAddress(input.toPhone),
        input.body
      );

      const updated = await whatsAppRepository.updateById(record.id, {
        messageSid: result.messageSid,
        status: this.mapTwilioStatus(result.status),
      });

      logger.info('WhatsApp message queued', {
        id: updated.id,
        bookingId: input.bookingId,
        messageSid: result.messageSid,
        to: input.toPhone,
        type: input.messageType,
      });

      return {
        id: updated.id,
        messageSid: updated.messageSid,
        sent: true,
        to: input.toPhone,
        bookingId: input.bookingId,
        messageType: input.messageType,
        status: updated.status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'WhatsApp send failed';

      await whatsAppRepository.updateById(record.id, {
        status: WhatsAppMessageStatus.FAILED,
        errorMessage,
      });

      throw error;
    }
  }

  private serializeMessage(message: {
    id: string;
    messageSid: string | null;
    bookingId: string | null;
    toPhone: string;
    fromPhone: string;
    messageType: WhatsAppMessageType;
    body: string;
    status: WhatsAppMessageStatus;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    booking?: {
      bookingId: string;
      guestName: string;
      status: string;
    } | null;
  }) {
    return {
      id: message.id,
      messageSid: message.messageSid,
      bookingId: message.bookingId,
      toPhone: message.toPhone,
      fromPhone: message.fromPhone,
      messageType: message.messageType,
      body: message.body,
      status: message.status,
      errorMessage: message.errorMessage,
      booking: message.booking ?? null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }
}

export const whatsAppService = new WhatsAppService();

export async function maybeSendBookingConfirmation(bookingId: string): Promise<SendWhatsAppResult | null> {
  if (!env.WHATSAPP_AUTO_SEND_CONFIRMATION) {
    return null;
  }

  try {
    return await whatsAppService.sendBookingConfirmation(bookingId);
  } catch (error) {
    logger.warn('Auto WhatsApp confirmation failed', {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function maybeSendBookingCancellation(bookingId: string): Promise<SendWhatsAppResult | null> {
  if (!env.WHATSAPP_AUTO_SEND_CANCELLATION) {
    return null;
  }

  try {
    return await whatsAppService.sendBookingCancellation(bookingId);
  } catch (error) {
    logger.warn('Auto WhatsApp cancellation failed', {
      bookingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
