"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizePhoneNumber, getPhoneLookupVariants } from "@/lib/phone";
import { parsePrismaError } from "@/lib/database-errors";
import { ensureCreditAccountSchema } from "@/lib/credit-account";

export async function createCustomerAction(formData: FormData) {
  try {
    const admin = await requireAdminSession();

    const name = (formData.get("name") as string || "").trim();
    const rawPhone = (formData.get("phone") as string || "").trim();
    const email = (formData.get("email") as string || "").trim().toLowerCase();
    const pin = (formData.get("pin") as string || "").trim();
    const confirmPin = (formData.get("confirmPin") as string || "").trim();
    const status = (formData.get("status") as string || "ACTIVE").trim();

    if (!name || !rawPhone || !pin || !confirmPin) {
      return { error: "Full Name, Phone Number, and Customer PIN are required." };
    }

    if (pin !== confirmPin) {
      return { error: "PINs do not match." };
    }

    if (pin.length < 6 || pin.length > 8 || !/^\d+$/.test(pin)) {
      return { error: "PIN must be between 6 and 8 digits." };
    }

    // 1. Normalize phone to canonical format (+233XXXXXXXXX for Ghana)
    const phoneVal = normalizePhoneNumber(rawPhone);
    if (!phoneVal.isValid) {
      return { error: phoneVal.error || "Please enter a valid phone number." };
    }
    const phone = phoneVal.normalized;

    // 2. Check duplicate phone using all search/database variants
    const phoneVariants = getPhoneLookupVariants(rawPhone);
    const existingPhone = await prisma.customer.findFirst({
      where: {
        phone: {
          in: phoneVariants,
        },
      },
    });
    if (existingPhone) {
      return { error: "This phone number is already assigned to another customer." };
    }

    // 3. Check duplicate email if provided
    if (email) {
      const existingEmail = await prisma.customer.findFirst({
        where: { email },
      });
      if (existingEmail) {
        return { error: "This email address is already assigned to another customer." };
      }
    }

    // 4. Ensure CreditAccount schema is synchronized with all columns before upsert
    await ensureCreditAccountSchema();

    // 5. Auto-generate customer ID: Find highest number and increment
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
    const customerIdentifier = `LMX8-${newNumber.toString().padStart(5, "0")}`;

    const pinHash = await bcrypt.hash(pin, 10);

    // 6. Execute atomic creation of Customer + CreditAccount + AuditLog in transaction
    const createdCustomerId = await prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          customerIdentifier,
          name,
          phone,
          email: email || undefined,
          pinHash,
          status: status || "ACTIVE",
        },
      });

      // Create a credit account automatically (idempotent upsert prevents duplicates)
      try {
        await tx.creditAccount.upsert({
          where: { customerId: newCustomer.id },
          update: {},
          create: {
            customerId: newCustomer.id,
            balance: 0,
            selectedPackage: "None",
            packagePrice: 0.0,
            creditsPurchased: 0,
            creditsUsed: 0,
            creditsRemaining: 0,
            lastActivityAt: new Date(),
          },
        });
      } catch (upsertError: any) {
        // Fallback: If selectedPackage column is somehow missing in older legacy DB, create with base schema
        if (upsertError?.message?.includes("selectedPackage") || upsertError?.code === "P2021") {
          console.warn("[createCustomer] Fallback CreditAccount creation without selectedPackage");
          await tx.creditAccount.upsert({
            where: { customerId: newCustomer.id },
            update: {},
            create: {
              customerId: newCustomer.id,
              balance: 0,
            },
          });
        } else {
          throw upsertError;
        }
      }

      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_CREATED",
          entityType: "Customer",
          entityId: newCustomer.id,
          description: `Customer ${customerIdentifier} (${name}) created by ${admin.name || admin.email}`,
          adminId: admin.id,
        },
      });

      return newCustomer.id;
    });

    revalidatePath("/admin/customers");
    revalidatePath("/admin/settings");
    return { success: true, customerIdentifier, customerId: createdCustomerId };
  } catch (error: any) {
    console.error("[createCustomerAction] Error creating customer:", error);
    const friendlyError = parsePrismaError(error, "Unable to create customer account. Please try again.");
    return { error: friendlyError };
  }
}

export async function getAdminCustomersAction(searchQuery?: string) {
  await requireAdminSession();

  const term = (searchQuery || "").trim().toLowerCase();

  const customers = await prisma.customer.findMany({
    include: {
      creditAccount: true,
      shipments: { select: { id: true } },
      payments: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = customers.map((c) => ({
    id: c.id,
    customerIdentifier: c.customerIdentifier,
    name: c.name,
    email: c.email || "N/A",
    phone: c.phone || "N/A",
    status: c.status,
    credits: c.creditAccount?.balance || 0,
    shipmentsCount: c.shipments.length,
    paymentsCount: c.payments.length,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  if (!term) return mapped;

  return mapped.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.customerIdentifier.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term)
  );
}

export async function getCustomerDetailsAction(customerIdOrIdentifier: string) {
  await requireAdminSession();

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { id: customerIdOrIdentifier },
        { customerIdentifier: customerIdOrIdentifier },
      ],
    },
    include: {
      creditAccount: true,
      shipments: { select: { id: true, trackingNumber: true, status: true } },
      payments: { select: { id: true, reference: true, amount: true, status: true } },
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  return {
    id: customer.id,
    customerIdentifier: customer.customerIdentifier,
    name: customer.name,
    phone: customer.phone || "",
    email: customer.email || "",
    status: customer.status,
    credits: customer.creditAccount?.balance || 0,
    shipmentsCount: customer.shipments.length,
    paymentsCount: customer.payments.length,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export async function updateCustomerAction(data: {
  customerId: string;
  name: string;
  phone?: string;
  email?: string;
  status?: string;
}) {
  const admin = await requireAdminSession();

  if (!data.customerId) {
    return { error: "Customer ID is required." };
  }

  const name = (data.name || "").trim();
  const phone = (data.phone || "").trim();
  const email = (data.email || "").trim();
  const status = (data.status || "ACTIVE").trim();

  if (!name) {
    return { error: "Full Name cannot be empty." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ id: data.customerId }, { customerIdentifier: data.customerId }],
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  // Normalize phone if provided
  let normalizedPhone: string | null = null;
  if (phone) {
    const phoneVal = normalizePhoneNumber(phone);
    if (!phoneVal.isValid) {
      return { error: phoneVal.error || "Please enter a valid phone number." };
    }
    normalizedPhone = phoneVal.normalized;
  }

  // Check duplicate phone if changed and not empty
  if (normalizedPhone && normalizedPhone !== customer.phone) {
    const phoneVariants = getPhoneLookupVariants(phone);
    const existingPhone = await prisma.customer.findFirst({
      where: {
        phone: { in: phoneVariants },
        NOT: { id: customer.id },
      },
    });
    if (existingPhone) {
      return { error: "This phone number is already assigned to another customer." };
    }
  }

  // Check duplicate email if changed and not empty
  if (email && email !== customer.email) {
    const existingEmail = await prisma.customer.findFirst({
      where: { email, NOT: { id: customer.id } },
    });
    if (existingEmail) {
      return { error: "This email address is already assigned to another customer." };
    }
  }

  const changedFields: string[] = [];
  if (name !== customer.name) changedFields.push("name");
  if (normalizedPhone !== (customer.phone || null)) changedFields.push("phone");
  if (email !== (customer.email || "")) changedFields.push("email");
  if (status !== customer.status) changedFields.push("status");

  if (changedFields.length === 0) {
    return { success: true, message: "No changes detected." };
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: {
      name,
      phone: normalizedPhone || null,
      email: email || null,
      status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    },
  });

  const isStatusChange = changedFields.includes("status");

  await prisma.auditLog.create({
    data: {
      action: isStatusChange ? "CUSTOMER_STATUS_CHANGED" : "CUSTOMER_UPDATED",
      entityType: "Customer",
      entityId: customer.id,
      description: `Customer ${customer.customerIdentifier} (${name}) updated by ${admin.name || admin.email}. Changed: ${changedFields.join(", ")}`,
      adminId: admin.id,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/customers");

  return {
    success: true,
    message: "Customer updated successfully.",
    customer: {
      id: updated.id,
      customerIdentifier: updated.customerIdentifier,
      name: updated.name,
      phone: updated.phone || "",
      email: updated.email || "",
      status: updated.status,
    },
  };
}

export async function resetCustomerPinAction(data: {
  customerId: string;
  newPin: string;
  confirmPin: string;
}) {
  const admin = await requireAdminSession();

  if (!data.customerId) {
    return { error: "Customer ID is required." };
  }

  const newPin = (data.newPin || "").trim();
  const confirmPin = (data.confirmPin || "").trim();

  if (!newPin || !confirmPin) {
    return { error: "New PIN and Confirm PIN are required." };
  }

  if (newPin !== confirmPin) {
    return { error: "PINs do not match." };
  }

  if (newPin.length < 6 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
    return { error: "PIN must be between 6 and 8 digits." };
  }

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ id: data.customerId }, { customerIdentifier: data.customerId }],
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  const pinHash = await bcrypt.hash(newPin, 10);

  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      pinHash,
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CUSTOMER_PIN_RESET",
      entityType: "Customer",
      entityId: customer.id,
      description: `PIN reset for customer ${customer.customerIdentifier} (${customer.name}) by ${admin.name || admin.email}`,
      adminId: admin.id,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/customers");

  return { success: true, message: "PIN changed successfully." };
}

export async function toggleCustomerStatusAction(customerId: string, targetStatus: "ACTIVE" | "INACTIVE") {
  const admin = await requireAdminSession();

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [{ id: customerId }, { customerIdentifier: customerId }],
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  const updated = await prisma.customer.update({
    where: { id: customer.id },
    data: { status: targetStatus },
  });

  await prisma.auditLog.create({
    data: {
      action: "CUSTOMER_STATUS_CHANGED",
      entityType: "Customer",
      entityId: customer.id,
      description: `Customer ${customer.customerIdentifier} status changed to ${targetStatus} by ${admin.name || admin.email}`,
      adminId: admin.id,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin/customers");

  return {
    success: true,
    status: updated.status,
    message: `Customer ${targetStatus === "ACTIVE" ? "activated" : "deactivated"}.`,
  };
}
