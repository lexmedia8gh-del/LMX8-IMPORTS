import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const pin1 = await bcrypt.hash("123456", 10);
  const pin2 = await bcrypt.hash("654321", 10);
  const adminPassword = await bcrypt.hash("admin123", 10);

  // 1. Admin
  const admin = await prisma.adminUser.upsert({
    where: { email: "admin@lmx8.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@lmx8.com",
      name: "Super Admin",
      passwordHash: adminPassword,
      role: "SUPER_ADMIN",
    },
  });

  // 2. Customer A
  const custA = await prisma.customer.upsert({
    where: { customerIdentifier: "LMX8-00125" },
    update: { pinHash: pin1 },
    create: {
      customerIdentifier: "LMX8-00125",
      name: "Kwame Mensah",
      email: "kwame@example.com",
      phone: "+233201234567",
      pinHash: pin1,
    },
  });

  // 3. Customer B (for IDOR isolation testing)
  const custB = await prisma.customer.upsert({
    where: { customerIdentifier: "LMX8-00200" },
    update: { pinHash: pin2 },
    create: {
      customerIdentifier: "LMX8-00200",
      name: "Ama Serwaa",
      email: "ama@example.com",
      phone: "+233245678901",
      pinHash: pin2,
    },
  });

  // 4. Credit Accounts
  await prisma.creditAccount.upsert({
    where: { customerId: custA.id },
    update: { balance: 5 },
    create: {
      customerId: custA.id,
      balance: 5,
    },
  });

  await prisma.creditAccount.upsert({
    where: { customerId: custB.id },
    update: { balance: 2 },
    create: {
      customerId: custB.id,
      balance: 2,
    },
  });

  // 5. Batch
  const batch = await prisma.batch.upsert({
    where: { batchNumber: "BATCH-2026-09" },
    update: {},
    create: {
      batchNumber: "BATCH-2026-09",
      name: "September Sea Consignment A",
      description: "Sea freight from Shenzhen to Tema Port",
      status: "IN_TRANSIT",
      departure: new Date("2026-09-10"),
      arrival: new Date("2026-10-25"),
    },
  });

  // 6. Shipments for Customer A
  const shpA1 = await prisma.shipment.upsert({
    where: { trackingNumber: "SHP-10294" },
    update: {},
    create: {
      trackingNumber: "SHP-10294",
      description: "5x Pallets of Solar Inverters & Batteries",
      status: "IN_TRANSIT",
      origin: "Shenzhen, China",
      destination: "Tema Port, Ghana",
      shippingMethod: "Sea Freight",
      estimatedArrival: new Date("2026-10-25"),
      fee: 2850.00,
      customerId: custA.id,
      batchId: batch.id,
      trackingEvents: {
        create: [
          {
            status: "SHIPMENT_CREATED",
            note: "Received and weighed at Shenzhen warehouse.",
            location: "Shenzhen Warehouse",
            adminId: admin.id,
          },
          {
            status: "IN_TRANSIT",
            note: "Vessel departed Shenzhen port.",
            location: "South China Sea",
            adminId: admin.id,
          },
        ],
      },
    },
  });

  // 7. Shipment for Customer B
  await prisma.shipment.upsert({
    where: { trackingNumber: "SHP-20381" },
    update: {},
    create: {
      trackingNumber: "SHP-20381",
      description: "2x Cartons of Cosmetics & Packaging",
      status: "ARRIVED_AT_DESTINATION",
      origin: "Guangzhou, China",
      destination: "Accra, Ghana",
      shippingMethod: "Air Freight",
      estimatedArrival: new Date("2026-10-02"),
      fee: 640.00,
      customerId: custB.id,
      trackingEvents: {
        create: [
          {
            status: "SHIPMENT_CREATED",
            note: "Received at Guangzhou air hub.",
            location: "Guangzhou Hub",
            adminId: admin.id,
          },
          {
            status: "ARRIVED_AT_DESTINATION",
            note: "Landed at Kotoka International Airport. Clearing customs.",
            location: "KIA, Accra",
            adminId: admin.id,
          },
        ],
      },
    },
  });

  console.log("Phase 2C seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
