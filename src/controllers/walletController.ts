import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { getNumericSetting } from '../services/settings';


export async function getMyWallet(req: any, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { walletBalance: true, loyaltyPoints: true, referralCode: true },
    });
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ wallet: user, transactions });
  } catch (err) {
    console.error('getMyWallet error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function redeemLoyaltyPoints(req: any, res: Response) {
  try {
    const points = Math.floor(Number(req.body.points));
    if (!points || points <= 0) return res.status(400).json({ error: 'Points required' });

    const rate = await getNumericSetting('loyaltyRedeemRate', 10);
    const value = Number((points / rate).toFixed(2));
    if (value <= 0) return res.status(400).json({ error: 'Not enough points' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.loyaltyPoints < points) return res.status(400).json({ error: 'Not enough points' });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: req.user.id },
        data: {
          loyaltyPoints: { decrement: points },
          walletBalance: { increment: value },
        },
        select: { walletBalance: true, loyaltyPoints: true },
      });
      await tx.walletTransaction.create({
        data: {
          userId: req.user.id,
          amount: value,
          type: 'CREDIT',
          source: 'LOYALTY',
          note: `Redeemed ${points} loyalty points`,
        },
      });
      return u;
    });

    res.json({ wallet: updated });
  } catch (err) {
    console.error('redeemLoyaltyPoints error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function adminAdjustWallet(req: any, res: Response) {
  try {
    const { userId, amount, type = 'CREDIT', note } = req.body;
    if (!userId || amount === undefined) return res.status(400).json({ error: 'userId and amount required' });
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: { [type === 'DEBIT' ? 'decrement' : 'increment']: numericAmount },
        },
        select: { id: true, name: true, walletBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          userId,
          amount: numericAmount,
          type,
          source: 'ADJUSTMENT',
          note: note || 'Admin adjustment',
        },
      });
      return u;
    });

    res.json({ user: updated });
  } catch (err) {
    console.error('adminAdjustWallet error', err);
    res.status(500).json({ error: 'Server error' });
  }
}
