import { prisma } from "@/lib/prisma";
import { ensureCreditAccountSchema } from "@/lib/credit-account";
import bcrypt from "bcryptjs";

let seedChecked = false;

/**
 * Automatically seeds the database if it is empty.
 * Guarantees that Admin and Customer records exist so the Admin page
 * never renders "No customers found" on a fresh database.
 */
export async function ensureDatabaseSeeded(): Promise<boolean> {
  if (seedChecked) return true;

  try {
    await ensureCreditAccountSchema();

    const customerCount = await prisma.customer.count();
    const adminCount = await prisma.adminUser.count();

    if (adminCount === 0) {
      const adminPassword = await bcrypt.hash("admin123", 10);
      await prisma.adminUser.upsert({
        where: { email: "admin@lmx8.com" },
        update: { passwordHash: adminPassword },
        create: {
          email: "admin@lmx8.com",
          name: "Super Admin",
          passwordHash: adminPassword,
          role: "SUPER_ADMIN",
        },
      });
    }

    if (customerCount === 0) {
      const pin1 = await bcrypt.hash("123456", 10);
      const pin2 = await bcrypt.hash("654321", 10);

      // Customer A
      const custA = await prisma.customer.upsert({
        where: { customerIdentifier: "LMX8-00125" },
        update: { pinHash: pin1 },
        create: {
          customerIdentifier: "LMX8-00125",
          name: "Kwame Mensah",
          email: "kwame@example.com",
          phone: "+233201234567",
          pinHash: pin1,
          status: "ACTIVE",
        },
      });

      // Customer B
      const custB = await prisma.customer.upsert({
        where: { customerIdentifier: "LMX8-00200" },
        update: { pinHash: pin2 },
        create: {
          customerIdentifier: "LMX8-00200",
          name: "Ama Serwaa",
          email: "ama@example.com",
          phone: "+233245678901",
          pinHash: pin2,
          status: "ACTIVE",
        },
      });

      // Credit Accounts
      await prisma.creditAccount.upsert({
        where: { customerId: custA.id },
        update: { balance: 5 },
        create: {
          customerId: custA.id,
          balance: 5,
          selectedPackage: "Starter",
          packagePrice: 30.0,
          creditsPurchased: 5,
          creditsRemaining: 5,
        },
      });

      await prisma.creditAccount.upsert({
        where: { customerId: custB.id },
        update: { balance: 2 },
        create: {
          customerId: custB.id,
          balance: 2,
          selectedPackage: "None",
          creditsRemaining: 2,
        },
      });

      // Default Batch
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

      // Sample Shipments
      await prisma.shipment.upsert({
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
        },
      });

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
        },
      });
    }

    seedChecked = true;
    return true;
  } catch (err: any) {
    console.warn("[ensureDatabaseSeeded] Error:", err?.message || err);
    return false;
  }
}
