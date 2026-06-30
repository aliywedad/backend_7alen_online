import { Response } from 'express';
import { prisma } from '../lib/prisma';


export async function createReview(req: any, res: Response) {
  try {
    const { orderId, rating, driverRating, comment } = req.body;
    if (!orderId || !rating) return res.status(400).json({ error: 'orderId and rating required' });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true, driver: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.customerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ error: 'Order not delivered yet' });
    if (order.review) return res.status(409).json({ error: 'Order already reviewed' });

    const numericRating = Math.min(5, Math.max(1, Number(rating)));
    const numericDriverRating = driverRating ? Math.min(5, Math.max(1, Number(driverRating))) : null;

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId,
          userId: req.user.id,
          restaurantId: order.restaurantId,
          driverId: order.driverId,
          rating: numericRating,
          driverRating: numericDriverRating,
          comment: comment || null,
        },
      });

      const restaurant = await tx.restaurant.findUnique({
        where: { id: order.restaurantId },
        select: { rating: true, totalRatings: true },
      });
      if (restaurant) {
        const newCount = restaurant.totalRatings + 1;
        const newRating = ((restaurant.rating * restaurant.totalRatings) + numericRating) / newCount;
        await tx.restaurant.update({
          where: { id: order.restaurantId },
          data: { rating: Number(newRating.toFixed(2)), totalRatings: newCount },
        });
      }

      if (order.driverId && numericDriverRating) {
        const driver = await tx.driverProfile.findUnique({
          where: { id: order.driverId },
          select: { rating: true, totalRatings: true },
        });
        if (driver) {
          const newCount = driver.totalRatings + 1;
          const newRating = ((driver.rating * driver.totalRatings) + numericDriverRating) / newCount;
          await tx.driverProfile.update({
            where: { id: order.driverId },
            data: { rating: Number(newRating.toFixed(2)), totalRatings: newCount },
          });
        }
      }

      return created;
    });

    res.status(201).json({ review });
  } catch (err: any) {
    console.error('createReview error', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
}

export async function listRestaurantReviews(req: any, res: Response) {
  try {
    const reviews = await prisma.review.findMany({
      where: { restaurantId: req.params.id },
      include: { user: { select: { name: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ reviews });
  } catch (err) {
    console.error('listRestaurantReviews error', err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function listMyReviews(req: any, res: Response) {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      include: { restaurant: { select: { name: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ reviews });
  } catch (err) {
    console.error('listMyReviews error', err);
    res.status(500).json({ error: 'Server error' });
  }
}
