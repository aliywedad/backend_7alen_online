import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { logAction } from '../lib/audit';
import { sendPushToUser, sendPushBroadcast, sendPushToRole } from '../lib/pushService';


export async function listMyNotifications(req: any, res: Response) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ notifications });
  } catch (err) {
    console.error('listMyNotifications error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markRead(req: any, res: Response) {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    if (notif.userId && notif.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json({ notification: updated });
  } catch (err) {
    console.error('markRead error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markAllRead(req: any, res: Response) {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminListNotifications(req: any, res: Response) {
  try {
    const { type, scope } = req.query;
    const where: any = {};
    if (type && type !== 'ALL') where.type = type;
    if (scope === 'broadcast') where.userId = null;
    if (scope === 'direct') where.userId = { not: null };
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { name: true, phone: true } } },
    });
    res.json({ notifications });
  } catch (err) {
    console.error('adminListNotifications error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminCreateNotification(req: any, res: Response) {
  try {
    const { title, body, type = 'INFO', userId, phone, role, all = false } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body required' });

    if (all) {
      const created = await prisma.notification.create({
        data: { title, body, type },
      });
      sendPushBroadcast(title, body, undefined, type).catch(() => {});
      logAction(req.user.id, 'CREATE', 'notifications', { resourceId: created.id, resourceName: title, details: { target: 'broadcast' } });
      return res.status(201).json({ notification: created, broadcast: true });
    }

    if (role) {
      const targets = await prisma.user.findMany({ where: { role }, select: { id: true } });
      if (targets.length === 0) return res.status(400).json({ error: 'No users with that role' });
      await prisma.notification.createMany({
        data: targets.map((target) => ({ userId: target.id, title, body, type })),
      });
      sendPushToRole(role, title, body, undefined, type).catch(() => {});
      logAction(req.user.id, 'CREATE', 'notifications', { resourceName: title, details: { target: `role:${role}`, count: targets.length } });
      return res.status(201).json({ ok: true, count: targets.length });
    }

    // Resolve phone → userId if phone was provided instead of userId
    let targetUserId = userId;
    if (!targetUserId && phone) {
      const digits = String(phone).replace(/\D/g, '');
      const normalized = digits.length === 8 ? `+222${digits}`
        : digits.startsWith('222') && digits.length >= 11 ? `+${digits}`
        : String(phone).startsWith('+') ? String(phone) : `+${digits}`;
      const found = await prisma.user.findUnique({ where: { phone: normalized }, select: { id: true } });
      if (!found) return res.status(404).json({ error: `No user found with phone ${normalized}` });
      targetUserId = found.id;
    }

    if (!targetUserId) return res.status(400).json({ error: 'Provide userId, phone, role, or set all=true' });

    const created = await prisma.notification.create({
      data: { userId: targetUserId, title, body, type },
    });
    sendPushToUser(targetUserId, title, body, undefined, type).catch(() => {});
    logAction(req.user.id, 'CREATE', 'notifications', { resourceId: created.id, resourceName: title, details: { target: `user:${targetUserId}`, phone: phone ?? undefined } });
    res.status(201).json({ notification: created });
  } catch (err) {
    console.error('adminCreateNotification error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminDeleteNotification(req: any, res: Response) {
  try {
    await prisma.notification.delete({ where: { id: req.params.id } });
    logAction(req.user.id, 'DELETE', 'notifications', { resourceId: req.params.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
