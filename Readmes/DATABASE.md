# 7alan Database Schema

## Overview

- **Database:** PostgreSQL 17
- **ORM:** Prisma 5
- **ID strategy:** `cuid()` for all primary keys
- **18 models** organized across User, Restaurant, Order, Driver, and Platform domains

---

## Entity Relationship Diagram

```f<<<<>>>>
User ──────────────────────────────────────────────────────────┐
 │                                                             │
 ├── DriverProfile (1:1)                                       │
 │    └── Order[] (driver)                                     │
 │    └── CourierRequest[] (driver)                            │
 │    └── Review[] (driver reviews received)                   │
 │                                                             │
 ├── Restaurant (1:1, owner)                                   │
 │    ├── MenuCategory[]                                       │
 │    │    └── MenuItem[]                                      │
 │    ├── Order[]                                              │
 │    ├── Favorite[]                                           │
 │    ├── Review[]                                             │
 │    ├── Coupon[]                                             │
 │    └── Banner[]                                             │
 │                                                             │
 ├── Order[] (customer) ◄──────────────────────────────────────┘
 │    ├── OrderItem[]
 │    ├── OrderEvent[]
 │    ├── Review (1:1)
 │    └── CouponRedemption (1:1)
 │
 ├── Address[]
 ├── Favorite[]
 ├── CourierRequest[]
 ├── Review[]
 ├── Notification[]
 ├── WalletTransaction[]
 └── CouponRedemption[]

Coupon
 ├── CouponRedemption[]
 └── Order[]

PlatformSetting   (standalone key-value config)
Banner            (can link to Restaurant optionally)
```

---

## Models

### User

Central model — every person using the platform (customer, driver, restaurant owner, admin).

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `phone` | String | Unique — used as login identifier |
| `name` | String | |
| `email` | String? | Optional |
| `avatar` | String? | URL to uploaded image |
| `role` | String | `CUSTOMER` \| `DRIVER` \| `RESTAURANT_OWNER` \| `ADMIN` \| `SUPERADMIN` |
| `adminPermissions` | String? | JSON array of granted permission keys, e.g. `'["orders","restaurants"]'`. Only meaningful for `ADMIN` role; `SUPERADMIN` bypasses all checks. Managed via `PATCH /api/admin/users/:id` (SUPERADMIN only). |
| `password` | String | bcrypt hash |
| `fcmToken` | String? | Firebase push notification token |
| `isActive` | Boolean | Default `true` — admins can deactivate |
| `walletBalance` | Float | Default `0` — in MRU |
| `loyaltyPoints` | Int | Default `0` |
| `referralCode` | String? | Unique referral code generated on register |
| `referredById` | String? | FK → `User.id` |
| `language` | String | Default `EN` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Self-referential relation:** `referredBy` / `referrals` — a user can refer many users, each user has at most one referrer.

---

### DriverProfile

Created when a user registers as a driver via `POST /api/drivers/register`. One-to-one with User.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | Unique FK → User |
| `vehicleType` | String | Default `MOTO` |
| `vehiclePlate` | String | |
| `isOnline` | Boolean | Default `false` |
| `currentLat` | Float? | Last known GPS latitude |
| `currentLng` | Float? | Last known GPS longitude |
| `rating` | Float | Default `5.0` |
| `totalDeliveries` | Int | Default `0` |
| `earnings` | Float | Total earnings in MRU |
| `totalTips` | Float | Total tips received |
| `totalRatings` | Int | Number of ratings received |

---

### Restaurant

One per owner. Created via `POST /api/restaurants`, which also upgrades the user's role to `RESTAURANT_OWNER`.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `ownerId` | String | Unique FK → User |
| `name` | String | |
| `nameAr` | String? | Arabic name |
| `description` | String? | |
| `storeType` | String | Default `FOOD` |
| `category` | String | e.g. `Burgers`, `Pizza` |
| `logo` | String? | URL |
| `coverImage` | String? | URL |
| `address` | String | Human-readable address |
| `lat` | Float | GPS latitude |
| `lng` | Float | GPS longitude |
| `phone` | String | |
| `isOpen` | Boolean | Default `true` — owner toggles |
| `isActive` | Boolean | Default `true` — admin toggles |
| `deliveryFee` | Float | Default `50` MRU |
| `minOrder` | Float | Default `200` MRU |
| `deliveryTime` | Int | Default `30` minutes |
| `rating` | Float | Default `5.0` — computed from reviews |
| `totalOrders` | Int | Counter |
| `totalRatings` | Int | Counter |
| `tags` | String? | Comma-separated tags |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### MenuCategory

Organizes menu items within a restaurant. Cascade-deleted when restaurant is deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `restaurantId` | String | FK → Restaurant (cascade) |
| `name` | String | |
| `nameAr` | String? | |
| `image` | String? | URL |
| `sortOrder` | Int | Default `0` — for display ordering |

---

### MenuItem

Individual dish/product within a menu category. Cascade-deleted when category is deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `categoryId` | String | FK → MenuCategory (cascade) |
| `name` | String | |
| `nameAr` | String? | |
| `description` | String? | |
| `price` | Float | In MRU |
| `image` | String? | URL |
| `isAvailable` | Boolean | Default `true` |

---

### Address

Saved delivery addresses for a user.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | FK → User |
| `label` | String | e.g. `Home`, `Work` |
| `address` | String | Human-readable |
| `lat` | Float | |
| `lng` | Float | |
| `isDefault` | Boolean | Default `false` |

---

### Order

Core transaction model.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `customerId` | String | FK → User |
| `restaurantId` | String | FK → Restaurant |
| `driverId` | String? | FK → DriverProfile (assigned when driver accepts) |
| `status` | String | See flow below |
| `subtotal` | Float | Sum of item prices |
| `deliveryFee` | Float | Snapshot at time of order |
| `total` | Float | subtotal + deliveryFee − discount + tip |
| `discount` | Float | Default `0` |
| `tip` | Float | Default `0` — added post-delivery |
| `couponId` | String? | FK → Coupon |
| `couponCode` | String? | Snapshot of code used |
| `deliveryAddress` | String | Text address |
| `deliveryLat` | Float | |
| `deliveryLng` | Float | |
| `paymentMethod` | String | Default `CASH` |
| `notes` | String? | Special instructions |
| `estimatedTime` | Int? | Minutes |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Status flow:**
```
PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → PICKED_UP → DELIVERED
                                                                 CANCELLED (from PENDING only)
```

---

### OrderItem

Line items within an order. Cascade-deleted when order is deleted.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `orderId` | String | FK → Order (cascade) |
| `menuItemId` | String | FK → MenuItem (price snapshot in `price`) |
| `quantity` | Int | |
| `price` | Float | Snapshot of price at order time |
| `notes` | String? | Item-level notes |

---

### OrderEvent

Audit trail / timeline of status changes for an order. Cascade-deleted with order.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `orderId` | String | FK → Order (cascade) |
| `status` | String | The new status |
| `note` | String? | Optional note |
| `createdAt` | DateTime | |

---

### Coupon

Discount codes, platform-wide or per-restaurant.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `code` | String | Unique |
| `description` | String? | |
| `type` | String | `PERCENTAGE` \| `FIXED` |
| `value` | Float | Percentage (0–100) or fixed MRU amount |
| `minOrder` | Float | Minimum order subtotal |
| `maxDiscount` | Float? | Cap for percentage coupons |
| `usageLimit` | Int? | Total redemptions allowed (null = unlimited) |
| `usedCount` | Int | Running counter |
| `perUserLimit` | Int | Default `1` — uses per user |
| `startsAt` | DateTime? | Activation date |
| `expiresAt` | DateTime? | Expiry date |
| `isActive` | Boolean | Default `true` |
| `scope` | String | `ALL` \| `RESTAURANT` \| `STORE_TYPE` |
| `storeType` | String? | Filter by store type |
| `restaurantId` | String? | FK → Restaurant (null = all restaurants) |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### CouponRedemption

Tracks which user redeemed which coupon on which order. Unique per order.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `couponId` | String | FK → Coupon (cascade) |
| `userId` | String | FK → User |
| `orderId` | String? | Unique FK → Order |
| `amount` | Float | Discount amount applied |
| `createdAt` | DateTime | |

---

### Review

Post-delivery review — covers both restaurant and driver in one record.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | FK → User (reviewer) |
| `restaurantId` | String? | FK → Restaurant (cascade) |
| `driverId` | String? | FK → DriverProfile |
| `orderId` | String? | Unique FK → Order (one review per order) |
| `rating` | Int | 1–5 for restaurant |
| `driverRating` | Int? | 1–5 for driver |
| `comment` | String? | |
| `createdAt` | DateTime | |

---

### CourierRequest

Package delivery requests (not food — point-to-point parcel).

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `customerId` | String | FK → User |
| `driverId` | String? | FK → DriverProfile (assigned driver) |
| `status` | String | `PENDING` \| `ASSIGNED` \| `PICKED_UP` \| `DELIVERED` \| `CANCELLED` |
| `pickupAddress` | String | Human-readable text (always required) |
| `pickupLat` | Float? | GPS latitude — nullable (text-only address allowed) |
| `pickupLng` | Float? | GPS longitude — nullable |
| `dropAddress` | String | Human-readable text |
| `dropLat` | Float? | GPS latitude — nullable |
| `dropLng` | Float? | GPS longitude — nullable |
| `packageSize` | String | `SMALL` \| `MEDIUM` \| `LARGE`. Default `SMALL` |
| `photo` | String? | URL of optional package photo (uploaded to R2) |
| `senderName` | String? | Pre-filled from customer profile |
| `senderPhone` | String? | Pre-filled from customer profile |
| `recipientName` | String? | Required in customer app |
| `recipientPhone` | String? | Required in customer app |
| `notes` | String? | |
| `fee` | Float | Calculated at request time. Default `0` |
| `distance` | Float? | km |
| `estimatedTime` | Int? | minutes |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Fee formula:** `60 + (18 × distance × sizeMultiplier)`
- SMALL × 1.0, MEDIUM × 1.25, LARGE × 1.6

---

### Notification

In-app notifications, optionally targeted to a specific user (null = broadcast).

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String? | FK → User (cascade). Null = global |
| `title` | String | |
| `body` | String | |
| `type` | String | Default `INFO` |
| `data` | String? | JSON string for deep-link data |
| `read` | Boolean | Default `false` |
| `createdAt` | DateTime | |

---

### Banner

Promotional banners shown in app home screens.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `title` | String | |
| `subtitle` | String? | |
| `image` | String? | URL |
| `backgroundColor` | String? | Hex color |
| `ctaText` | String? | Button label |
| `ctaUrl` | String? | Deep link or URL |
| `storeType` | String? | Filter by store type |
| `restaurantId` | String? | FK → Restaurant (SetNull on delete) |
| `sortOrder` | Int | Default `0` |
| `isActive` | Boolean | Default `true` |
| `startsAt` | DateTime? | |
| `endsAt` | DateTime? | |
| `createdAt` | DateTime | |

---

### Favorite

Saved restaurant per user. Unique constraint on `(userId, restaurantId)`.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | FK → User |
| `restaurantId` | String | FK → Restaurant (cascade) |
| `createdAt` | DateTime | |

---

### WalletTransaction

Ledger of all wallet credits and debits for a user.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `userId` | String | FK → User |
| `amount` | Float | Positive = credit, negative = debit |
| `type` | String | `CREDIT` \| `DEBIT` |
| `source` | String | `ORDER` \| `REFERRAL` \| `LOYALTY` \| `ADJUSTMENT` \| ... |
| `reference` | String? | Related entity ID (order, etc.) |
| `note` | String? | Human-readable description |
| `createdAt` | DateTime | |

---

### PlatformSetting

Key-value runtime configuration managed by admins.

| Column | Type | Notes |
|---|---|---|
| `id` | String | PK, cuid |
| `key` | String | Unique — e.g. `commissionRate` |
| `value` | String | Always stored as string |
| `category` | String | `GENERAL` \| `COMMERCE` \| `GROWTH` \| `COURIER` \| `NOTIFICATIONS` |
| `updatedAt` | DateTime | |

See [BACKEND.md](./BACKEND.md#platform-settings) for the full list of keys and defaults.

---

## Cascade / Delete Behavior Summary

| Parent deleted | Child behavior |
|---|---|
| Restaurant | MenuCategory cascade → MenuItem cascade |
| Restaurant | Favorite cascade |
| Restaurant | Review cascade |
| MenuCategory | MenuItem cascade |
| Order | OrderItem cascade |
| Order | OrderEvent cascade |
| Coupon | CouponRedemption cascade |
| User | Notification cascade |
| User on Restaurant | Coupon.restaurantId → SetNull |
| User on Banner | Banner.restaurantId → SetNull |

---

## Indexes

Prisma auto-creates indexes for:
- All `@id` fields
- All `@unique` fields: `User.phone`, `User.referralCode`, `Favorite(userId, restaurantId)`, `Review.orderId`, `CouponRedemption.orderId`, `Coupon.code`, `DriverProfile.userId`, `Restaurant.ownerId`, `PlatformSetting.key`

---

## Useful Prisma Commands

```bash
# Open visual DB browser
npm run db:studio

# Create a new migration after editing schema.prisma
npm run db:migrate
# Prompts for a migration name, creates SQL in prisma/migrations/

# Apply migrations in production (no prompts)
npm run migrate:prod

# Push schema changes without a migration (dev only, resets drift)
npm run db:push

# Regenerate Prisma client (after any schema change)
npm run db:generate

# Run seed script
npm run db:seed
```
