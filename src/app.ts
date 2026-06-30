import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import restaurantRoutes from './routes/restaurants';
import orderRoutes from './routes/orders';
import driverRoutes from './routes/drivers';
import adminRoutes from './routes/admin';
import favoriteRoutes from './routes/favorites';
import courierRoutes from './routes/courier';
import couponRoutes from './routes/coupons';
import reviewRoutes from './routes/reviews';
import notificationRoutes from './routes/notifications';
import bannerRoutes from './routes/banners';
import walletRoutes from './routes/wallet';
import referralRoutes from './routes/referrals';
import uploadRoutes from './routes/upload';
import whatsappRoutes from './routes/whatsapp';
import callRoutes from './routes/calls';
import { ensureSettingsSeeded } from './services/settings';

export const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true,
    credentials: true,
  }),
);

// ── Security / Logging ────────────────────────────────────────────────────────
app.use(helmet());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/logos', express.static(path.join(__dirname, 'logos')));

// ── Global rate limiter (all routes) ─────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 3000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  }),
);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', app: '7alan API' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/courier', courierRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/calls', callRoutes);

ensureSettingsSeeded().catch((err) => console.error('settings seeding failed', err));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err);
  const status = err.status ?? err.statusCode ?? 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message ?? 'Internal server error');
  res.status(status).json({ error: message });
});
