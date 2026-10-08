"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/auth";
import {
  getSystemSettings,
  DEFAULT_SYSTEM_SETTINGS,
  clearSystemSettingsCache,
  ensureSystemSettingsSchema,
  SystemSettingsType,
} from "@/lib/system-settings";
import { revalidatePath } from "next/cache";

export async function getSystemSettingsAction(): Promise<SystemSettingsType> {
  await requireAdminSession();
  return getSystemSettings();
}

export async function updateSystemSettingsAction(data: Partial<SystemSettingsType>) {
  const admin = await requireAdminSession();
  await ensureSystemSettingsSchema();

  // Server-side validation
  const feeReminderIntervalDays =
    typeof data.feeReminderIntervalDays === "number" && data.feeReminderIntervalDays >= 1 && data.feeReminderIntervalDays <= 30
      ? data.feeReminderIntervalDays
      : DEFAULT_SYSTEM_SETTINGS.feeReminderIntervalDays;

  const failedEmailRetryMax =
    typeof data.failedEmailRetryMax === "number" && data.failedEmailRetryMax >= 0 && data.failedEmailRetryMax <= 10
      ? data.failedEmailRetryMax
      : DEFAULT_SYSTEM_SETTINGS.failedEmailRetryMax;

  const sessionTimeoutMinutes =
    typeof data.sessionTimeoutMinutes === "number" && data.sessionTimeoutMinutes >= 15 && data.sessionTimeoutMinutes <= 1440
      ? data.sessionTimeoutMinutes
      : DEFAULT_SYSTEM_SETTINGS.sessionTimeoutMinutes;

  const maxLoginAttempts =
    typeof data.maxLoginAttempts === "number" && data.maxLoginAttempts >= 3 && data.maxLoginAttempts <= 20
      ? data.maxLoginAttempts
      : DEFAULT_SYSTEM_SETTINGS.maxLoginAttempts;

  const lockoutDurationMinutes =
    typeof data.lockoutDurationMinutes === "number" && data.lockoutDurationMinutes >= 5 && data.lockoutDurationMinutes <= 120
      ? data.lockoutDurationMinutes
      : DEFAULT_SYSTEM_SETTINGS.lockoutDurationMinutes;

  const defaultTimezone = (data.defaultTimezone || "Africa/Accra").trim();
  const dateTimeFormat = (data.dateTimeFormat || "DD/MM/YYYY").trim();
  const defaultCurrency = (data.defaultCurrency || "GHS").trim();
  const shipmentEmailEnabled = Boolean(data.shipmentEmailEnabled ?? true);
  const feeReminderEnabled = Boolean(data.feeReminderEnabled ?? true);

  try {
    const updated = await prisma.systemSettings.upsert({
      where: { id: "singleton" },
      update: {
        defaultTimezone,
        dateTimeFormat,
        defaultCurrency,
        shipmentEmailEnabled,
        feeReminderEnabled,
        feeReminderIntervalDays,
        failedEmailRetryMax,
        sessionTimeoutMinutes,
        maxLoginAttempts,
        lockoutDurationMinutes,
        updatedBy: admin.id,
      },
      create: {
        id: "singleton",
        defaultTimezone,
        dateTimeFormat,
        defaultCurrency,
        shipmentEmailEnabled,
        feeReminderEnabled,
        feeReminderIntervalDays,
        failedEmailRetryMax,
        sessionTimeoutMinutes,
        maxLoginAttempts,
        lockoutDurationMinutes,
        updatedBy: admin.id,
      },
    });

    clearSystemSettingsCache();

    await prisma.auditLog.create({
      data: {
        action: "SYSTEM_SETTINGS_UPDATE",
        entityType: "SystemSettings",
        entityId: "singleton",
        description: `System settings updated by ${admin.name} (${admin.email})`,
        adminId: admin.id,
        metadata: {
          shipmentEmailEnabled,
          feeReminderEnabled,
          feeReminderIntervalDays,
          defaultTimezone,
          defaultCurrency,
        },
      },
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      settings: {
        defaultTimezone: updated.defaultTimezone,
        dateTimeFormat: updated.dateTimeFormat,
        defaultCurrency: updated.defaultCurrency,
        shipmentEmailEnabled: updated.shipmentEmailEnabled,
        feeReminderEnabled: updated.feeReminderEnabled,
        feeReminderIntervalDays: updated.feeReminderIntervalDays,
        failedEmailRetryMax: updated.failedEmailRetryMax,
        sessionTimeoutMinutes: updated.sessionTimeoutMinutes,
        maxLoginAttempts: updated.maxLoginAttempts,
        lockoutDurationMinutes: updated.lockoutDurationMinutes,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("[updateSystemSettingsAction] Error:", err);
    return { error: err?.message || "Failed to update system settings." };
  }
}
