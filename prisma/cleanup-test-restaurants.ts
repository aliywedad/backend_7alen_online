import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REAL_NAMES = [
  "Restaurant Ochoix",
  "Restaurant O'délice",
  "Restaurant Victoria",
  "Mondial Pizza",
  "Bk's burger",
];

async function main() {
  const real = await prisma.restaurant.findMany({
    where: { name: { in: REAL_NAMES } },
    select: { id: true, name: true },
  });

  console.log('Keeping:', real.map(r => r.name));

  const realIds = real.map(r => r.id);

  const toDelete = await prisma.restaurant.findMany({
    where: { id: { notIn: realIds } },
    select: { id: true, name: true },
  });

  if (toDelete.length === 0) {
    console.log('No test restaurants to delete.');
    return;
  }

  console.log(`Deleting ${toDelete.length} test restaurants:`, toDelete.map(r => r.name));

  const testIds = toDelete.map(r => r.id);

  // Delete orders (not cascaded) and their items
  const orders = await prisma.order.findMany({
    where: { restaurantId: { in: testIds } },
    select: { id: true },
  });
  const orderIds = orders.map(o => o.id);

  if (orderIds.length > 0) {
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    console.log(`Deleted ${orderIds.length} test orders`);
  }

  // Delete restaurants (cascades: MenuCategory → MenuItem, Favorite, Review)
  const result = await prisma.restaurant.deleteMany({
    where: { id: { in: testIds } },
  });

  console.log(`Deleted ${result.count} test restaurants.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
