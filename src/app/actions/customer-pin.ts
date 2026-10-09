"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireCustomerSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function changeCustomerPinAction(
  currentPin: string,
  newPin: string,
  confirmPin: string
) {
  const cur = (currentPin || "").trim();
  const nxt = (newPin || "").trim();
  const cfm = (confirmPin || "").trim();

  if (!cur || !nxt || !cfm) {
    return { error: "Current PIN, New PIN, and Confirm PIN are all required." };
  }

  if (nxt !== cfm) {
    return { error: "New PIN and Confirm PIN do not match." };
  }

  if (nxt.length < 6 || nxt.length > 8 || !/^\d+$/.test(nxt)) {
    return { error: "New PIN must be between 6 and 8 digits (numbers only)." };
  }

  if (cur === nxt) {
    return { error: "New PIN cannot be identical to your current PIN." };
  }

  try {
    const sessionCustomer = await requireCustomerSession();

    // Reload customer record directly from DB to inspect security state
    const customer = await prisma.customer.findUnique({
      where: { id: sessionCustomer.id },
    });

    if (!customer) {
      return { error: "Customer account not found." };
    }

    if (customer.status !== "ACTIVE") {
      return { error: "Account is not active. Please contact support." };
    }

    // Check account lockout
    if (customer.lockedUntil && customer.lockedUntil > new Date()) {
      return {
        error: "Account is temporarily locked due to too many failed attempts. Please try again later.",
      };
    }

    if (!customer.pinHash) {
      return { error: "Initial PIN setup required. Please contact support." };
    }

    // Verify current PIN
    const isCurrentValid = await bcrypt.compare(cur, customer.pinHash);

    if (!isCurrentValid) {
      const attempts = (customer.loginAttempts || 0) + 1;
      let lockedUntil: Date | null = null;

      if (attempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_PIN_LOCKED",
            entityType: "Customer",
            entityId: customer.id,
            description: `Customer ${customer.customerIdentifier} locked due to 5 failed current PIN attempts`,
          },
        });
      } else {
        await prisma.auditLog.create({
          data: {
            action: "CUSTOMER_PIN_CHANGE_FAILED",
            entityType: "Customer",
            entityId: customer.id,
            description: `Customer ${customer.customerIdentifier} failed current PIN verification (${attempts}/5)`,
          },
        });
      }

      await prisma.customer.update({
        where: { id: customer.id },
        data: { loginAttempts: attempts, lockedUntil },
      });

      return { error: "Current PIN is incorrect." };
    }

    // Hash the new PIN using salted bcrypt
    const newPinHash = await bcrypt.hash(nxt, 10);

    // Update customer record: reset attempts and set new hash
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        pinHash: newPinHash,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    const timestamp = new Date().toISOString();

    // 1. Audit log
    await prisma.auditLog.create({
      data: {
        action: "CUSTOMER_PIN_CHANGED",
        entityType: "Customer",
        entityId: customer.id,
        description: `Customer ${customer.customerIdentifier} (${customer.name}) changed their security PIN`,
        metadata: {
          customerIdentifier: customer.customerIdentifier,
          timestamp,
        },
      },
    });

    // 2. In-app Customer Notification
    await prisma.notification.create({
      data: {
        customerId: customer.id,
        title: "Security PIN Changed",
        message: `Your portal security PIN was successfully updated on ${new Date().toLocaleString("en-GH")}. If you did not make this change, please alert support immediately.`,
        type: "ACCOUNT",
      },
    });

    // 3. Admin Security Alert Notification (non-blocking)
    import("@/lib/email/brevo").then(async ({ sendBrevoEmail, wrapInBrandedLayout }) => {
      try {
        // Find super admins or fallback to admin notification email
        const adminUsers = await prisma.adminUser.findMany({
          where: { status: "ACTIVE", role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          select: { email: true, name: true },
        });

        const adminRecipients = adminUsers.map((a) => ({ email: a.email, name: a.name }));
        if (adminRecipients.length > 0) {
          const alertBody = `
            <p class="greeting">Security Alert: Customer PIN Changed</p>
            <p class="lead">A customer has successfully updated their 6-digit access PIN.</p>
            <div class="status-card" style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 18px; border-radius: 12px;">
              <table>
                <tr>
                  <td class="label">Customer Name:</td>
                  <td class="val">${customer.name}</td>
                </tr>
                <tr>
                  <td class="label">Customer ID:</td>
                  <td class="val" style="font-family: monospace; color: #141B47; font-weight: 800;">${customer.customerIdentifier}</td>
                </tr>
                <tr>
                  <td class="label">Registered Phone:</td>
                  <td class="val">${customer.phone || "N/A"}</td>
                </tr>
                <tr>
                  <td class="label">Event Timestamp:</td>
                  <td class="val">${new Date().toLocaleString("en-GH")}</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 12px; color: #64748B;">For security reasons, actual PIN values are never stored or transmitted in plain text.</p>
          `;

          const alertHtml = await wrapInBrandedLayout(
            `Security Notice: Customer PIN Changed (${customer.customerIdentifier})`,
            alertBody
          );

          await sendBrevoEmail({
            to: adminRecipients,
            subject: `[LMX8 CTRL ROOM] Security Alert: Customer PIN Changed (${customer.customerIdentifier})`,
            htmlContent: alertHtml,
          });
        }
      } catch (alertErr) {
        console.warn("[changeCustomerPinAction] Non-blocking admin alert notice:", alertErr);
      }
    });

    revalidatePath("/portal/profile");
    revalidatePath("/portal");

    return {
      success: true,
      message: "Your security PIN has been updated successfully. Please use it for your future logins.",
    };
  } catch (err: any) {
    console.error("[changeCustomerPinAction] Exception:", err);
    return { error: err?.message || "An unexpected error occurred while updating your PIN." };
  }
}
