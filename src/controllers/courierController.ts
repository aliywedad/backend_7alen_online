import { Response } from 'express';
import { prisma } from '../lib/prisma';


function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function estimateCourier(distanceKm: number, packageSize = 'SMALL') {
  const sizeMultiplier: Record<string, number> = {
    SMALL: 1,
    MEDIUM: 1.25,
    LARGE: 1.6,
  };
  const baseFee = 60;
  const perKm = 18;
  const multiplier = sizeMultiplier[packageSize] ?? 1;
  const fee = Math.round((baseFee + distanceKm * perKm) * multiplier);
  const estimatedTime = Math.max(15, Math.round(distanceKm * 6 + 10));

  return { fee, estimatedTime };
}

export async function estimateCourierPrice(req: any, res: Response) {
  try {
    const { pickupLat, pickupLng, dropLat, dropLng, packageSize } = req.body;
    if ([pickupLat, pickupLng, dropLat, dropLng].some((v) => typeof v !== 'number')) {
      return res.status(400).json({ error: 'pickup/drop coordinates are required' });
    }

    const distance = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
    const { fee, estimatedTime } = estimateCourier(distance, packageSize);

    res.json({
      estimate: {
        distanceKm: Number(distance.toFixed(2)),
        fee,
        estimatedTime,
      },
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createCourierRequest(req: any, res: Response) {
  try {
    const {
      pickupAddress,
      pickupLat,
      pickupLng,
      dropAddress,
      dropLat,
      dropLng,
      packageSize = 'SMALL',
      photo,
      senderName,
      senderPhone,
      recipientName,
      recipientPhone,
      notes,
    } = req.body;

    if (!pickupAddress || !dropAddress) {
      return res.status(400).json({ error: 'Pickup and drop addresses are required' });
    }
    if (!recipientName || !recipientPhone) {
      return res.status(400).json({ error: 'Recipient name and phone are required' });
    }

    // Compute distance/fee only when both coordinate pairs are provided
    let fee = 60;
    let distance: number | null = null;
    let estimatedTime: number | null = null;

    const hasCoords =
      typeof pickupLat === 'number' && typeof pickupLng === 'number' &&
      typeof dropLat === 'number' && typeof dropLng === 'number';

    if (hasCoords) {
      const distKm = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
      const est = estimateCourier(distKm, packageSize);
      fee = est.fee;
      distance = Number(distKm.toFixed(2));
      estimatedTime = est.estimatedTime;
    }

    const request = await prisma.courierRequest.create({
      data: {
        customerId:    req.user.id,
        pickupAddress,
        pickupLat:     pickupLat ?? null,
        pickupLng:     pickupLng ?? null,
        dropAddress,
        dropLat:       dropLat ?? null,
        dropLng:       dropLng ?? null,
        packageSize,
        photo:         photo ?? null,
        senderName:    senderName ?? null,
        senderPhone:   senderPhone ?? null,
        recipientName,
        recipientPhone,
        notes,
        fee,
        distance,
        estimatedTime,
      },
    });

    res.status(201).json({ request });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

const COURIER_INCLUDE = {
  driver: {
    include: {
      user: { select: { name: true, phone: true } },
    },
  },
};

export async function getMyCourierRequests(req: any, res: Response) {
  try {
    const requests = await prisma.courierRequest.findMany({
      where: { customerId: req.user.id },
      include: COURIER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ requests });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCourierById(req: any, res: Response) {
  try {
    const { id } = req.params;
    const request = await prisma.courierRequest.findUnique({
      where: { id },
      include: COURIER_INCLUDE,
    });

    if (!request) return res.status(404).json({ error: 'Not found' });
    if (request.customerId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    res.json({ request });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
}
