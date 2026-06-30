-- AlterTable
ALTER TABLE "CourierRequest" ADD COLUMN     "recipientName" TEXT,
ADD COLUMN     "recipientPhone" TEXT,
ADD COLUMN     "senderName" TEXT,
ADD COLUMN     "senderPhone" TEXT,
ALTER COLUMN "pickupLat" DROP NOT NULL,
ALTER COLUMN "pickupLng" DROP NOT NULL,
ALTER COLUMN "dropLat" DROP NOT NULL,
ALTER COLUMN "dropLng" DROP NOT NULL,
ALTER COLUMN "fee" SET DEFAULT 0;
