import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { getNumericSetting } from '../services/settings';


export async function getMyReferrals(req: any, res: Response) {
  try {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referralCode: true },
    });

    const [reward, friendReward, referrals] = await Promise.all([
      getNumericSetting('referralReward', 200),
      getNumericSetting('referralFriendReward', 100),
      prisma.user.findMany({
        where: { referredById: req.user.id },
        select: { id: true, name: true, phone: true, createdAt: true, role: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      code: me?.referralCode,
      reward,
      friendReward,
      referrals,
    });
  } catch (err) {
    console.error('getMyReferrals error', err);
    res.status(500).json({ error: 'Server error' });
  }
}
