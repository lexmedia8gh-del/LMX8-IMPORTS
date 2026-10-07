import { prisma } from "@/lib/prisma";
import {
  BrandSettingsType,
  DEFAULT_BRANDING,
} from "./branding-utils";

export * from "./branding-utils";

export async function ensureBrandSettingsTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BrandSettings" (
        "id" TEXT NOT NULL DEFAULT 'singleton',
        "businessName" TEXT NOT NULL DEFAULT 'LMX8 IMPORTS',
        "shortName" TEXT NOT NULL DEFAULT 'LMX8',
        "tagline" TEXT NOT NULL DEFAULT 'Your Goods. Our Priority.',
        "primaryColor" TEXT NOT NULL DEFAULT '#141B47',
        "secondaryColor" TEXT NOT NULL DEFAULT '#355DAF',
        "accentColor" TEXT NOT NULL DEFAULT '#F2901F',
        "mainLogo" TEXT,
        "lightLogo" TEXT,
        "darkLogo" TEXT,
        "brandMark" TEXT,
        "favicon" TEXT,
        "invoiceLogo" TEXT,
        "invoiceFooterLogo" TEXT,
        "invoiceStamp" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedBy" TEXT,
        CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("id")
      );
    `);
    return true;
  } catch (err) {
    console.warn("[Branding Service] Unable to ensure BrandSettings table via raw SQL:", err);
    return false;
  }
}

// Global cache to prevent constant database hits during renders
let cachedBranding: BrandSettingsType | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 10000; // 10 seconds

export async function getBrandSettings(): Promise<BrandSettingsType> {
  const now = Date.now();
  if (cachedBranding && now - lastCacheTime < CACHE_TTL) {
    return cachedBranding;
  }

  try {
    // Try to retrieve the single brand settings record from DB
    const settings = await prisma.brandSettings.findUnique({
      where: { id: "singleton" },
    });

    if (settings) {
      cachedBranding = {
        businessName: settings.businessName,
        shortName: settings.shortName,
        tagline: settings.tagline,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        accentColor: settings.accentColor,
        mainLogo: settings.mainLogo,
        lightLogo: settings.lightLogo,
        darkLogo: settings.darkLogo,
        brandMark: settings.brandMark,
        favicon: settings.favicon,
        invoiceLogo: settings.invoiceLogo,
        invoiceFooterLogo: settings.invoiceFooterLogo,
        invoiceStamp: settings.invoiceStamp,
      };
    } else {
      cachedBranding = DEFAULT_BRANDING;
    }
  } catch (error: any) {
    // Fail-safe: if the table doesn't exist (P2021), attempt auto-creation safely
    if (error?.code === "P2021") {
      try {
        await ensureBrandSettingsTable();
      } catch {
        // Ignore table creation error if DB is unreachable
      }
    }
    console.warn("[Branding Service] Database settings unavailable, using official default LMX8 brand values.");
    cachedBranding = DEFAULT_BRANDING;
  }

  lastCacheTime = now;
  return cachedBranding;
}

export function clearBrandingCache() {
  cachedBranding = null;
  lastCacheTime = 0;
}
