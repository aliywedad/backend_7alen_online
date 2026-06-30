import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { validateCoupon } from '../services/coupons';
import { logAction } from '../lib/audit';


const COUPON_TYPES = ['PERCENTAGE', 'FIXED', 'FREE_DELIVERY'];
const COUPON_SCOPES = ['ALL', 'STORE_TYPE', 'RESTAURANT'];

export async function listActiveCoupons(_req: any, res: Response) {
  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        code: true,
        description: true,
        type: true,
        value: true,
        minOrder: true,
        maxDiscount: true,
        scope: true,
        storeType: true,
        restaurantId: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ coupons });
  } catch (err) {
    console.error('listActiveCoupons error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function previewCoupon(req: any, res: Response) {
  try {
    const { code, restaurantId, subtotal, deliveryFee, storeType } = req.body;
    if (!code || subtotal === undefined) return res.status(400).json({ error: 'Code and subtotal required' });

    const result = await validateCoupon(String(code), {
      userId: req.user.id,
      subtotal: Number(subtotal),
      deliveryFee: Number(deliveryFee || 0),
      restaurantId,
      storeType,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Invalid coupon' });
  }
}

function parseCouponPayload(body: any) {
  const data: any = {};
  if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
  if (body.description !== undefined) data.description = body.description || null;
  if (body.type !== undefined) {
    if (!COUPON_TYPES.includes(body.type)) throw new Error('Invalid coupon type');
    data.type = body.type;
  }
  if (body.value !== undefined) data.value = Number(body.value) || 0;
  if (body.minOrder !== undefined) data.minOrder = Number(body.minOrder) || 0;
  if (body.maxDiscount !== undefined) data.maxDiscount = body.maxDiscount === null ? null : Number(body.maxDiscount);
  if (body.usageLimit !== undefined) data.usageLimit = body.usageLimit === null ? null : Number(body.usageLimit);
  if (body.perUserLimit !== undefined) data.perUserLimit = Number(body.perUserLimit) || 1;
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.scope !== undefined) {
    if (!COUPON_SCOPES.includes(body.scope)) throw new Error('Invalid scope');
    data.scope = body.scope;
  }
  if (body.storeType !== undefined) data.storeType = body.storeType || null;
  if (body.restaurantId !== undefined) data.restaurantId = body.restaurantId || null;
  return data;
}

export async function adminListCoupons(req: any, res: Response) {
  try {
    const { search, status } = req.query;
    const where: any = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.OR = [
        { code: { contains: String(search) } },
        { description: { contains: String(search) } },
      ];
    }
    const coupons = await prisma.coupon.findMany({
      where,
      include: { restaurant: { select: { id: true, name: true } }, _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ coupons });
  } catch (err) {
    console.error('adminListCoupons error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminCreateCoupon(req: any, res: Response) {
  try {
    const data = parseCouponPayload(req.body);
    if (!data.code || !data.type) return res.status(400).json({ error: 'Code and type are required' });
    const coupon = await prisma.coupon.create({ data });
    logAction(req.user.id, 'CREATE', 'coupons', { resourceId: coupon.id, resourceName: coupon.code });
    res.status(201).json({ coupon });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Code already exists' });
    res.status(400).json({ error: err.message || 'Failed to create coupon' });
  }
}

export async function adminUpdateCoupon(req: any, res: Response) {
  try {
    const data = parseCouponPayload(req.body);
    const coupon = await prisma.coupon.update({ where: { id: req.params.id }, data });
    logAction(req.user.id, 'UPDATE', 'coupons', { resourceId: coupon.id, resourceName: coupon.code });
    res.json({ coupon });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update coupon' });
  }
}

export async function adminDeleteCoupon(req: any, res: Response) {
  try {
    await prisma.coupon.delete({ where: { id: req.params.id } });
    logAction(req.user.id, 'DELETE', 'coupons', { resourceId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error('adminDeleteCoupon error', err);
    res.status(500).json({ error: 'Server error' });
  }
}
