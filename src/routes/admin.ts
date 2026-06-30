import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, requirePermission } from '../middleware/auth';
import {
  adminCreateCoupon,
  adminDeleteCoupon,
  adminListCoupons,
  adminUpdateCoupon,
} from '../controllers/couponController';
import {
  adminCreateNotification,
  adminDeleteNotification,
  adminListNotifications,
} from '../controllers/notificationController';
import {
  adminCreateBanner,
  adminDeleteBanner,
  adminListBanners,
  adminUpdateBanner,
} from '../controllers/bannerController';
import { adminAdjustWallet } from '../controllers/walletController';
import { ensureSettingsSeeded, listSettings, upsertSetting } from '../services/settings';
import { logAction } from '../lib/audit';
import bcrypt from 'bcryptjs';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'SUPERADMIN'));

// Per-section permission guards (SUPERADMIN bypasses all; ADMIN needs explicit grant)
router.use('/users',         requirePermission('users'));
router.use('/restaurants',   requirePermission('restaurants'));
router.use('/drivers',       requirePermission('drivers'));
router.use('/orders',        requirePermission('orders'));
router.use('/courier',       requirePermission('courier'));
router.use('/coupons',       requirePermission('coupons'));
router.use('/banners',       requirePermission('banners'));
router.use('/notifications', requirePermission('notifications'));
router.use('/wallet',        requirePermission('users'));
router.use('/reviews',       requirePermission('reviews'));
router.use('/settings',      requirePermission('settings'));
router.use('/analytics',         requirePermission('analytics'));
router.use('/whatsapp-messages', requirePermission('settings'));

const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
const COURIER_STATUSES = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
const USER_ROLES = ['ADMIN', 'SUPERADMIN', 'CUSTOMER', 'DRIVER', 'RESTAURANT_OWNER'];

router.get('/stats', async (_, res: Response) => {
  try {
    const [
      users,
      customers,
      drivers,
      restaurants,
      activeRestaurants,
      orders,
      pendingOrders,
      deliveredOrders,
      courierRequests,
      pendingCourierRequests,
      onlineDrivers,
      revenue,
      deliveryFees,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.driverProfile.count(),
      prisma.restaurant.count(),
      prisma.restaurant.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'DELIVERED' } }),
      prisma.courierRequest.count(),
      prisma.courierRequest.count({ where: { status: 'PENDING' } }),
      prisma.driverProfile.count({ where: { isOnline: true } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { deliveryFee: true } }),
    ]);

    res.json({
      users,
      customers,
      drivers,
      restaurants,
      activeRestaurants,
      orders,
      pendingOrders,
      deliveredOrders,
      courierRequests,
      pendingCourierRequests,
      onlineDrivers,
      revenue: revenue._sum.total || 0,
      deliveryFees: deliveryFees._sum.deliveryFee || 0,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', async (req: any, res: Response) => {
  try {
    const { role, search } = req.query;
    const where: any = {};
    if (role && role !== 'ALL') where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { phone: { contains: String(search) } },
        { email: { contains: String(search) } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        adminPermissions: true,
        createdAt: true,
        restaurant: { select: { id: true, name: true, isActive: true } },
        driverProfile: { select: { id: true, vehicleType: true, vehiclePlate: true, isOnline: true, rating: true, totalDeliveries: true, earnings: true } },
        _count: { select: { orders: true, courierRequests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ users: users.map(u => ({ ...u, adminPermissions: u.adminPermissions ? JSON.parse(u.adminPermissions) : [] })) });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id', async (req: any, res: Response) => {
  try {
    const { isActive, role, name, email, adminPermissions } = req.body;
    const isSuperAdmin = req.user?.role === 'SUPERADMIN';

    if (role && !USER_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if ((role === 'SUPERADMIN' || adminPermissions !== undefined) && !isSuperAdmin) {
      return res.status(403).json({ error: 'Only SUPERADMIN can set adminPermissions or assign SUPERADMIN role' });
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(role && { role }),
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(adminPermissions !== undefined && { adminPermissions: JSON.stringify(adminPermissions) }),
      },
      select: { id: true, phone: true, name: true, email: true, role: true, isActive: true, adminPermissions: true },
    });

    const changes: Record<string, unknown> = {};
    if (isActive  !== undefined)       changes['isActive']          = isActive;
    if (role)                          changes['role']              = role;
    if (adminPermissions !== undefined) changes['adminPermissions'] = adminPermissions;
    logAction(req.user.id, 'UPDATE', 'users', { resourceId: user.id, resourceName: user.name, details: changes });

    res.json({ user: { ...user, adminPermissions: user.adminPermissions ? JSON.parse(user.adminPermissions) : [] } });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/restaurants', async (req: any, res: Response) => {
  try {
    const { search, status } = req.query;
    const where: any = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: String(search) } },
        { phone: { contains: String(search) } },
        { address: { contains: String(search) } },
      ];
    }

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { name: true, phone: true, isActive: true } },
        _count: { select: { orders: true, categories: true, favorites: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ restaurants });
  } catch (error) {
    console.error('Admin restaurants error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/restaurants', async (req: any, res: Response) => {
  try {
    const {
      name, nameAr, description, category, storeType = 'FOOD',
      address, lat, lng, phone, deliveryFee, minOrder, deliveryTime,
      ownerName, ownerPhone, ownerPassword,
    } = req.body;

    if (!name || !category || !address || !phone || !ownerName || !ownerPhone || !ownerPassword) {
      return res.status(400).json({ error: 'name, category, address, phone, ownerName, ownerPhone, ownerPassword are required' });
    }

    const existing = await prisma.user.findUnique({ where: { phone: String(ownerPhone) } });
    if (existing) return res.status(409).json({ error: 'A user with that phone number already exists' });

    const hashed = await bcrypt.hash(String(ownerPassword), 10);

    const { owner, restaurant } = await prisma.$transaction(async (tx) => {
      const owner = await tx.user.create({
        data: { name: String(ownerName), phone: String(ownerPhone), password: hashed, role: 'RESTAURANT_OWNER' },
      });
      const restaurant = await tx.restaurant.create({
        data: {
          ownerId:      owner.id,
          name:         String(name),
          nameAr:       nameAr       ? String(nameAr)       : null,
          description:  description  ? String(description)  : null,
          category:     String(category),
          storeType:    String(storeType),
          address:      String(address),
          lat:          lat  !== undefined ? Number(lat)  : 18.0735,
          lng:          lng  !== undefined ? Number(lng)  : -15.9582,
          phone:        String(phone),
          deliveryFee:  deliveryFee  !== undefined ? Number(deliveryFee)  : 50,
          minOrder:     minOrder     !== undefined ? Number(minOrder)     : 200,
          deliveryTime: deliveryTime !== undefined ? Number(deliveryTime) : 30,
        },
        include: { owner: { select: { name: true, phone: true } } },
      });
      return { owner, restaurant };
    });

    logAction(req.user.id, 'CREATE', 'restaurants', {
      resourceId: restaurant.id, resourceName: restaurant.name,
      details: { ownerPhone: owner.phone },
    });
    res.status(201).json({ restaurant, owner: { id: owner.id, name: owner.name, phone: owner.phone } });
  } catch (error) {
    console.error('Admin create restaurant error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/restaurants/:id', async (req: any, res: Response) => {
  try {
    const {
      isActive, isOpen, deliveryFee, minOrder, deliveryTime,
      name, nameAr, description, address, phone, category, storeType, logo,
    } = req.body;
    const restaurant = await prisma.restaurant.update({
      where: { id: req.params.id },
      data: {
        ...(isActive     !== undefined && { isActive: Boolean(isActive) }),
        ...(isOpen       !== undefined && { isOpen: Boolean(isOpen) }),
        ...(deliveryFee  !== undefined && { deliveryFee:  Number(deliveryFee) }),
        ...(minOrder     !== undefined && { minOrder:     Number(minOrder) }),
        ...(deliveryTime !== undefined && { deliveryTime: Number(deliveryTime) }),
        ...(name        && { name }),
        ...(nameAr      !== undefined && { nameAr:      nameAr      || null }),
        ...(description !== undefined && { description: description || null }),
        ...(address     && { address }),
        ...(phone       && { phone }),
        ...(category    && { category }),
        ...(storeType   && { storeType }),
        ...(logo        !== undefined && { logo: logo || null }),
      },
      include: { owner: { select: { name: true, phone: true } } },
    });
    logAction(req.user.id, 'UPDATE', 'restaurants', { resourceId: restaurant.id, resourceName: restaurant.name, details: req.body as Record<string, unknown> });
    res.json({ restaurant });
  } catch (error) {
    console.error('Admin update restaurant error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/drivers', async (req: any, res: Response) => {
  try {
    const { online } = req.query;
    const where: any = {};
    if (online === 'true') where.isOnline = true;
    if (online === 'false') where.isOnline = false;

    const drivers = await prisma.driverProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, isActive: true, createdAt: true } },
        _count: { select: { orders: true, courierRequests: true } },
      },
      orderBy: [{ isOnline: 'desc' }, { rating: 'desc' }],
    });

    res.json({ drivers });
  } catch (error) {
    console.error('Admin drivers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/drivers/:id', async (req: any, res: Response) => {
  try {
    const { isOnline, vehicleType, vehiclePlate, rating } = req.body;
    const driver = await prisma.driverProfile.update({
      where: { id: req.params.id },
      data: {
        ...(isOnline !== undefined && { isOnline: Boolean(isOnline) }),
        ...(vehicleType !== undefined && { vehicleType }),
        ...(vehiclePlate !== undefined && { vehiclePlate }),
        ...(rating !== undefined && { rating: Number(rating) }),
      },
      include: { user: { select: { id: true, name: true, phone: true, isActive: true } } },
    });
    logAction(req.user.id, 'UPDATE', 'drivers', { resourceId: driver.id, resourceName: driver.user.name, details: req.body as Record<string, unknown> });
    res.json({ driver });
  } catch (error) {
    console.error('Admin update driver error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/orders', async (req: any, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { id: { contains: String(search) } },
        { deliveryAddress: { contains: String(search) } },
        { customer: { name: { contains: String(search) } } },
        { customer: { phone: { contains: String(search) } } },
        { restaurant: { name: { contains: String(search) } } },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        restaurant: { select: { name: true, address: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
        items: { include: { menuItem: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ orders });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/orders/:id/status', async (req: any, res: Response) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        customer: { select: { name: true, phone: true } },
        restaurant: { select: { name: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
      },
    });

    logAction(req.user.id, 'UPDATE', 'orders', { resourceId: order.id, resourceName: order.restaurant.name, details: { status } });
    res.json({ order });
  } catch (error) {
    console.error('Admin update order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/courier', async (req: any, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    const requests = await prisma.courierRequest.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ requests });
  } catch (error) {
    console.error('Admin courier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/courier/:id', async (req: any, res: Response) => {
  try {
    const { status, driverId } = req.body;
    if (status && !COURIER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid courier status' });
    }

    const request = await prisma.courierRequest.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(driverId !== undefined && { driverId: driverId || null }),
      },
      include: {
        customer: { select: { name: true, phone: true } },
        driver: { include: { user: { select: { name: true, phone: true } } } },
      },
    });

    logAction(req.user.id, 'UPDATE', 'courier', { resourceId: request.id, resourceName: request.customer.name, details: req.body as Record<string, unknown> });
    res.json({ request });
  } catch (error) {
    console.error('Admin update courier error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/coupons', adminListCoupons);
router.post('/coupons', adminCreateCoupon);
router.patch('/coupons/:id', adminUpdateCoupon);
router.delete('/coupons/:id', adminDeleteCoupon);

router.get('/banners', adminListBanners);
router.post('/banners', adminCreateBanner);
router.patch('/banners/:id', adminUpdateBanner);
router.delete('/banners/:id', adminDeleteBanner);

router.get('/notifications', adminListNotifications);
router.post('/notifications', adminCreateNotification);
router.delete('/notifications/:id', adminDeleteNotification);

router.post('/wallet/adjust', adminAdjustWallet);

router.get('/reviews', async (req: any, res: Response) => {
  try {
    const { restaurantId, driverId, rating } = req.query;
    const where: any = {};
    if (restaurantId) where.restaurantId = String(restaurantId);
    if (driverId) where.driverId = String(driverId);
    if (rating) where.rating = Number(rating);
    const reviews = await prisma.review.findMany({
      where,
      include: {
        user: { select: { name: true, phone: true } },
        restaurant: { select: { name: true } },
        driver: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ reviews });
  } catch (err) {
    console.error('admin reviews error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    await ensureSettingsSeeded();
    const settings = await listSettings();
    res.json({ settings });
  } catch (err) {
    console.error('admin settings error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/settings', async (req: any, res) => {
  try {
    const { entries } = req.body as { entries: { key: string; value: string; category?: string }[] };
    if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries[] required' });
    const results = [];
    for (const entry of entries) {
      if (!entry.key) continue;
      const updated = await upsertSetting(entry.key, String(entry.value ?? ''), entry.category);
      results.push(updated);
    }
    logAction(req.user.id, 'UPDATE', 'settings', { details: { keys: entries.map((e) => e.key) } });
    res.json({ settings: results });
  } catch (err) {
    console.error('admin update settings error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/analytics', async (req: any, res) => {
  try {
    const days = Math.min(60, Math.max(7, Number(req.query.days) || 30));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days + 1);

    const [orders, revenueAgg, topRestaurants, topDrivers, statusBreakdown] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, total: true, status: true, createdAt: true },
      }),
      prisma.order.aggregate({
        where: { status: 'DELIVERED', createdAt: { gte: since } },
        _sum: { total: true, deliveryFee: true, tip: true, discount: true },
        _count: { _all: true },
      }),
      prisma.restaurant.findMany({
        select: { id: true, name: true, totalOrders: true, rating: true, totalRatings: true },
        orderBy: [{ totalOrders: 'desc' }, { rating: 'desc' }],
        take: 5,
      }),
      prisma.driverProfile.findMany({
        select: { id: true, vehicleType: true, vehiclePlate: true, totalDeliveries: true, earnings: true, rating: true, user: { select: { name: true } } },
        orderBy: [{ totalDeliveries: 'desc' }, { rating: 'desc' }],
        take: 5,
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { createdAt: { gte: since } },
      }),
    ]);

    const byDayMap = new Map<string, { date: string; orders: number; revenue: number }>();
    for (let i = 0; i < days; i++) {
      const day = new Date(since);
      day.setDate(since.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      byDayMap.set(key, { date: key, orders: 0, revenue: 0 });
    }
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const bucket = byDayMap.get(key);
      if (bucket) {
        bucket.orders += 1;
        if (order.status === 'DELIVERED') bucket.revenue += order.total;
      }
    }

    res.json({
      range: { days, since },
      summary: {
        deliveredOrders: revenueAgg._count._all,
        revenue: revenueAgg._sum.total || 0,
        deliveryFees: revenueAgg._sum.deliveryFee || 0,
        tips: revenueAgg._sum.tip || 0,
        discounts: revenueAgg._sum.discount || 0,
      },
      byDay: Array.from(byDayMap.values()),
      statusBreakdown: statusBreakdown.map((entry) => ({ status: entry.status, count: entry._count._all })),
      topRestaurants,
      topDrivers,
    });
  } catch (err) {
    console.error('admin analytics error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin menu management ─────────────────────────────────────────────────────

router.get('/restaurants/:id/menu', async (req: any, res: Response) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      include: {
        categories: {
          orderBy: { name: 'asc' },
          include: { items: { orderBy: { name: 'asc' } } },
        },
      },
    });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    res.json({ restaurant });
  } catch (err) {
    console.error('admin menu get error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/restaurants/:id/menu/categories', async (req: any, res: Response) => {
  try {
    const { name, image } = req.body as { name: string; image?: string };
    if (!name) return res.status(400).json({ error: 'name required' });
    const category = await prisma.menuCategory.create({
      data: { name, image: image ?? null, restaurantId: req.params.id },
    });
    logAction(req.user.id, 'CREATE', 'restaurants', { resourceId: category.id, resourceName: name, details: { type: 'menu_category', restaurantId: req.params.id } });
    res.status(201).json({ category });
  } catch (err) {
    console.error('admin create category error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/restaurants/:id/menu/categories/:catId', async (req: any, res: Response) => {
  try {
    await prisma.menuCategory.delete({ where: { id: req.params.catId } });
    logAction(req.user.id, 'DELETE', 'restaurants', { resourceId: req.params.catId, details: { type: 'menu_category', restaurantId: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin delete category error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/restaurants/:id/menu/items', async (req: any, res: Response) => {
  try {
    const { name, description, price, image, categoryId, isAvailable } = req.body as {
      name: string; description?: string; price: number;
      image?: string; categoryId: string; isAvailable?: boolean;
    };
    if (!name || price == null || !categoryId) return res.status(400).json({ error: 'name, price, categoryId required' });
    const item = await prisma.menuItem.create({
      data: { name, description: description ?? null, price: Number(price), image: image ?? null, categoryId, isAvailable: isAvailable ?? true },
    });
    logAction(req.user.id, 'CREATE', 'restaurants', { resourceId: item.id, resourceName: name, details: { type: 'menu_item', price: Number(price), restaurantId: req.params.id } });
    res.status(201).json({ item });
  } catch (err) {
    console.error('admin create item error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/restaurants/:id/menu/items/:itemId', async (req: any, res: Response) => {
  try {
    const { name, description, price, image, categoryId, isAvailable } = req.body as {
      name?: string; description?: string; price?: number;
      image?: string; categoryId?: string; isAvailable?: boolean;
    };
    const item = await prisma.menuItem.update({
      where: { id: req.params.itemId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(image !== undefined && { image }),
        ...(categoryId !== undefined && { categoryId }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
    });
    logAction(req.user.id, 'UPDATE', 'restaurants', { resourceId: item.id, resourceName: item.name, details: { type: 'menu_item', restaurantId: req.params.id } });
    res.json({ item });
  } catch (err) {
    console.error('admin update item error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/restaurants/:id/menu/items/:itemId', async (req: any, res: Response) => {
  try {
    await prisma.menuItem.delete({ where: { id: req.params.itemId } });
    logAction(req.user.id, 'DELETE', 'restaurants', { resourceId: req.params.itemId, details: { type: 'menu_item', restaurantId: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin delete item error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Audit log ─────────────────────────────────────────────────────────────────

router.get('/audit', requireRole('SUPERADMIN'), async (req: any, res: Response) => {
  try {
    const { page, action, adminId, limit = '200' } = req.query as Record<string, string>;
    const where: any = {};
    if (page   && page   !== 'ALL') where.page   = page;
    if (action && action !== 'ALL') where.action  = action;
    if (adminId) where.adminId = adminId;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Number(limit) || 200),
    });

    const adminIds = [...new Set(logs.map((l) => l.adminId))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, role: true },
    });
    const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

    res.json({ logs: logs.map((l) => ({ ...l, admin: adminMap[l.adminId] ?? { id: l.adminId, name: 'Unknown', role: '?' } })) });
  } catch (err) {
    console.error('admin audit error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── WhatsApp message log ──────────────────────────────────────────────────────

router.get('/whatsapp-messages', async (req: any, res: Response) => {
  try {
    const { adminId, recipient, type, limit = '200' } = req.query as Record<string, string>;
    const where: any = {};
    if (adminId)              where.adminId   = adminId === 'SYSTEM' ? null : adminId;
    if (recipient)            where.recipient = { contains: recipient };
    if (type && type !== 'ALL') where.type    = type;

    const messages = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Number(limit) || 200),
    });

    const adminIds = [...new Set(messages.map((m) => m.adminId).filter(Boolean))] as string[];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, role: true },
    });
    const adminMap = Object.fromEntries(admins.map((a) => [a.id, a]));

    res.json({
      messages: messages.map((m) => ({
        ...m,
        admin: m.adminId ? (adminMap[m.adminId] ?? { id: m.adminId, name: 'Unknown', role: '?' }) : null,
      })),
    });
  } catch (err) {
    console.error('admin whatsapp-messages error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
