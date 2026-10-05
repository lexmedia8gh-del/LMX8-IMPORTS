// Migration: Create Notification table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Running Notification table migration...');
  
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
        CREATE TYPE "NotificationType" AS ENUM ('SHIPMENT', 'PAYMENT', 'DELIVERY', 'ACCOUNT', 'SYSTEM');
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id"             TEXT NOT NULL,
      "customerId"     TEXT NOT NULL,
      "type"           "NotificationType" NOT NULL DEFAULT 'SYSTEM',
      "title"          TEXT NOT NULL,
      "message"        TEXT NOT NULL,
      "read"           BOOLEAN NOT NULL DEFAULT false,
      "actionUrl"      TEXT,
      "idempotencyKey" TEXT UNIQUE,
      "shipmentId"     TEXT,
      "paymentId"      TEXT,
      "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Notification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Notification_customerId_idx" ON "Notification"("customerId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Notification_customerId_read_idx" ON "Notification"("customerId", "read");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
  `);

  console.log('✅ Notification table created/verified successfully.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
