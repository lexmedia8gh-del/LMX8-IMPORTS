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

    // Dispatch Welcome Email through Central Email Service with Customer PIN (non-blocking)
    import("@/lib/email/brevo").then(({ sendCustomerCreatedEmail }) => {
      sendCustomerCreatedEmail(createdCustomerId, pin).catch((err) =>
        console.error("[Brevo] Error dispatching welcome email with PIN:", err)
      );
    });

    return { success: true, customerIdentifier, customerId: createdCustomerId, pin };
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
  notifyCustomer?: boolean;
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
      description: `PIN reset for customer ${customer.customerIdentifier} (${customer.name}) by ${admin.name || admin.email}${data.notifyCustomer ? " (credentials email dispatched)" : ""}`,
      adminId: admin.id,
    },
  });

  // Automatically dispatch credentials email with the new PIN if requested
  if (data.notifyCustomer && customer.email && customer.email.includes("@")) {
    import("@/lib/email/brevo").then(({ sendCustomerCredentialsEmail }) => {
      sendCustomerCredentialsEmail(customer.id, newPin).catch((err) =>
        console.error("[Brevo] Error dispatching credentials email after PIN reset:", err)
      );
    });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/customers");

  return {
    success: true,
    message: `PIN changed successfully.${data.notifyCustomer ? " Email with new PIN has been dispatched." : ""}`,
    newPin,
  };
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

export async function sendCustomerCredentialsEmailAction(customerId: string, pin?: string) {
  try {
    const admin = await requireAdminSession();

    if (!customerId) {
      return { error: "Customer ID is required." };
    }

    const { sendCustomerCredentialsEmail } = await import("@/lib/email/brevo");
    const result = await sendCustomerCredentialsEmail(customerId, pin);

    if (result.success) {
      const deliveredPin = result.pin || pin;
      await prisma.auditLog.create({
        data: {
          action: "CUSTOMER_CREDENTIALS_EMAIL_SENT",
          entityType: "Customer",
          entityId: customerId,
          description: `Account credentials email with PIN (${deliveredPin || "N/A"}) dispatched to ${result.recipient} by ${admin.name || admin.email}`,
          adminId: admin.id,
        },
      });

      return {
        success: true,
        pin: deliveredPin,
        message: `Account credentials with Login PIN (${deliveredPin}) sent to ${result.recipient}.`,
        messageId: result.messageId,
      };
    } else {
      return {
        error: result.error || "Unable to send credentials email.",
      };
    }
  } catch (err: any) {
    console.error("[sendCustomerCredentialsEmailAction] Error:", err);
    return { error: err?.message || "An unexpected error occurred while sending credentials." };
  }
}

export async function prepareCustomerWhatsAppMessageAction(customerId: string, pin?: string) {
  try {
    const admin = await requireAdminSession();

    if (!customerId) {
      return { error: "Customer ID is required." };
    }

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [{ id: customerId }, { customerIdentifier: customerId }],
      },
    });

    if (!customer) {
      return { error: "Customer not found." };
    }

    if (!customer.phone) {
      return { error: "Customer does not have a registered phone number for WhatsApp delivery." };
    }

    // Determine or generate guaranteed login PIN
    let effectivePin = pin ? pin.trim() : "";
    if (!effectivePin) {
      effectivePin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Synchronize customer's PIN hash so this PIN is immediately active
    const pinHash = await bcrypt.hash(effectivePin, 10);
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        pinHash,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Clean phone number for international WhatsApp format
    let cleanPhone = customer.phone.replace(/[^\d+]/g, "");
    if (cleanPhone.startsWith("+")) {
      cleanPhone = cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("0") && cleanPhone.length === 10) {
      // Ghana format: 024XXXXXXX -> 23324XXXXXXX
      cleanPhone = "233" + cleanPhone.substring(1);
    }

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://lmx8imports.com";
    const loginUrl = `${appUrl.replace(/\/$/, "")}/login`;

    const pinLine = `• Login PIN: *${effectivePin}*`;
    const step3 = `3. Enter your secret Login PIN: *${effectivePin}*`;

    const messageText = `Hello ${customer.name},

Here are your official LMX8 IMPORTS Customer Portal access credentials:

• Customer ID: ${customer.customerIdentifier}
• Registered Phone: ${customer.phone}
${pinLine}
• Portal Login: ${loginUrl}

How to Sign In:
1. Open the portal login link: ${loginUrl}
2. Enter your Customer ID (${customer.customerIdentifier}) or registered phone
${step3}
4. Track live shipments, submit product sourcing requests, and pay shipping fees!

Security Notice: Never share your PIN with anyone. You can change your PIN anytime inside My Profile > Change PIN.

LMX8 IMPORTS — Your Goods. Our Priority.`;

    const encodedText = encodeURIComponent(messageText);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;

    await prisma.auditLog.create({
      data: {
        action: "CUSTOMER_WHATSAPP_PREPARED",
        entityType: "Customer",
        entityId: customer.id,
        description: `WhatsApp login credentials with PIN (${effectivePin}) prepared for ${customer.name} by ${admin.name || admin.email}`,
        adminId: admin.id,
      },
    });

    return {
      success: true,
      pin: effectivePin,
      phone: customer.phone,
      formattedPhone: cleanPhone,
      messageText,
      whatsappUrl,
      customerName: customer.name,
      customerIdentifier: customer.customerIdentifier,
      pinIncluded: Boolean(effectivePin),
    };
  } catch (err: any) {
    console.error("[prepareCustomerWhatsAppMessageAction] Error:", err);
    return { error: err?.message || "Failed to prepare WhatsApp message." };
  }
}

