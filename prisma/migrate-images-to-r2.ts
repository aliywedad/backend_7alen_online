import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const R2_PUBLIC_URL = 'https://pub-5104de0257b04f3fb00e9d639df9a146.r2.dev';
const LOCAL_PREFIX = '/uploads/custom/';

function toR2(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith(LOCAL_PREFIX)) return path;
  const filename = path.slice(LOCAL_PREFIX.length);
  return `${R2_PUBLIC_URL}/${filename}`;
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    select: { id: true, logo: true, coverImage: true },
  });

  for (const r of restaurants) {
    const logo = toR2(r.logo);
    const coverImage = toR2(r.coverImage);
    if (logo !== r.logo || coverImage !== r.coverImage) {
      await prisma.restaurant.update({ where: { id: r.id }, data: { logo, coverImage } });
      console.log(`Restaurant ${r.id}: logo=${logo} cover=${coverImage}`);
    }
  }

  const categories = await prisma.menuCategory.findMany({
    select: { id: true, image: true },
  });

  for (const c of categories) {
    const image = toR2(c.image);
    if (image !== c.image) {
      await prisma.menuCategory.update({ where: { id: c.id }, data: { image } });
      console.log(`MenuCategory ${c.id}: image=${image}`);
    }
  }

  const items = await prisma.menuItem.findMany({
    select: { id: true, image: true },
  });

  for (const item of items) {
    const image = toR2(item.image);
    if (image !== item.image) {
      await prisma.menuItem.update({ where: { id: item.id }, data: { image } });
      console.log(`MenuItem ${item.id}: image=${image}`);
    }
  }

  const banners = await prisma.banner.findMany({
    select: { id: true, image: true },
  });

  for (const b of banners) {
    const image = toR2(b.image);
    if (image !== b.image) {
      await prisma.banner.update({ where: { id: b.id }, data: { image } });
      console.log(`Banner ${b.id}: image=${image}`);
    }
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
