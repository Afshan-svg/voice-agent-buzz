import {
  Prisma,
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client';
import { prisma } from '../config/database';
import { getSkip } from '../utils/pagination';

export class WhatsAppRepository {
  async create(data: {
    bookingId?: string;
    toPhone: string;
    fromPhone: string;
    messageType: WhatsAppMessageType;
    body: string;
  }): Promise<WhatsAppMessage> {
    return prisma.whatsAppMessage.create({
      data: {
        bookingId: data.bookingId,
        toPhone: data.toPhone,
        fromPhone: data.fromPhone,
        messageType: data.messageType,
        body: data.body,
        status: WhatsAppMessageStatus.QUEUED,
      },
    });
  }

  async updateById(
    id: string,
    data: Prisma.WhatsAppMessageUpdateInput
  ): Promise<WhatsAppMessage> {
    return prisma.whatsAppMessage.update({
      where: { id },
      data,
    });
  }

  async findByMessageSid(messageSid: string): Promise<WhatsAppMessage | null> {
    return prisma.whatsAppMessage.findUnique({
      where: { messageSid },
    });
  }

  async findById(id: string): Promise<WhatsAppMessage | null> {
    return prisma.whatsAppMessage.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            bookingId: true,
            guestName: true,
            status: true,
          },
        },
      },
    });
  }

  async findMany(
    where: Prisma.WhatsAppMessageWhereInput,
    page: number,
    limit: number
  ): Promise<{ messages: WhatsAppMessage[]; total: number }> {
    const skip = getSkip(page, limit);

    const [messages, total] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.whatsAppMessage.count({ where }),
    ]);

    return { messages, total };
  }
}

export const whatsAppRepository = new WhatsAppRepository();
