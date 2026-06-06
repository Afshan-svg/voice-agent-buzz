import { Room } from '@prisma/client';
import { prisma } from '../config/database';

export class RoomRepository {
  async findAllAvailable(minCapacity?: number): Promise<Room[]> {
    return prisma.room.findMany({
      where: {
        available: true,
        ...(minCapacity !== undefined ? { capacity: { gte: minCapacity } } : {}),
      },
      orderBy: { price: 'asc' },
    });
  }

  async findByName(name: string): Promise<Room | null> {
    return prisma.room.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
    });
  }

  async findAll(): Promise<Room[]> {
    return prisma.room.findMany({ orderBy: { price: 'asc' } });
  }
}

export const roomRepository = new RoomRepository();
