import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { logAction } from '../lib/audit';


export async function listBanners(req: any, res: Response) {
  try {
    const { storeType } = req.query;
    const now = new Date();
    const where: any = {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    };
    if (storeType) where.storeType = storeType;
    const banners = await prisma.banner.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ banners });
  } catch (err) {
    console.error('listBanners error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

function parseBannerPayload(body: any) {
  const data: any = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.subtitle !== undefined) data.subtitle = body.subtitle || null;
  if (body.image !== undefined) data.image = body.image || null;
  if (body.backgroundColor !== undefined) data.backgroundColor = body.backgroundColor || null;
  if (body.ctaText !== undefined) data.ctaText = body.ctaText || null;
  if (body.ctaUrl !== undefined) data.ctaUrl = body.ctaUrl || null;
  if (body.storeType !== undefined) data.storeType = body.storeType || null;
  if (body.restaurantId !== undefined) data.restaurantId = body.restaurantId || null;
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  return data;
}

export async function adminListBanners(_req: any, res: Response) {
  try {
    const banners = await prisma.banner.findMany({
      include: { restaurant: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ banners });
  } catch (err) {
    console.error('adminListBanners error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminCreateBanner(req: any, res: Response) {
  try {
    const data = parseBannerPayload(req.body);
    if (!data.title) return res.status(400).json({ error: 'Title required' });
    const banner = await prisma.banner.create({ data });
    logAction(req.user.id, 'CREATE', 'banners', { resourceId: banner.id, resourceName: banner.title });
    res.status(201).json({ banner });
  } catch (err) {
    console.error('adminCreateBanner error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminUpdateBanner(req: any, res: Response) {
  try {
    const data = parseBannerPayload(req.body);
    const banner = await prisma.banner.update({ where: { id: req.params.id }, data });
    logAction(req.user.id, 'UPDATE', 'banners', { resourceId: banner.id, resourceName: banner.title });
    res.json({ banner });
  } catch (err) {
    console.error('adminUpdateBanner error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminDeleteBanner(req: any, res: Response) {
  try {
    await prisma.banner.delete({ where: { id: req.params.id } });
    logAction(req.user.id, 'DELETE', 'banners', { resourceId: req.params.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
