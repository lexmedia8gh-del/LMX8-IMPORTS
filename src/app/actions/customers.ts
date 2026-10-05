"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createCustomerAction(formData: FormData) {
  try {
    const admin = await requireAdminSession();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const pin = formData.get("pin") as string;
    const confirmPin = formData.get("confirmPin") as string;
    const status = formData.get("status") as string;

    if (!name || !phone || !pin || !confirmPin) {
      return { error: "Name, phone, and PIN are required." };
    }

    if (pin !== confirmPin) {
      return { error: "PINs do not match." };
    }

    if (pin.length < 6 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return { error: "PIN must be between 6 and 8 digits." };
    }

    // Auto-generate customer ID: Find highest number and increment
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let newNumber = 1;
    if (lastCustomer && lastCustomer.customerIdentifier.startsWith("LMX8-")) {
      const parts = lastCustomer.customerIdentifier.split("-");
      if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
        newNumber = parseInt(parts[1], 10) + 1;
      }
    }
    const customerIdentifier = `LMX8-${newNumber.toString().padStart(5, '0')}`;

    const pinHash = await bcrypt.hash(pin, 10);

    const newCustomer = await prisma.customer.create({
      data: {
        customerIdentifier,
        name,
        phone,
        email: email || undefined,
        pinHash,
        status: status || "ACTIVE",
      },
    });

    // Create a credit account automatically
    await prisma.creditAccount.create({
      data: {
        customerId: newCustomer.id,
        balance: 0,
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: newCustomer.id,
        description: `Customer ${customerIdentifier} created by admin ${admin.email}`,
        adminId: admin.id,
      },
    });

    revalidatePath("/admin/customers");
  } catch (error) {
    console.error("Error creating customer:", error);
    return { error: "An unexpected error occurred." };
  }

  redirect("/admin/customers");
}

export async function getAdminCustomersAction() {
  await requireAdminSession();
  
  const custs = await prisma.customer.findMany({
    include: { creditAccount: true },
    orderBy: { createdAt: "desc" }
  });
  
  return custs.map((c) => ({
    id: c.customerIdentifier,
    name: c.name,
    email: c.email || "N/A",
    phone: c.phone || "N/A",
    status: c.status,
    credits: c.creditAccount?.balance || 0,
  }));
}
