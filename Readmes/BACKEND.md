# 7alan Backend — Full Guide

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Server](#running-the-server)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Real-time (Socket.IO)](#real-time-socketio)
- [File Uploads](#file-uploads)
- [Platform Settings](#platform-settings)
- [Debugging](#debugging)
- [Deployment](#deployment)

---

## Overview

7alan is a food delivery platform backend built with **Express + Prisma + TypeScript**. It serves three mobile clients — customer, restaurant, and driver apps — plus an admin dashboard. It handles orders, real-time tracking, payments/wallet, coupons, reviews, notifications, and more.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Language | TypeScript 5 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL 17 |
| Auth | JWT (`jsonwebtoken`) |
| Real-time | Socket.IO 4 |
| Password hashing | bcryptjs |
| File uploads | multer |
| Security | helmet, express-rate-limit |
| Logging | morgan |
| Dev server | ts-node-dev |
| Process manager | PM2 (production) |
| Deployment | Railway (nixpacks) |

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma          # Database schema (18 models)
│   ├── seed.ts                # Database seed script
│   └── migrations/            # SQL migration history
├── src/
│   ├── server.ts              # Entry point — HTTP server + Socket.IO init
│   ├── app.ts                 # Express app — middleware + route mounting
│   ├── config/
│   │   └── socket.ts          # Socket.IO setup + event handlers
│   ├── lib/
│   │   └── prisma.ts          # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.ts            # JWT authenticate + requireRole guards
│   │   └── rateLimiter.ts     # Auth-specific rate limiter (20 req/15 min)
│   ├── routes/                # Express routers (one file per domain)
│   │   ├── auth.ts
│   │   ├── restaurants.ts
│   │   ├── orders.ts
│   │   ├── drivers.ts
│   │   ├── admin.ts
│   │   ├── favorites.ts
│   │   ├── courier.ts
│   │   ├── coupons.ts
│   │   ├── reviews.ts
│   │   ├── notifications.ts
│   │   ├── banners.ts
│   │   ├── wallet.ts
│   │   ├── referrals.ts
│   │   └── upload.ts
│   ├── controllers/           # Business logic handlers
│   │   ├── authController.ts
│   │   ├── orderController.ts
│   │   ├── restaurantController.ts
│   │   ├── driverController.ts
│   │   ├── couponController.ts
│   │   ├── walletController.ts
│   │   ├── notificationController.ts
│   │   ├── bannerController.ts
│   │   ├── reviewController.ts
│   │   ├── courierController.ts
│   │   ├── favoriteController.ts
│   │   ├── referralController.ts
│   │   └── otpController.ts
│   └── services/
│       ├── settings.ts        # Platform settings CRUD + defaults
│       └── coupons.ts         # Coupon validation logic
├── uploads/                   # Served at /uploads/* (user-uploaded images)
├── ecosystem.config.js        # PM2 config (production)
├── railway.toml               # Railway deployment config
├── Procfile                   # Heroku-style start command
├── .env                       # Local environment variables (not committed)
└── tsconfig.json
```

---

## Architecture

```
Mobile Apps / Admin Web
        │
        │  HTTP + WebSocket
        ▼
┌─────────────────────────────────────────┐
│  Express App  (app.ts)                  │
│                                         │
│  helmet · cors · morgan · rate-limit    │
│                                         │
│  /api/auth         authRoutes           │
│  /api/restaurants  restaurantRoutes     │
│  /api/orders       orderRoutes          │
│  /api/drivers      driverRoutes         │
│  /api/admin        adminRoutes          │
│  /api/...          (9 more routers)     │
│  /uploads          static files         │
└──────────┬──────────────────────────────┘
           │
    ┌──────▼──────┐        ┌─────────────┐
    │  Prisma ORM │        │  Socket.IO  │
    └──────┬──────┘        └──────┬──────┘
           │                      │
    ┌──────▼──────┐        Rooms: order_<id>
    │ PostgreSQL  │               drivers
    └─────────────┘
```

**Request lifecycle:**
1. Request hits Express middleware stack (helmet → cors → morgan → rate-limit)
2. Router matches path → calls controller function
3. Controller uses `prisma` client to read/write PostgreSQL
4. For order status changes and driver location updates, controller also emits Socket.IO events
5. Response sent back as JSON

**User roles** are stored in the JWT payload and enforced by `requireRole(...)` middleware:

| Role | How it's set |
|---|---|
| `CUSTOMER` | Default on register |
| `RESTAURANT_OWNER` | `POST /api/restaurants` |
| `DRIVER` | `POST /api/drivers/register` |
| `ADMIN` | Manual DB update |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 17 (or Docker — see below)
- pnpm or npm

### 1. Clone and install

```bash
cd backend
npm install
```

### 2. Start PostgreSQL with Docker

```bash
# Start the existing pgadmin stack (already configured)
docker start pgadminf-postgres-1 pgadminf-pgadmin-1
```

Or use any PostgreSQL 13+ instance.

### 3. Configure environment

```bash
cp .env.example .env   # or create .env manually
```

Minimum required `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL="postgresql://postgres:password@localhost:5432/7alen"
JWT_SECRET="your-secret-here"
JWT_EXPIRES_IN="30d"
```

### 4. Run migrations

```bash
npm run db:migrate
# Creates the database + all tables
```

### 5. (Optional) Seed the database

```bash
npm run db:seed
```

### 6. Start the dev server

```bash
npm run dev
# Starts ts-node-dev with hot reload on port 3000
```

Health check: `GET http://localhost:3000/health` → `{ "status": "ok", "app": "7alan API" }`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Controls CORS, error verbosity, morgan logging |
| `PORT` | No | `3000` | HTTP server port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing JWTs — use a long random string in production |
| `JWT_EXPIRES_IN` | No | `30d` | JWT token lifetime |
| `CORS_ORIGINS` | No | — | Comma-separated allowed origins (only enforced in `production`) |

---

## Database Setup

### NPM scripts

| Command | What it does |
|---|---|
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:push` | Push schema to DB without migration (fast, no history) |
| `npm run db:generate` | Regenerate Prisma client after schema change |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Open Prisma Studio at `localhost:5555` |
| `npm run migrate:prod` | Apply pending migrations in production (`prisma migrate deploy`) |

### Prisma Studio (visual DB browser)

```bash
npm run db:studio
# Opens http://localhost:5555
```

### pgAdmin (Docker)

Browse to `http://localhost:5050` after starting `pgadminf-pgadmin-1`.

---

## Running the Server

### Development (hot reload)

```bash
npm run dev
```

`ts-node-dev` watches `src/` and restarts automatically on file changes.

### Production build

```bash
npm run build     # Compiles TypeScript → dist/
npm start         # Runs dist/server.js
```

### Production with PM2

```bash
pm2 start ecosystem.config.js
pm2 logs 7alan-api
pm2 restart 7alan-api
```

PM2 runs in cluster mode (`instances: 'max'`) using all available CPU cores.

---

## API Reference

Base URL: `http://localhost:3000/api`

All authenticated routes require the header:
```
Authorization: Bearer <token>
```

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login → returns `{ token, user }` |
| POST | `/auth/otp/send` | No | Send OTP to phone |
| POST | `/auth/otp/verify` | No | Verify OTP |
| GET | `/auth/me` | Yes | Get current user profile |
| PUT | `/auth/me` | Yes | Update profile (name, email, avatar, fcmToken, language) |
| DELETE | `/auth/me` | Yes | Delete account |
| GET | `/auth/addresses` | Yes | List saved addresses |
| POST | `/auth/addresses` | Yes | Add address |

### Restaurants

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/restaurants` | No | List with `?category=&search=&page=&limit=` |
| GET | `/restaurants/categories` | No | Static category list |
| GET | `/restaurants/:id` | No | Single restaurant detail + menu |
| POST | `/restaurants` | Yes | Create restaurant (sets role → `RESTAURANT_OWNER`) |
| GET | `/restaurants/my` | Yes (owner) | Get own restaurant |
| PUT | `/restaurants/my` | Yes (owner) | Update restaurant settings / toggle `isOpen` |
| GET | `/restaurants/my/orders` | Yes (owner) | List orders with `?status=` |
| POST | `/restaurants/menu/categories` | Yes (owner) | Add menu category |
| POST | `/restaurants/menu/items` | Yes (owner) | Add menu item |
| PUT | `/restaurants/menu/items/:id` | Yes (owner) | Update menu item |
| DELETE | `/restaurants/menu/items/:id` | Yes (owner) | Delete menu item |
| DELETE | `/restaurants/menu/categories/:id` | Yes (owner) | Delete category |

### Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Yes | Place order |
| GET | `/orders/my` | Yes | Customer's order history |
| GET | `/orders/:id` | Yes | Order detail |
| GET | `/orders/:id/events` | Yes | Order status timeline |
| PUT | `/orders/:id/status` | Yes | Advance status `{ status }` |
| PUT | `/orders/:id/cancel` | Yes | Cancel (PENDING only) |
| PUT | `/orders/:id/tip` | Yes | Add tip after delivery |

**Order status flow:**
```
PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → PICKED_UP → DELIVERED
```
- Restaurant advances: PENDING→ACCEPTED→PREPARING→READY_FOR_PICKUP
- Driver advances: READY_FOR_PICKUP→PICKED_UP (via acceptOrder), PICKED_UP→DELIVERED
- Customer: cancel (PENDING only)

### Drivers

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/drivers/register` | Yes | Register as driver `{ vehicleType, vehiclePlate }` |
| PUT | `/drivers/online` | Yes | Toggle online status `{ isOnline }` |
| PUT | `/drivers/location` | Yes | Update GPS location `{ lat, lng, orderId? }` |
| GET | `/drivers/orders/available` | Yes | Available orders (READY_FOR_PICKUP, no driver) |
| PUT | `/drivers/orders/:id/accept` | Yes | Accept order → sets PICKED_UP |
| GET | `/drivers/orders` | Yes | Driver's order history |

### Courier (Package delivery)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/courier/estimate` | Yes | Price estimate `{ pickupLat, pickupLng, dropLat, dropLng, packageSize }` |
| POST | `/courier` | Yes | Create courier request |
| GET | `/courier/my` | Yes | Customer's courier requests |

**Pricing:** Base 60 MRU + 18 MRU/km × size multiplier (SMALL×1, MEDIUM×1.25, LARGE×1.6)

### Favorites

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/favorites/my` | Yes | Get favourited restaurants |
| POST | `/favorites/toggle` | Yes | Toggle favourite `{ restaurantId }` |

### Coupons

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/coupons` | No | List active coupons |
| POST | `/coupons/preview` | Yes | Preview discount `{ code, subtotal, restaurantId }` |

### Reviews

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/reviews` | Yes | Submit review `{ orderId, rating, driverRating?, comment? }` |
| GET | `/reviews/my` | Yes | Customer's reviews |
| GET | `/reviews/restaurant/:id` | No | Restaurant's reviews |

### Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/my` | Yes | User's notifications |
| PUT | `/notifications/:id/read` | Yes | Mark one as read |
| PUT | `/notifications/read-all` | Yes | Mark all as read |

### Banners

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/banners` | No | List active banners |

### Wallet

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/wallet/me` | Yes | Balance + transaction history |
| POST | `/wallet/redeem` | Yes | Redeem loyalty points `{ points }` |

### Referrals

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/referrals/me` | Yes | Own referral code + list of referred users |

### Upload

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload` | Yes | Upload image (multipart/form-data, field `file`, max 8MB) → returns `{ url }` |

### Admin (all routes require `ADMIN` role)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats` | Platform-wide counts and revenue totals |
| GET | `/admin/analytics?days=30` | Revenue + orders by day, top restaurants/drivers |
| GET | `/admin/users` | List users with `?role=&search=` |
| PATCH | `/admin/users/:id` | Update user (isActive, role, name, email) |
| GET | `/admin/restaurants` | List restaurants with `?status=&search=` |
| PATCH | `/admin/restaurants/:id` | Update restaurant (isActive, isOpen, fees) |
| GET | `/admin/drivers` | List drivers with `?online=true\|false` |
| PATCH | `/admin/drivers/:id` | Update driver profile |
| GET | `/admin/orders` | List orders with `?status=&search=` |
| PATCH | `/admin/orders/:id/status` | Override order status |
| GET | `/admin/courier` | List courier requests |
| PATCH | `/admin/courier/:id` | Update courier request |
| GET | `/admin/coupons` | List all coupons |
| POST | `/admin/coupons` | Create coupon |
| PATCH | `/admin/coupons/:id` | Update coupon |
| DELETE | `/admin/coupons/:id` | Delete coupon |
| GET | `/admin/banners` | List all banners |
| POST | `/admin/banners` | Create banner |
| PATCH | `/admin/banners/:id` | Update banner |
| DELETE | `/admin/banners/:id` | Delete banner |
| GET | `/admin/notifications` | List all notifications |
| POST | `/admin/notifications` | Broadcast notification |
| DELETE | `/admin/notifications/:id` | Delete notification |
| POST | `/admin/wallet/adjust` | Manually adjust user wallet `{ userId, amount, note }` |
| GET | `/admin/reviews` | List reviews |
| GET | `/admin/settings` | List all platform settings |
| PUT | `/admin/settings` | Bulk update settings `{ entries: [{ key, value, category? }] }` |

---

## Authentication

All protected routes use Bearer token authentication.

**Register:**
```json
POST /api/auth/register
{
  "name": "Ali",
  "phone": "+22200000000",
  "password": "secret123",
  "role": "CUSTOMER"   // optional, defaults to CUSTOMER
}
```

**Login response:**
```json
{
  "token": "eyJhbGci...",
  "user": { "id": "...", "name": "Ali", "role": "CUSTOMER", ... }
}
```

**Use the token:**
```
Authorization: Bearer eyJhbGci...
```

Tokens expire after `JWT_EXPIRES_IN` (default 30 days). There is no refresh token — the client re-authenticates when a 401 is received.

---

## Real-time (Socket.IO)

Connect to `http://localhost:3000` (same port as HTTP).

### Client events to emit

| Event | Payload | Effect |
|---|---|---|
| `join_order` | `orderId: string` | Joins room `order_<id>` to receive order updates |
| `join_drivers` | — | Joins the `drivers` room to receive new order broadcasts |
| `driver_location` | `{ orderId, lat, lng }` | Broadcasts location to that order's room |

### Server events to listen for

| Event | Room | Payload | Trigger |
|---|---|---|---|
| `new_order` | broadcast | `{ restaurantId, order }` | Customer places order |
| `order_status` | `order_<id>` | `{ orderId, status }` | Any status change |
| `location_update` | `order_<id>` | `{ lat, lng }` | Driver updates location |

---

## File Uploads

Images are uploaded via `POST /api/upload` (multipart/form-data, field name `file`).

- Max size: **8 MB**
- Accepted types: any `image/*` MIME type
- Files are stored in `backend/uploads/` with a UUID filename
- Served publicly at `http://localhost:3000/uploads/<filename>`
- The response returns the full URL: `{ "url": "http://..." }`

Use the returned URL when creating restaurants, menu items, banners, etc.

---

## Platform Settings

Runtime configuration is stored in the `PlatformSetting` table and auto-seeded on startup. Admins can update values via `PUT /api/admin/settings`.

| Key | Category | Default | Description |
|---|---|---|---|
| `platformName` | GENERAL | `7alan` | App display name |
| `supportPhone` | GENERAL | `+22245000000` | Support contact |
| `defaultCurrency` | GENERAL | `MRU` | Currency code |
| `commissionRate` | COMMERCE | `0.15` | Platform fee (15%) |
| `driverCommissionRate` | COMMERCE | `0.20` | Driver take rate |
| `loyaltyPointsRate` | COMMERCE | `0.05` | Points earned per MRU spent |
| `loyaltyRedeemRate` | COMMERCE | `10` | Points per 1 MRU wallet credit |
| `walletEnabled` | COMMERCE | `true` | Enable wallet payments |
| `tippingEnabled` | COMMERCE | `true` | Enable post-delivery tips |
| `referralReward` | GROWTH | `200` | Referrer reward (MRU) |
| `referralFriendReward` | GROWTH | `100` | Referred friend reward (MRU) |
| `courierBaseFee` | COURIER | `60` | Base fee for courier (MRU) |
| `courierPerKm` | COURIER | `18` | Fee per km (MRU) |
| `ordersPushNotifications` | NOTIFICATIONS | `true` | Order push enabled |
| `promoPushNotifications` | NOTIFICATIONS | `true` | Promo push enabled |

---

## Debugging

### Enable verbose logging

Set `NODE_ENV=development` — morgan logs every request to stdout.

### Inspect the database

```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
# Browse and edit any table visually
```

Or use pgAdmin at `http://localhost:5050`.

### Common errors

| Error | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError` | Wrong `DATABASE_URL` or Postgres not running | Check `.env`, start the Docker container |
| `P2002 Unique constraint failed` | Duplicate phone/email on register | Use a different phone number |
| `401 No token provided` | Missing `Authorization` header | Add `Bearer <token>` header |
| `403 Forbidden` | User role not allowed | Check the required role for that endpoint |
| `Cannot find module` after schema change | Prisma client not regenerated | Run `npm run db:generate` |

### Watch logs in real time

```bash
npm run dev
# ts-node-dev prints all console.log and errors with file/line info
```

---

## Deployment

The project is configured for **Railway** deployment.

### railway.toml summary

```
build:   npm ci && npm run build && npx prisma generate
deploy:  npm run migrate:prod && npm start
health:  GET /health (30s timeout)
restart: on_failure (max 3 retries)
```

### Required environment variables on Railway

- `DATABASE_URL` — PostgreSQL connection string (Railway provides this automatically if you add a Postgres plugin)
- `JWT_SECRET` — long random string
- `JWT_EXPIRES_IN` — e.g. `30d`
- `NODE_ENV` — `production`
- `CORS_ORIGINS` — comma-separated allowed origins for your frontend

### Manual VPS deployment with PM2

```bash
git pull
npm ci
npm run build
npx prisma migrate deploy
pm2 restart ecosystem.config.js
```
