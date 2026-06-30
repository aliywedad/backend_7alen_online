import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getNumericSetting } from '../services/settings';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('222') && digits.length >= 11) return `+${digits}`;
  if (digits.length === 8) return `+222${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}

function signToken(id: string, role: string, permissions: string[] = []) {
  return jwt.sign({ id, role, permissions }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  } as jwt.SignOptions);
}

function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function generateReferralCode(name: string) {
  const slug = name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'WALA';
  return `${slug}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function uniqueReferralCode(name: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode(name);
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  return `WALA${Date.now().toString().slice(-6)}`;
}

export async function register(req: Request, res: Response) {
  try {
    const { phone: rawPhone, name, password, role = 'CUSTOMER', referralCode } = req.body;
    if (!rawPhone || !name || !password) {
      return res.status(400).json({ error: 'Phone, name and password are required' });
    }
    const phone = normalizePhone(rawPhone);

    const exists = await prisma.user.findUnique({ where: { phone } });
    if (exists) return res.status(409).json({ error: 'Phone already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const myReferralCode = await uniqueReferralCode(name);

    let referrer = null as null | { id: string };
    if (referralCode) {
      referrer = await prisma.user.findUnique({
        where: { referralCode: String(referralCode).trim().toUpperCase() },
        select: { id: true },
      });
    }

    const user = await prisma.user.create({
      data: {
        phone,
        name,
        password: hashed,
        role,
        referralCode: myReferralCode,
        referredById: referrer?.id,
      },
      select: { id: true, phone: true, name: true, role: true, avatar: true, referralCode: true, walletBalance: true, loyaltyPoints: true },
    });

    if (referrer) {
      const referralReward = await getNumericSetting('referralReward', 200);
      const friendReward = await getNumericSetting('referralFriendReward', 100);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: referrer.id },
          data: { walletBalance: { increment: referralReward } },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: referrer.id,
            amount: referralReward,
            type: 'CREDIT',
            source: 'REFERRAL',
            note: `Referral bonus for inviting ${user.name}`,
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { walletBalance: { increment: friendReward } },
        }),
        prisma.walletTransaction.create({
          data: {
            userId: user.id,
            amount: friendReward,
            type: 'CREDIT',
            source: 'REFERRAL',
            note: 'Welcome bonus for joining via referral',
          },
        }),
        prisma.notification.create({
          data: {
            userId: referrer.id,
            title: 'Referral reward',
            body: `${user.name} joined with your code. ${referralReward} MRU added to your wallet.`,
            type: 'PROMO',
          },
        }),
      ]);
    }

    const token = signToken(user.id, user.role);
    res.status(201).json({ token, user: { ...user, adminPermissions: [] } });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { phone: rawPhone, password } = req.body;
    if (!rawPhone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }
    const phone = normalizePhone(rawPhone);

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const permissions = parsePermissions(user.adminPermissions);
    const token = signToken(user.id, user.role, permissions);
    const { password: _, adminPermissions: __, ...rest } = user;
    res.json({ token, user: { ...rest, adminPermissions: permissions } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getMe(req: any, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        adminPermissions: true,
        avatar: true,
        email: true,
        walletBalance: true,
        loyaltyPoints: true,
        referralCode: true,
        language: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { adminPermissions: rawPerms, ...rest } = user;
    res.json({ user: { ...rest, adminPermissions: parsePermissions(rawPerms) } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateProfile(req: any, res: Response) {
  try {
    const { name, email, fcmToken } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name      !== undefined && { name }),
        ...(email     !== undefined && { email }),
        ...(fcmToken  !== undefined && { fcmToken: fcmToken || null }),
      },
      select: { id: true, phone: true, name: true, role: true, avatar: true, email: true },
    });
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAddresses(req: any, res: Response) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: { isDefault: 'desc' },
    });
    res.json({ addresses });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function addAddress(req: any, res: Response) {
  try {
    const { label, address, lat, lng, isDefault } = req.body;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: { userId: req.user.id, label, address, lat, lng, isDefault: isDefault || false },
    });
    res.status(201).json({ address: newAddress });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function setDefaultAddress(req: any, res: Response) {
  try {
    const { id } = req.params;
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address) return res.status(404).json({ error: 'Address not found' });
    if (address.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteAddress(req: any, res: Response) {
  try {
    const { id } = req.params;
    const address = await prisma.address.findUnique({ where: { id } });
    if (!address) return res.status(404).json({ error: 'Address not found' });
    if (address.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.address.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteAccount(req: any, res: Response) {
  try {
    const id = req.user.id;
    await prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        phone: `deleted_${id}`,
        name: 'Deleted User',
        email: null,
        avatar: null,
        fcmToken: null,
        password: '',
      },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
