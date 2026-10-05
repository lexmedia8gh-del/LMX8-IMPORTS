"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdminSession, clearSession } from "@/lib/auth";

export async function changeAdminPinAction(currentPin: string, newPin: string, confirmPin: string) {
  if (!currentPin || !newPin || !confirmPin) {
    return { error: "All fields are required." };
  }

  if (newPin !== confirmPin) {
    return { error: "New PIN and confirmation do not match." };
  }

  if (newPin.length < 6 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
    return { error: "New PIN must be between 6 and 8 digits." };
  }

  try {
    const admin = await requireAdminSession();

    // Reload full admin record to get the hashes
    const fullAdmin = await prisma.adminUser.findUnique({
      where: { id: admin.id },
    });

    if (!fullAdmin) {
      return { error: "Administrator account not found." };
    }

    // Verify current PIN (try pinHash first, then passwordHash as fallback)
    let currentPinVerified = false;
    if (fullAdmin.pinHash) {
      currentPinVerified = await bcrypt.compare(currentPin, fullAdmin.pinHash);
    }
    if (!currentPinVerified && fullAdmin.passwordHash) {
      currentPinVerified = await bcrypt.compare(currentPin, fullAdmin.passwordHash);
    }

    if (!currentPinVerified) {
      await prisma.auditLog.create({
        data: {
          action: "ADMIN_PIN_CHANGE_FAILED",
          entityType: "AdminUser",
          entityId: admin.id,
          description: "Failed admin PIN change — incorrect current PIN",
          adminId: admin.id,
        },
      });
      return { error: "Current PIN is incorrect." };
    }

    // Hash and store the new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { pinHash: newPinHash },
    });

    await prisma.auditLog.create({
      data: {
        action: "ADMIN_PIN_CHANGED",
        entityType: "AdminUser",
        entityId: admin.id,
        description: `Admin PIN changed successfully for ${fullAdmin.email}`,
        adminId: admin.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Change PIN error:", error);
    return { error: "An unexpected error occurred." };
  }
}
