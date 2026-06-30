/**
 * Custom seed — reads 5 restaurants from customer-app/data.xlsx
 * including menu-item images extracted by extract-excel-images.js
 *
 * Run:
 *   node prisma/extract-excel-images.js   ← extract images first (once)
 *   npm run db:seed-custom                ← then seed the DB
 *
 * Every run wipes these 5 restaurants then recreates them from scratch.
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

const EXCEL_PATH    = path.resolve(__dirname, '../../customer-app/data.xlsx');
const CUSTOM_IMG_DIR = path.resolve(__dirname, '../uploads/custom');

// ── Per-restaurant metadata (not in Excel) ────────────────────────────────────
const META: Record<string, {
  address: string; lat: number; lng: number;
  phone: string; phone_owner: string; name_owner: string;
  category: string; storeType: string;
  deliveryFee: number; minOrder: number; deliveryTime: number;
}> = {
  "Restaurant O'délice": {
    address: 'Tevragh Zeina, Nouakchott',
    lat: 18.094, lng: -15.975,
    phone: '+22230000001', phone_owner: '+22230000001', name_owner: "Gérant O'délice",
    category: 'fast_food', storeType: 'FOOD',
    deliveryFee: 50, minOrder: 200, deliveryTime: 25,
  },
  'Restaurant Ochoix': {
    address: 'Ksar, Avenue Kennedy, Nouakchott',
    lat: 18.079, lng: -15.965,
    phone: '+22230000002', phone_owner: '+22230000002', name_owner: 'Gérant Ochoix',
    category: 'fast_food', storeType: 'FOOD',
    deliveryFee: 45, minOrder: 200, deliveryTime: 30,
  },
  'Restaurant Victoria': {
    address: 'Dar Naim, Route de Rosso, Nouakchott',
    lat: 18.056, lng: -15.952,
    phone: '+22230000003', phone_owner: '+22230000003', name_owner: 'Gérant Victoria',
    category: 'restaurants', storeType: 'FOOD',
    deliveryFee: 40, minOrder: 150, deliveryTime: 25,
  },
  'Mondial Pizza': {
    address: 'Socogim Port, Nouakchott',
    lat: 18.070, lng: -15.985,
    phone: '+22230000004', phone_owner: '+22230000004', name_owner: 'Gérant Mondial Pizza',
    category: 'pizza', storeType: 'FOOD',
    deliveryFee: 55, minOrder: 200, deliveryTime: 30,
  },
  "Bk's burger": {
    address: 'Centre Ville, Nouakchott',
    lat: 18.087, lng: -15.971,
    phone: '+22230000005', phone_owner: '+22230000005', name_owner: "Gérant Bk's Burger",
    category: 'fast_food', storeType: 'FOOD',
    deliveryFee: 50, minOrder: 200, deliveryTime: 20,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function slugify(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function localImagePath(stem: string): string | null {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    if (fs.existsSync(path.join(CUSTOM_IMG_DIR, `${stem}.${ext}`)))
      return `/uploads/custom/${stem}.${ext}`;
  }
  return null;
}

// ── Excel parser (with row tracking for image lookup) ─────────────────────────
interface ParsedItem     { name: string; price: number; row: number }
interface ParsedCategory { name: string; items: ParsedItem[] }
interface ParsedRestaurant { name: string; slug: string; categories: ParsedCategory[] }

function parseExcel(): ParsedRestaurant[] {
  const wb = XLSX.readFile(EXCEL_PATH);
  return wb.SheetNames.map(sheetName => {
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1, defval: null,
    });

    const name = ((rows[0]?.[0] as string) ?? sheetName).trim();
    const slug = slugify(name);
    const categoryMap = new Map<string, ParsedItem[]>();

    for (let i = 2; i < rows.length; i++) {
      const row     = rows[i];
      const itemName = (row[1] as string | null)?.trim();
      const rawPrice = row[2];
      const catName  = (row[3] as string | null)?.trim();

      if (!itemName || !rawPrice || !catName) continue;
      const price = Number(rawPrice);
      if (!isFinite(price) || price <= 0) continue;

      if (!categoryMap.has(catName)) categoryMap.set(catName, []);
      categoryMap.get(catName)!.push({ name: itemName, price, row: i });
    }

    return {
      name,
      slug,
      categories: Array.from(categoryMap.entries())
        .map(([catName, items]) => ({ name: catName, items })),
    };
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  Custom seed — loading from Excel…\n');

  const hash   = await bcrypt.hash('password123', 10);
  const parsed = parseExcel();
  const names  = parsed.map(r => r.name);

  // ── Delete old data ──────────────────────────────────────────────────────
  console.log('🗑   Cleaning old restaurants…');
  const oldRestaurants = await prisma.restaurant.findMany({
    where: { name: { in: names } },
    select: { id: true },
  });
  const oldIds = oldRestaurants.map(r => r.id);

  if (oldIds.length > 0) {
    const orderIds = (await prisma.order.findMany({
      where: { restaurantId: { in: oldIds } },
      select: { id: true },
    })).map(o => o.id);

    if (orderIds.length > 0) {
      await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.couponRedemption.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    await prisma.restaurant.deleteMany({ where: { id: { in: oldIds } } });
    console.log(`   Deleted ${oldIds.length} restaurant(s) and their menus\n`);
  } else {
    console.log('   Nothing to delete (first run)\n');
  }

  // ── Insert restaurants ────────────────────────────────────────────────────
  let totalCategories = 0;
  let totalItems      = 0;
  let totalImages     = 0;

  for (const resto of parsed) {
    const meta = META[resto.name] ?? {
      address: 'Nouakchott', lat: 18.0735, lng: -15.9582,
      phone: '+22230000099', phone_owner: '+22230000099', name_owner: 'Propriétaire',
      category: 'restaurants', storeType: 'FOOD',
      deliveryFee: 50, minOrder: 200, deliveryTime: 30,
    };

    const { slug } = resto;
    const logo  = localImagePath(`${slug}-logo`);
    // Use logo as cover too if no dedicated cover exists
    const cover = localImagePath(`${slug}-cover`) ?? logo;

    const owner = await prisma.user.upsert({
      where:  { phone: meta.phone_owner },
      update: {},
      create: {
        phone:    meta.phone_owner,
        name:     meta.name_owner,
        role:     'RESTAURANT_OWNER',
        password: hash,
      },
    });

    await prisma.restaurant.deleteMany({ where: { ownerId: owner.id } });

    const restaurant = await prisma.restaurant.create({
      data: {
        ownerId:      owner.id,
        name:         resto.name,
        storeType:    meta.storeType,
        category:     meta.category,
        logo,
        coverImage:   cover,
        address:      meta.address,
        lat:          meta.lat,
        lng:          meta.lng,
        phone:        meta.phone,
        deliveryFee:  meta.deliveryFee,
        minOrder:     meta.minOrder,
        deliveryTime: meta.deliveryTime,
        rating:       5.0,
        isOpen:       true,
        isActive:     true,
      },
    });

    let restoImages = logo ? 1 : 0;

    for (let ci = 0; ci < resto.categories.length; ci++) {
      const cat = resto.categories[ci];
      const category = await prisma.menuCategory.create({
        data: { restaurantId: restaurant.id, name: cat.name, sortOrder: ci },
      });

      for (const item of cat.items) {
        const image = localImagePath(`${slug}-item-${item.row}`);
        if (image) restoImages++;
        await prisma.menuItem.create({
          data: {
            categoryId:  category.id,
            name:        item.name,
            price:       item.price,
            image,
            isAvailable: true,
          },
        });
      }

      totalItems += cat.items.length;
    }

    totalCategories += resto.categories.length;
    totalImages     += restoImages;

    const itemCount = resto.categories.reduce((s, c) => s + c.items.length, 0);
    const logoMark  = logo ? '🖼' : '○';
    console.log(`  ✓ ${resto.name}  ${logoMark}`);
    console.log(`    ${resto.categories.length} categories · ${itemCount} items · ${restoImages} images`);
  }

  console.log('\n✅  Custom seed complete:');
  console.log(`    ${parsed.length} restaurants | ${totalCategories} categories | ${totalItems} items | ${totalImages} images`);
  console.log('\n    Owner phones (password: password123):');
  parsed.forEach(r => {
    const m = META[r.name];
    if (m) console.log(`      ${m.phone_owner}  →  ${r.name}`);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
