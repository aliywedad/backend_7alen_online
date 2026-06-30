import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { emitToOrder, addDriverClient, removeDriverClient } from '../lib/sseManager';


export async function registerDriver(req: any, res: Response) {
  try {
    const { vehicleType, vehiclePlate } = req.body;
    const profile = await prisma.driverProfile.create({
      data: { userId: req.user.id, vehicleType, vehiclePlate },
    });
    await prisma.user.update({ where: { id: req.user.id }, data: { role: 'DRIVER' } });
    res.status(201).json({ profile });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function toggleOnline(req: any, res: Response) {
  try {
    const profile = await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: { isOnline: req.body.isOnline },
    });
    res.json({ profile });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateLocation(req: any, res: Response) {
  try {
    const { lat, lng, orderId } = req.body;
    await prisma.driverProfile.update({
      where: { userId: req.user.id },
      data: { currentLat: lat, currentLng: lng },
    });

    if (orderId) {
      emitToOrder(orderId, 'location_update', { lat, lng });
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAvailableOrders(req: any, res: Response) {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'READY_FOR_PICKUP', driverId: null },
      include: {
        restaurant: { select: { name: true, address: true, lat: true, lng: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function acceptOrder(req: any, res: Response) {
  try {
    const driver = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ error: 'Driver profile not found' });

    // Check it hasn't already been taken
    const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Order not found' });
    if (existing.driverId) return res.status(409).json({ error: 'Order already taken by another driver' });

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { driverId: driver.id, status: 'PICKED_UP' },
    });

    emitToOrder(order.id, 'order_status', { orderId: order.id, status: 'PICKED_UP' });
    res.json({ order });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function streamDriver(req: any, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  addDriverClient(res);
  console.log(`[SSE] ✅ Driver connected: ${req.user.id}`);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeDriverClient(res);
    console.log(`[SSE] ❌ Driver disconnected: ${req.user.id}`);
  });
}

export async function getDriverOrders(req: any, res: Response) {
  try {
    const driver = await prisma.driverProfile.findUnique({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const orders = await prisma.order.findMany({
      where: { driverId: driver.id },
      include: {
        restaurant: { select: { name: true, address: true } },
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
