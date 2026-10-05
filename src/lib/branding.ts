import { prisma } from "@/lib/prisma";

export interface BrandSettingsType {
  businessName: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mainLogo: string | null;
  lightLogo: string | null;
  darkLogo: string | null;
  brandMark: string | null;
  favicon: string | null;
  invoiceLogo: string | null;
  invoiceFooterLogo: string | null;
  invoiceStamp: string | null;
}

export const DEFAULT_BRANDING: BrandSettingsType = {
  businessName: "LMX8 IMPORTS",
  shortName: "LMX8",
  tagline: "Your Goods. Our Priority.",
  primaryColor: "#141B47",
  secondaryColor: "#355DAF",
  accentColor: "#F2901F",
  mainLogo: null,
  lightLogo: null,
  darkLogo: null,
  brandMark: null,
  favicon: null,
  invoiceLogo: null,
  invoiceFooterLogo: null,
  invoiceStamp: null,
};

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
    // Fail-safe: if the table isn't migrated yet, attempt auto-creation and return default LMX8 values
    if (error?.code === "P2021" || error?.message?.includes("does not exist") || error?.message?.includes("BrandSettings")) {
      ensureBrandSettingsTable().catch(() => {});
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
