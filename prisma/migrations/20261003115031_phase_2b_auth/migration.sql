-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinHash" TEXT;
