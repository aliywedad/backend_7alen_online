import * as admin from 'firebase-admin';
import { prisma } from './prisma';

// Initialise Firebase Admin once using service account file
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('../../config/serviceAccountKey.json');

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const messaging = admin.messaging();

const CHANNEL: Record<string, { channelId: string; priority: 'high' | 'normal' }> = {
  ORDER:  { channelId: '7alan_orders',  priority: 'high'   },
  PROMO:  { channelId: '7alan_promos',  priority: 'normal' },
  INFO:   { channelId: '7alan_system',  priority: 'normal' },
  SYSTEM: { channelId: '7alan_system',  priority: 'normal' },
};

async function send(
  token: string,
  title: string,
  body: string,
  type: string,
  data?: Record<string, unknown>,
) {
  const { channelId, priority } = CHANNEL[type] ?? CHANNEL.INFO;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      android: {
        priority,
        notification: {
          channelId,
          sound: 'default',
          color: '#FF6B42',
          icon: 'ic_notification',
          // BigText style applied automatically — full body visible when expanded
          vibrateTimingsMillis: priority === 'high' ? [0, 250, 100, 250] : undefined,
        },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
        headers: { 'apns-priority': priority === 'high' ? '10' : '5' },
      },
      data: data
        ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        : undefined,
    });
  } catch (err: any) {
    if (err.code === 'messaging/registration-token-not-registered') {
      await prisma.user.updateMany({ where: { fcmToken: token }, data: { fcmToken: null } });
    } else {
      console.error('[Push]', err.message);
    }
  }
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  type = 'INFO',
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { fcmToken: true } });
  if (!user?.fcmToken) return;
  await send(user.fcmToken, title, body, type, data);
}

export async function sendPushToMany(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  type = 'INFO',
) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, fcmToken: { not: null } },
    select: { fcmToken: true },
  });
  await Promise.all(users.filter((u) => u.fcmToken).map((u) => send(u.fcmToken!, title, body, type, data)));
}

export async function sendPushBroadcast(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  type = 'INFO',
) {
  const users = await prisma.user.findMany({ where: { fcmToken: { not: null } }, select: { fcmToken: true } });
  await Promise.all(users.filter((u) => u.fcmToken).map((u) => send(u.fcmToken!, title, body, type, data)));
}

export async function sendPushToRole(
  role: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  type = 'INFO',
) {
  const users = await prisma.user.findMany({ where: { role, fcmToken: { not: null } }, select: { fcmToken: true } });
  await Promise.all(users.filter((u) => u.fcmToken).map((u) => send(u.fcmToken!, title, body, type, data)));
}
