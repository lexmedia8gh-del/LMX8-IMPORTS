"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { normalizePhoneNumber, getPhoneLookupVariants } from "@/lib/phone";
import { parsePrismaError } from "@/lib/database-errors";
import { ensureCreditAccountSchema } from "@/lib/credit-account";
import { ensureDatabaseSeeded } from "@/lib/db-seed";

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

    // 6. Execute atomic creation of Customer + CreditAccount + 1 Welcome Credit + AuditLog in transaction
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

      // 1. Create a credit account automatically with 1 initial welcome credit
      try {
        await tx.creditAccount.upsert({
          where: { customerId: newCustomer.id },
          update: {
            balance: 1,
            creditsRemaining: 1,
            creditsPurchased: 1,
          },
          create: {
            customerId: newCustomer.id,
            balance: 1,
            selectedPackage: "Starter",
            packagePrice: 0.0,
            creditsPurchased: 1,
            creditsUsed: 0,
            creditsRemaining: 1,
            lastActivityAt: new Date(),
          },
        });
      } catch (upsertError: any) {
        // Fallback: If selectedPackage column is somehow missing in older legacy DB, create with base schema
        if (upsertError?.message?.includes("selectedPackage") || upsertError?.code === "P2021") {
          console.warn("[createCustomer] Fallback CreditAccount creation without selectedPackage");
          await tx.creditAccount.upsert({
            where: { customerId: newCustomer.id },
            update: { balance: 1 },
            create: {
              customerId: newCustomer.id,
              balance: 1,
            },
          });
        } else {
          throw upsertError;
        }
      }

      // 2. Record initial +1 credit in the CreditTransaction ledger
      await tx.creditTransaction.create({
        data: {
          type: "BONUS",
          amount: 1,
          balanceBefore: 0,
          balanceAfter: 1,
          reference: `WELCOME_CREDIT:${newCustomer.id}`,
          description: "Welcome sourcing credit",
          customerId: newCustomer.id,
        },
      });

      // 3. Record AuditLog
      await tx.auditLog.create({
        data: {
          action: "CUSTOMER_CREATED",
          entityType: "Customer",
          entityId: newCustomer.id,
          description: `Customer ${customerIdentifier} (${name}) created with 1 welcome sourcing credit by ${admin.name || admin.email}`,
          adminId: admin.id,
          metadata: {
            welcomeCreditAwarded: 1,
          },
        },
      });

      return newCustomer.id;
    });

    revalidatePath("/admin/customers");
    revalidatePath("/admin/settings");
    revalidatePath("/portal");
    revalidatePath("/portal/credits");
    revalidatePath("/portal/sourcing");

    // Dispatch Welcome Email through Central Email Service (non-blocking)
    import("@/lib/email/brevo").then(({ sendCustomerCreatedEmail }) => {
      sendCustomerCreatedEmail(createdCustomerId).catch((err) =>
        console.error("[Brevo] Error dispatching welcome email:", err)
      );
    });

    return { success: true, customerIdentifier, customerId: createdCustomerId };
  } catch (error: any) {
    console.error("[createCustomerAction] Error creating customer:", error);
    const friendlyError = parsePrismaError(error, "Unable to create customer account. Please try again.");
    return { error: friendlyError };
  }
}

export async function getAdminCustomersAction(searchQuery?: string) {
  await requireAdminSession();
  await ensureDatabaseSeeded();

  const term = (searchQuery || "").trim().toLowerCase();

  try {
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
      shipmentsCount: c.shipments?.length || 0,
      paymentsCount: c.payments?.length || 0,
      createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
    }));

    if (!term) return mapped;

    return mapped.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.customerIdentifier.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  } catch (error) {
    console.error("[getAdminCustomersAction] Error fetching customers:", error);
    // Fallback simple query without relations if relation query fails
    const fallbackCustomers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    const mappedFallback = fallbackCustomers.map((c) => ({
      id: c.id,
      customerIdentifier: c.customerIdentifier,
      name: c.name,
      email: c.email || "N/A",
      phone: c.phone || "N/A",
      status: c.status,
      credits: 0,
      shipmentsCount: 0,
      paymentsCount: 0,
      createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString(),
    }));

    if (!term) return mappedFallback;

    return mappedFallback.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.customerIdentifier.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }
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

export async function sendCustomerCredentialsEmailAction(customerId: string) {
  try {
    const admin = await requireAdminSession();

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customerId }, { customerIdentifier: customerId }],
      },
    });

    if (!customer) {
      return { error: "Customer not found." };
    }

    if (!customer.email || !customer.email.includes("@")) {
      return { error: "Customer does not have a valid email address configured." };
    }

    const { sendCustomerCredentialsEmail } = await import("@/lib/email/brevo");
    const result = await sendCustomerCredentialsEmail(customer.id);

    if (result.success) {
      await prisma.auditLog.create({
        data: {
          action: "CREDENTIALS_DISPATCHED_EMAIL",
          entityType: "Customer",
          entityId: customer.id,
          description: `Login access instructions dispatched via Brevo email to ${customer.email} by ${admin.name || admin.email}`,
          adminId: admin.id,
        },
      });

      return {
        success: true,
        message: `Portal access instructions sent successfully to ${customer.email}.`,
      };
    } else {
      return {
        error: result.error || "Failed to dispatch email via Brevo. Check email service configuration.",
      };
    }
  } catch (err: any) {
    console.error("[sendCustomerCredentialsEmailAction] Error:", err);
    return { error: err?.message || "Failed to send credentials." };
  }
}

export async function prepareCustomerWhatsAppCredentialsAction(customerId: string) {
  try {
    await requireAdminSession();

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customerId }, { customerIdentifier: customerId }],
      },
    });

    if (!customer) {
      return { error: "Customer not found." };
    }

    if (!customer.phone) {
      return { error: "Customer does not have a registered phone number." };
    }

    // Clean phone for WhatsApp international link (digits only, no + or spaces)
    let cleanPhone = customer.phone.replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "233" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("233") && cleanPhone.length === 9) {
      cleanPhone = "233" + cleanPhone;
    }

    const host = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://lmx8imports.com";
    const loginUrl = `${host.replace(/\/$/, "")}/login`;

    const messageText = `Hello ${customer.name},

Welcome to LMX8 IMPORTS! Here are your customer portal access details:

📦 Customer ID: ${customer.customerIdentifier}
🔗 Login Portal: ${loginUrl}

How to sign in:
1. Tap the portal link above.
2. Enter your Customer ID (${customer.customerIdentifier}) or registered phone number.
3. Enter your secret 6-8 digit Customer PIN.

🔒 Security Notice: Keep your PIN private. You can change your PIN anytime inside your profile. For support or a PIN reset, please reply directly to this message.

Thank you for choosing LMX8 IMPORTS!`;

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

    return {
      success: true,
      customerId: customer.id,
      customerIdentifier: customer.customerIdentifier,
      name: customer.name,
      phone: customer.phone,
      cleanPhone,
      loginUrl,
      messageText,
      whatsappUrl,
    };
  } catch (err: any) {
    console.error("[prepareCustomerWhatsAppCredentialsAction] Error:", err);
    return { error: err?.message || "Failed to prepare WhatsApp message." };
  }
}

export async function changeCustomerPinAction(data: {
  currentPin: string;
  newPin: string;
  confirmPin: string;
}) {
  try {
    const { getCurrentCustomer } = await import("@/lib/auth");
    const customer = await getCurrentCustomer();
    if (!customer || customer.status !== "ACTIVE") {
      return { error: "Unauthorized: Active customer session required." };
    }

    const currentPin = (data.currentPin || "").trim();
    const newPin = (data.newPin || "").trim();
    const confirmPin = (data.confirmPin || "").trim();

    if (!currentPin || !newPin || !confirmPin) {
      return { error: "Current PIN, New PIN, and Confirm PIN are all required." };
    }

    if (newPin !== confirmPin) {
      return { error: "New PIN and Confirm PIN do not match." };
    }

    if (newPin.length < 6 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      return { error: "New PIN must be between 6 and 8 numeric digits." };
    }

    if (currentPin === newPin) {
      return { error: "New PIN must be different from your current PIN." };
    }

    // Rate limit check
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      return { error: "Account is temporarily locked due to too many failed attempts. Try again later." };
    }

    if (!customer.pinHash) {
      return { error: "Account credentials incomplete. Please contact support." };
    }

    // Verify current PIN
    const isCurrentMatch = await bcrypt.compare(currentPin, customer.pinHash);
    if (!isCurrentMatch) {
      const newAttempts = customer.loginAttempts + 1;
      let lockedUntil = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await prisma.customer.update({
        where: { id: customer.id },
        data: { loginAttempts: newAttempts, lockedUntil },
      });
      return { error: "Incorrect current PIN. Please check and try again." };
    }

    // Hash and store new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        pinHash: newPinHash,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // 1. Audit Log (Never record PIN)
    await prisma.auditLog.create({
      data: {
        action: "CUSTOMER_PIN_CHANGED",
        entityType: "Customer",
        entityId: customer.id,
        description: `Customer ${customer.customerIdentifier} (${customer.name}) changed their security PIN`,
      },
    });

    // 2. In-app confirmation notification for Customer
    await prisma.notification.create({
      data: {
        customerId: customer.id,
        type: "ACCOUNT",
        title: "PIN Changed Successfully",
        message: "Your customer portal PIN was updated successfully. Use your new PIN on your next login.",
        actionUrl: "/portal/profile",
      },
    });

    // 3. Security alert for Administrators
    // Note: We never log the PIN itself!
    try {
      const admins = await prisma.adminUser.findMany({
        where: { status: "ACTIVE" },
      });
      for (const a of admins) {
        await prisma.auditLog.create({
          data: {
            action: "ADMIN_SECURITY_ALERT_PIN_CHANGED",
            entityType: "Customer",
            entityId: customer.id,
            description: `Security Notice: Customer ${customer.customerIdentifier} (${customer.name}) changed their security PIN on ${new Date().toLocaleString("en-GH")}.`,
            adminId: a.id,
          },
        });
      }
    } catch {
      // Non-blocking
    }

    return {
      success: true,
      message: "Your security PIN has been updated successfully.",
    };
  } catch (err: any) {
    console.error("[changeCustomerPinAction] Error:", err);
    return { error: err?.message || "Failed to update PIN. Please try again." };
  }
}

