import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { addClient, removeClient } from '../lib/sseManager';

function absUrl(req: Request, value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${req.protocol}://${req.get('host')}${value}`;
}


export async function getRestaurants(req: Request, res: Response) {
  try {
    const { category, storeType, search, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { isActive: true };
    if (category)  where.category  = category;
    if (storeType) where.storeType = storeType;
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { nameAr: { contains: search as string } },
      ];
    }

    const [restaurants, total] = await Promise.all([
      prisma.restaurant.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        select: {
          id: true, name: true, nameAr: true, category: true, storeType: true, logo: true,
          coverImage: true, address: true, deliveryFee: true, deliveryTime: true,
          rating: true, minOrder: true, isOpen: true, lat: true, lng: true,
        },
        orderBy: [{ isOpen: 'desc' }, { rating: 'desc' }],
      }),
      prisma.restaurant.count({ where }),
    ]);

    const resolved = restaurants.map(r => ({
      ...r,
      logo:       absUrl(req, r.logo),
      coverImage: absUrl(req, r.coverImage),
    }));
    res.json({ restaurants: resolved, total, page: parseInt(page as string) });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getRestaurant(req: Request, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      include: {
        categories: {
          include: { items: { where: { isAvailable: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const resolved = {
      ...restaurant,
      logo:       absUrl(req, restaurant.logo),
      coverImage: absUrl(req, restaurant.coverImage),
      categories: restaurant.categories.map(cat => ({
        ...cat,
        image: absUrl(req, cat.image),
        items: cat.items.map(item => ({
          ...item,
          image: absUrl(req, item.image),
        })),
      })),
    };
    res.json({ restaurant: resolved });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCategories(req: Request, res: Response) {
  const base = `${req.protocol}://${req.get('host')}`;
  const categories = [
    { key: 'FOOD',        label: 'Food',           image: `${base}/logos/food.png`, active: true },
    { key: 'GROCERY',     label: 'Grocery',        image: `${base}/logos/gros.png`, active: false },
    { key: 'PHARMACY',    label: 'Pharmacy',       image: `${base}/logos/meds.png`, active: true },
    { key: '__package__', label: 'Send a Package', image: `${base}/logos/pack.png`, active: true },
  ];
  res.json({ categories });
}

export async function createRestaurant(req: any, res: Response) {
  try {
    const { name, nameAr, description, category, address, lat, lng, phone, deliveryFee, minOrder, deliveryTime } = req.body;

    if (!name || !category || !address || !phone) {
      return res.status(400).json({ error: 'Name, category, address and phone are required' });
    }

    const parsedLat = Number.isFinite(Number(lat)) ? Number(lat) : 18.0735;
    const parsedLng = Number.isFinite(Number(lng)) ? Number(lng) : -15.9582;
    const parsedDeliveryFee = Number.isFinite(Number(deliveryFee)) ? Number(deliveryFee) : 50;
    const parsedMinOrder = Number.isFinite(Number(minOrder)) ? Number(minOrder) : 200;
    const parsedDeliveryTime = Number.isFinite(Number(deliveryTime)) ? Number(deliveryTime) : 30;

    const restaurant = await prisma.$transaction(async (tx) => {
      const created = await tx.restaurant.create({
        data: {
          ownerId: req.user.id,
          name, nameAr, description, category, address,
          lat: parsedLat, lng: parsedLng,
          phone,
          deliveryFee: parsedDeliveryFee,
          minOrder: parsedMinOrder,
          deliveryTime: parsedDeliveryTime,
        },
      });

      await tx.user.update({
        where: { id: req.user.id },
        data: { role: 'RESTAURANT_OWNER' },
      });

      return created;
    });

    res.status(201).json({ restaurant });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'This account already has a restaurant' });
    }
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getMyRestaurant(req: any, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { ownerId: req.user.id },
      include: {
        categories: { include: { items: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const resolved = {
      ...restaurant,
      logo:       absUrl(req, restaurant.logo),
      coverImage: absUrl(req, restaurant.coverImage),
      categories: restaurant.categories.map(cat => ({
        ...cat,
        image: absUrl(req, cat.image),
        items: cat.items.map(item => ({ ...item, image: absUrl(req, item.image) })),
      })),
    };
    res.json({ restaurant: resolved });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function addMenuCategory(req: any, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.id } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: req.body.name,
        nameAr: req.body.nameAr,
        image: req.body.image,
        sortOrder: req.body.sortOrder || 0,
      },
    });
    res.status(201).json({ category });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function addMenuItem(req: any, res: Response) {
  try {
    const { categoryId, name, nameAr, description, price, image } = req.body;
    const item = await prisma.menuItem.create({
      data: { categoryId, name, nameAr, description, price: parseFloat(price), image },
    });
    res.status(201).json({ item });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateRestaurant(req: any, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.id } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const { isOpen, name, nameAr, description, phone, deliveryFee, minOrder, deliveryTime, logo, coverImage } = req.body;
    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        ...(isOpen !== undefined && { isOpen }),
        ...(name && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(description !== undefined && { description }),
        ...(phone && { phone }),
        ...(deliveryFee !== undefined && { deliveryFee: parseFloat(deliveryFee) }),
        ...(minOrder !== undefined && { minOrder: parseFloat(minOrder) }),
        ...(deliveryTime !== undefined && { deliveryTime: parseInt(deliveryTime) }),
        ...(logo !== undefined && { logo }),
        ...(coverImage !== undefined && { coverImage }),
      },
    });
    res.json({ restaurant: updated });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getMyOrders(req: any, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.id } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const { status } = req.query;
    const where: any = { restaurantId: restaurant.id };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        items: { include: { menuItem: { select: { name: true, nameAr: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateMenuItem(req: any, res: Response) {
  try {
    const { name, nameAr, description, price, isAvailable, image } = req.body;
    const item = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(isAvailable !== undefined && { isAvailable }),
        ...(image !== undefined && { image }),
      },
    });
    res.json({ item });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteMenuItem(req: any, res: Response) {
  try {
    await prisma.menuItem.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteMenuCategory(req: any, res: Response) {
  try {
    await prisma.menuCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function streamMyOrders(req: any, res: Response) {
  try {
    const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: req.user.id } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(':ping\n\n');

    addClient(restaurant.id, res);

    console.log(`[SSE] ✅ Connected   | userId: ${req.user.id} | restaurant: "${restaurant.name}" (${restaurant.id})`);

    const heartbeat = setInterval(() => {
      try { res.write(':ping\n\n'); } catch { /* ignore */ }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(restaurant.id, res);
      console.log(`[SSE] ❌ Disconnected | userId: ${req.user.id} | restaurant: "${restaurant.name}" (${restaurant.id})`);
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
