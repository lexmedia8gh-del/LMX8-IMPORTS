import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 10);
  const customerPin = await bcrypt.hash("123456", 10);

  // Admin
  await prisma.adminUser.upsert({
    where: { email: "admin@lmx8.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@lmx8.com",
      name: "Admin User",
      passwordHash: adminPassword,
      role: "SUPER_ADMIN"
    }
  });

  // Customer
  await prisma.customer.upsert({
    where: { customerIdentifier: "LMX8-00125" },
    update: { pinHash: customerPin },
    create: {
      customerIdentifier: "LMX8-00125",
      name: "Test Customer",
      email: "customer@lmx8.com",
      phone: "+233201234567",
      pinHash: customerPin
    }
  });

  console.log("Seed completed.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
