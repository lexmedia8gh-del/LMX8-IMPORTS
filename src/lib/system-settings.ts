import { prisma } from "@/lib/prisma";

export interface SystemSettingsType {
  defaultTimezone: string;
  dateTimeFormat: string;
  defaultCurrency: string;
  shipmentEmailEnabled: boolean;
  feeReminderEnabled: boolean;
  feeReminderIntervalDays: number;
  failedEmailRetryMax: number;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  updatedAt?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsType = {
  defaultTimezone: "Africa/Accra",
  dateTimeFormat: "DD/MM/YYYY",
  defaultCurrency: "GHS",
  shipmentEmailEnabled: true,
  feeReminderEnabled: true,
  feeReminderIntervalDays: 3,
  failedEmailRetryMax: 3,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
};

let cachedSettings: SystemSettingsType | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

export function clearSystemSettingsCache() {
  cachedSettings = null;
  lastCacheTime = 0;
}

let systemSettingsSchemaEnsured = false;

export async function ensureSystemSettingsSchema(): Promise<boolean> {
  if (systemSettingsSchemaEnsured) return true;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."SystemSettings" (
        "id" TEXT NOT NULL DEFAULT 'singleton',
        "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
        "dateTimeFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
        "defaultCurrency" TEXT NOT NULL DEFAULT 'GHS',
        "shipmentEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
        "feeReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
        "feeReminderIntervalDays" INTEGER NOT NULL DEFAULT 3,
        "failedEmailRetryMax" INTEGER NOT NULL DEFAULT 3,
        "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
        "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
        "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 15,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedBy" TEXT,
        CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
      );
    `);
    systemSettingsSchemaEnsured = true;
    return true;
  } catch (err: any) {
    console.warn("[SystemSettings Service] Unable to ensure SystemSettings table:", err?.message || err);
    return false;
  }
}

export async function getSystemSettings(): Promise<SystemSettingsType> {
  const now = Date.now();
  if (cachedSettings && now - lastCacheTime < CACHE_TTL) {
    return cachedSettings;
  }

  await ensureSystemSettingsSchema();

  try {
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "singleton" },
    });

    if (settings) {
      cachedSettings = {
        defaultTimezone: settings.defaultTimezone || DEFAULT_SYSTEM_SETTINGS.defaultTimezone,
        dateTimeFormat: settings.dateTimeFormat || DEFAULT_SYSTEM_SETTINGS.dateTimeFormat,
        defaultCurrency: settings.defaultCurrency || DEFAULT_SYSTEM_SETTINGS.defaultCurrency,
        shipmentEmailEnabled: settings.shipmentEmailEnabled ?? DEFAULT_SYSTEM_SETTINGS.shipmentEmailEnabled,
        feeReminderEnabled: settings.feeReminderEnabled ?? DEFAULT_SYSTEM_SETTINGS.feeReminderEnabled,
        feeReminderIntervalDays: settings.feeReminderIntervalDays || DEFAULT_SYSTEM_SETTINGS.feeReminderIntervalDays,
        failedEmailRetryMax: settings.failedEmailRetryMax || DEFAULT_SYSTEM_SETTINGS.failedEmailRetryMax,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes || DEFAULT_SYSTEM_SETTINGS.sessionTimeoutMinutes,
        maxLoginAttempts: settings.maxLoginAttempts || DEFAULT_SYSTEM_SETTINGS.maxLoginAttempts,
        lockoutDurationMinutes: settings.lockoutDurationMinutes || DEFAULT_SYSTEM_SETTINGS.lockoutDurationMinutes,
        updatedAt: settings.updatedAt.toISOString(),
      };
    } else {
      cachedSettings = DEFAULT_SYSTEM_SETTINGS;
    }
  } catch (err) {
    console.warn("[SystemSettings Service] Failed to load settings from DB, using defaults:", err);
    cachedSettings = DEFAULT_SYSTEM_SETTINGS;
  }

  lastCacheTime = now;
  return cachedSettings;
}
