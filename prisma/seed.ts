import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rooms = [
  { name: 'Deluxe Room', price: 8500, capacity: 2, available: true },
  { name: 'Sea View Room', price: 12000, capacity: 2, available: true },
  { name: 'Luxury Suite', price: 18000, capacity: 4, available: true },
];

async function main() {
  console.log('Seeding database...');

  for (const room of rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: room,
      create: room,
    });
  }

  console.log(`Seeded ${rooms.length} rooms.`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
