import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { emitToRestaurant, emitToOrder, emitToDrivers, addOrderClient, removeOrderClient } from '../lib/sseManager';
import { sendPushToUser } from '../lib/pushService';
import { validateCoupon } from '../services/coupons';
import { getBooleanSetting, getNumericSetting } from '../services/settings';


const ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];

const STATUS_PUSH: Record<string, { title: string; body: (ref: string) => string }> = {
  ACCEPTED:         { title: '✅ Order Accepted',      body: (r) => `Great news! Your order #${r} has been accepted and will be prepared shortly.` },
  PREPARING:        { title: '👨‍🍳 Being Prepared',      body: (r) => `Your order #${r} is now being prepared by the restaurant.` },
  READY_FOR_PICKUP: { title: '📦 Ready for Pickup',   body: (r) => `Your order #${r} is packed and waiting for a driver.` },
  PICKED_UP:        { title: '🛵 On the Way!',         body: (r) => `Your order #${r} has been picked up and is on its way to you.` },
  DELIVERED:        { title: '🎉 Delivered!',          body: (r) => `Your order #${r} has been delivered. Enjoy your meal!` },
  CANCELLED:        { title: '❌ Order Cancelled',     body: (r) => `Your order #${r} has been cancelled.` },
};

async function pushNotification(userId: string | null, title: string, body: string, type = 'ORDER', data?: Record<string, unknown>) {
  const notif = await prisma.notification.create({
    data: {
      userId: userId ?? undefined,
      title,
      body,
      type,
      data: data ? JSON.stringify(data) : undefined,
    },
  });
  if (userId) sendPushToUser(userId, title, body, data, type).catch(() => {});
  return notif;
}

export async function createOrder(req: any, res: Response) {
  try {
    const {
      restaurantId,
      items,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      paymentMethod = 'CASH',
      notes,
      couponCode,
      tip = 0,
      walletAmount = 0,
    } = req.body;

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    if (!restaurant.isActive || !restaurant.isOpen) return res.status(400).json({ error: 'Restaurant not accepting orders' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order requires items' });

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: items.map((i: any) => i.menuItemId) } },
    });

    const orderItems = items.map((item: any) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      if (!menuItem) throw new Error(`Item ${item.menuItemId} not found`);
      return { menuItemId: item.menuItemId, quantity: item.quantity, price: menuItem.price, notes: item.notes };
    });

    const subtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    if (subtotal < restaurant.minOrder) {
      return res.status(400).json({ error: `Minimum order ${restaurant.minOrder} MRU not reached` });
    }

    let deliveryFee = restaurant.deliveryFee;
    let discount = 0;
    let couponId: string | null = null;
    let appliedCouponCode: string | null = null;
    let validatedCoupon: Awaited<ReturnType<typeof validateCoupon>> | null = null;

    if (couponCode) {
      validatedCoupon = await validateCoupon(String(couponCode), {
        userId: req.user.id,
        subtotal,
        deliveryFee,
        restaurantId: restaurant.id,
        storeType: restaurant.storeType,
      });
      discount = validatedCoupon.discount;
      couponId = validatedCoupon.coupon.id;
      appliedCouponCode = validatedCoupon.coupon.code;
      if (validatedCoupon.freeDelivery) deliveryFee = 0;
    }

    const tippingEnabled = await getBooleanSetting('tippingEnabled', true);
    const tipValue = tippingEnabled ? Math.max(0, Number(tip) || 0) : 0;

    const walletEnabled = await getBooleanSetting('walletEnabled', true);
    let walletApplied = 0;
    if (walletEnabled && Number(walletAmount) > 0) {
      const me = await prisma.user.findUnique({ where: { id: req.user.id }, select: { walletBalance: true } });
      walletApplied = Math.min(Math.max(0, Number(walletAmount)), me?.walletBalance ?? 0);
    }

    const grossTotal = Math.max(0, subtotal - discount + deliveryFee + tipValue);
    const total = Math.max(0, grossTotal - walletApplied);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          customerId: req.user.id,
          restaurantId,
          deliveryAddress,
          deliveryLat,
          deliveryLng,
          paymentMethod,
          notes,
          subtotal,
          deliveryFee,
          discount,
          tip: tipValue,
          couponId,
          couponCode: appliedCouponCode,
          total,
          estimatedTime: restaurant.deliveryTime,
          items: { create: orderItems },
        },
        include: {
          restaurant: { select: { name: true, logo: true, storeType: true } },
          items: { include: { menuItem: { select: { name: true, nameAr: true } } } },
          customer: { select: { name: true, phone: true } },
        },
      });

      await tx.orderEvent.create({
        data: { orderId: created.id, status: 'PENDING', note: 'Order placed' },
      });

      await tx.restaurant.update({
        where: { id: restaurantId },
        data: { totalOrders: { increment: 1 } },
      });

      if (couponId && validatedCoupon) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponRedemption.create({
          data: {
            couponId,
            userId: req.user.id,
            orderId: created.id,
            amount: validatedCoupon.discount,
          },
        });
      }

      if (walletApplied > 0) {
        await tx.user.update({
          where: { id: req.user.id },
          data: { walletBalance: { decrement: walletApplied } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: req.user.id,
            amount: walletApplied,
            type: 'DEBIT',
            source: 'ORDER',
            reference: created.id,
            note: 'Wallet credit applied to order',
          },
        });
      }

      return created;
    });

    emitToRestaurant(restaurantId, 'new_order', { order });

    // Notifications are best-effort — must not block or skip the SSE emission above
    pushNotification(req.user.id, '🛍️ Order Placed!', `Your order #${order.id.slice(-6).toUpperCase()} has been placed. The restaurant will confirm shortly.`, 'ORDER', { orderId: order.id }).catch(() => {});
    if (restaurant.ownerId) {
      pushNotification(restaurant.ownerId, 'New order', `${order.restaurant.name} received a new order.`, 'ORDER', { orderId: order.id }).catch(() => {});
    }

    res.status(201).json({ order, walletApplied });
  } catch (err: any) {
    console.error('createOrder error', err);
    res.status(400).json({ error: err.message || 'Server error' });
  }
}

export async function getMyOrders(req: any, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: {
        restaurant: { select: { name: true, nameAr: true, logo: true } },
        items: { include: { menuItem: { select: { name: true, nameAr: true, image: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getOrder(req: any, res: Response) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        restaurant: { select: { name: true, nameAr: true, logo: true, phone: true, lat: true, lng: true } },
        driver: { include: { user: { select: { name: true, phone: true, avatar: true } } } },
        items: { include: { menuItem: { select: { name: true, nameAr: true, image: true } } } },
        events: { orderBy: { createdAt: 'asc' } },
        review: true,
      },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (
      order.customerId !== req.user.id &&
      req.user.role !== 'ADMIN' &&
      order.driver?.userId !== req.user.id
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({ order });
  } catch (err) {
    console.error('getOrder error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function awardLoyaltyOnDelivered(order: { id: string; customerId: string; total: number; driverId: string | null; deliveryFee: number; tip: number }) {
  const rate = await getNumericSetting('loyaltyPointsRate', 0.05);
  const points = Math.floor(order.total * rate);
  if (points > 0) {
    await prisma.user.update({
      where: { id: order.customerId },
      data: { loyaltyPoints: { increment: points } },
    });
    await prisma.notification.create({
      data: {
        userId: order.customerId,
        title: 'Loyalty points earned',
        body: `You earned ${points} points for your order.`,
        type: 'PROMO',
      },
    });
  }
  if (order.driverId) {
    const driverEarnings = order.deliveryFee + order.tip;
    await prisma.driverProfile.update({
      where: { id: order.driverId },
      data: {
        earnings: { increment: driverEarnings },
        totalDeliveries: { increment: 1 },
        totalTips: { increment: order.tip },
      },
    });
  }
}

export async function updateOrderStatus(req: any, res: Response) {
  try {
    const { status, note } = req.body;
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: { restaurant: true },
    });

    await prisma.orderEvent.create({ data: { orderId: order.id, status, note } });

    if (status === 'DELIVERED') {
      await awardLoyaltyOnDelivered(order);
    }

    const ref = order.id.slice(-6).toUpperCase();
    const push = STATUS_PUSH[status];
    const customerTitle = push?.title ?? '📋 Order Update';
    const customerBody  = push ? push.body(ref) : `Your order #${ref} is now ${status.replace(/_/g, ' ').toLowerCase()}.`;
    await pushNotification(order.customerId, customerTitle, customerBody, 'ORDER', { orderId: order.id, status });
    if (order.restaurant?.ownerId) {
      await pushNotification(order.restaurant.ownerId, '📋 Order Status', `Order #${ref} is now ${status.replace(/_/g, ' ').toLowerCase()}.`, 'ORDER', { orderId: order.id, status });
    }

    emitToOrder(order.id, 'order_status', { orderId: order.id, status });
    emitToRestaurant(order.restaurant.id, 'order_status', { orderId: order.id, status });

    // Broadcast to all drivers when order is ready for pickup
    if (status === 'READY_FOR_PICKUP') {
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: {
          restaurant: { select: { name: true, address: true, lat: true, lng: true } },
          items: { include: { menuItem: { select: { name: true } } } },
        },
      });
      emitToDrivers('new_delivery_request', {
        orderId: order.id,
        restaurant: fullOrder?.restaurant,
        deliveryAddress: order.deliveryAddress,
        deliveryFee: order.deliveryFee,
        itemCount: fullOrder?.items?.length ?? 0,
        paymentMethod: order.paymentMethod,
      });
    }

    res.json({ order });
  } catch (err) {
    console.error('updateOrderStatus error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function cancelOrder(req: any, res: Response) {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!['PENDING'].includes(order.status)) {
      return res.status(400).json({ error: 'Cannot cancel order at this stage' });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.orderEvent.create({ data: { orderId: updated.id, status: 'CANCELLED', note: 'Cancelled by customer' } });

    emitToOrder(updated.id, 'order_status', { orderId: updated.id, status: 'CANCELLED' });
    emitToRestaurant(updated.restaurantId, 'order_status', { orderId: updated.id, status: 'CANCELLED' });
    res.json({ order: updated });
  } catch (err) {
    console.error('cancelOrder error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function tipOrder(req: any, res: Response) {
  try {
    const tip = Math.max(0, Number(req.body.tip) || 0);
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { tip, total: order.total - order.tip + tip },
    });

    if (order.driverId) {
      await prisma.driverProfile.update({
        where: { id: order.driverId },
        data: { totalTips: { increment: tip - order.tip } },
      });
    }

    res.json({ order: updated });
  } catch (err) {
    console.error('tipOrder error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function streamOrder(req: any, res: Response) {
  const { id } = req.params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: { customerId: true, driver: { select: { userId: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.customerId !== req.user.id && order.driver?.userId !== req.user.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addOrderClient(id, res);
  console.log(`[SSE] ✅ Customer connected to order stream: ${id}`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeOrderClient(id, res);
    console.log(`[SSE] ❌ Customer disconnected from order stream: ${id}`);
  });
}

export async function getOrderTimeline(req: any, res: Response) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { id: true, customerId: true, driver: { select: { userId: true } } },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (
      order.customerId !== req.user.id &&
      req.user.role !== 'ADMIN' &&
      order.driver?.userId !== req.user.id
    ) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const events = await prisma.orderEvent.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ events });
  } catch (err) {
    console.error('getOrderTimeline error', err);
    res.status(500).json({ error: 'Server error' });
  }
}
