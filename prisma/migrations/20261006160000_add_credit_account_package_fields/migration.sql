-- AlterTable CreditAccount to add selectedPackage, packagePrice, creditsPurchased, creditsUsed, creditsRemaining, lastActivityAt
-- Matches the Prisma schema:
--   selectedPackage  String?
--   packagePrice     Float     @default(0.0)
--   creditsPurchased Int       @default(0)
--   creditsUsed      Int       @default(0)
--   creditsRemaining Int       @default(0)
--   lastActivityAt   DateTime?

ALTER TABLE "CreditAccount" 
  ADD COLUMN IF NOT EXISTS "selectedPackage" TEXT,
  ADD COLUMN IF NOT EXISTS "packagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS "creditsPurchased" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
