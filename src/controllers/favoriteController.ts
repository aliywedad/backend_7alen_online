import { Response } from 'express';
import { prisma } from '../lib/prisma';


export async function getMyFavorites(req: any, res: Response) {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            category: true,
            storeType: true,
            logo: true,
            coverImage: true,
            rating: true,
            deliveryFee: true,
            deliveryTime: true,
            minOrder: true,
            isOpen: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ favorites });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function toggleFavorite(req: any, res: Response) {
  try {
    const { restaurantId } = req.body;
    if (!restaurantId) return res.status(400).json({ error: 'restaurantId is required' });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_restaurantId: { userId: req.user.id, restaurantId },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return res.json({ isFavorite: false });
    }

    await prisma.favorite.create({
      data: { userId: req.user.id, restaurantId },
    });

    return res.status(201).json({ isFavorite: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
