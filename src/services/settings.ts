import { prisma } from '../lib/prisma';


export const SETTING_DEFAULTS: Record<string, { value: string; category: string }> = {
  platformName: { value: '7alan', category: 'GENERAL' },
  supportPhone: { value: '+22245000000', category: 'GENERAL' },
  defaultLanguage: { value: 'EN', category: 'GENERAL' },
  defaultCurrency: { value: 'MRU', category: 'GENERAL' },

  commissionRate: { value: '0.15', category: 'COMMERCE' },
  driverCommissionRate: { value: '0.20', category: 'COMMERCE' },
  loyaltyPointsRate: { value: '0.05', category: 'COMMERCE' },
  loyaltyRedeemRate: { value: '10', category: 'COMMERCE' },
  walletEnabled: { value: 'true', category: 'COMMERCE' },
  tippingEnabled: { value: 'true', category: 'COMMERCE' },

  referralReward: { value: '200', category: 'GROWTH' },
  referralFriendReward: { value: '100', category: 'GROWTH' },

  courierBaseFee: { value: '60', category: 'COURIER' },
  courierPerKm: { value: '18', category: 'COURIER' },

  ordersPushNotifications: { value: 'true', category: 'NOTIFICATIONS' },
  promoPushNotifications: { value: 'true', category: 'NOTIFICATIONS' },
};

export async function ensureSettingsSeeded() {
  const entries = Object.entries(SETTING_DEFAULTS);
  await Promise.all(
    entries.map(([key, conf]) =>
      prisma.platformSetting.upsert({
        where: { key },
        update: { category: conf.category },
        create: { key, value: conf.value, category: conf.category },
      }),
    ),
  );
}

export async function getSetting(key: string, fallback?: string) {
  const record = await prisma.platformSetting.findUnique({ where: { key } });
  if (record) return record.value;
  return fallback ?? SETTING_DEFAULTS[key]?.value ?? '';
}

export async function getNumericSetting(key: string, fallback = 0) {
  const value = await getSetting(key);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getBooleanSetting(key: string, fallback = false) {
  const value = await getSetting(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export async function listSettings() {
  return prisma.platformSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
}

export async function upsertSetting(key: string, value: string, category?: string) {
  return prisma.platformSetting.upsert({
    where: { key },
    update: { value, ...(category ? { category } : {}) },
    create: { key, value, category: category || SETTING_DEFAULTS[key]?.category || 'GENERAL' },
  });
}
