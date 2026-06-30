import { prisma } from '../lib/prisma';


type ValidateOpts = {
  userId: string;
  subtotal: number;
  deliveryFee: number;
  restaurantId?: string;
  storeType?: string | null;
};

export type ValidatedCoupon = {
  coupon: { id: string; code: string; type: string; value: number };
  discount: number;
  freeDelivery: boolean;
};

export async function validateCoupon(code: string, opts: ValidateOpts): Promise<ValidatedCoupon> {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon) throw new Error('Coupon not found');
  if (!coupon.isActive) throw new Error('Coupon disabled');

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new Error('Coupon not started yet');
  if (coupon.expiresAt && coupon.expiresAt < now) throw new Error('Coupon expired');

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }

  if (opts.subtotal < coupon.minOrder) {
    throw new Error(`Minimum order ${coupon.minOrder} MRU not reached`);
  }

  if (coupon.scope === 'RESTAURANT' && coupon.restaurantId && coupon.restaurantId !== opts.restaurantId) {
    throw new Error('Coupon not valid for this store');
  }

  if (coupon.scope === 'STORE_TYPE' && coupon.storeType && coupon.storeType !== opts.storeType) {
    throw new Error('Coupon not valid for this category');
  }

  if (coupon.perUserLimit > 0) {
    const used = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId: opts.userId },
    });
    if (used >= coupon.perUserLimit) {
      throw new Error('You already used this coupon');
    }
  }

  let discount = 0;
  let freeDelivery = false;
  if (coupon.type === 'PERCENTAGE') {
    discount = (opts.subtotal * coupon.value) / 100;
    if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  } else if (coupon.type === 'FIXED') {
    discount = coupon.value;
  } else if (coupon.type === 'FREE_DELIVERY') {
    discount = opts.deliveryFee;
    freeDelivery = true;
  }

  discount = Math.max(0, Math.min(discount, opts.subtotal + opts.deliveryFee));

  return {
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
    discount: Number(discount.toFixed(2)),
    freeDelivery,
  };
}
