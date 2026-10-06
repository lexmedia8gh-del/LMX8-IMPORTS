import { prisma } from "@/lib/prisma";

export type LogoVariant =
  | "main"
  | "light"
  | "dark"
  | "invoice"
  | "mark"
  | "symbol"
  | "symbol-white"
  | "favicon"
  | "email"
  | "loading"
  | "full-dark"
  | "full-light";

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

export interface ResolvedBrandSettings extends BrandSettingsType {
  mainLogoUrl?: string | null;
  lightLogoUrl?: string | null;
  darkLogoUrl?: string | null;
  brandMarkUrl?: string | null;
  faviconUrl?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceFooterLogoUrl?: string | null;
  invoiceStampUrl?: string | null;
  paths?: Record<string, string | null>;
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

/**
 * Intelligent Logo Selection System
 * Automatically resolves the optimal uploaded logo asset based on the
 * requested design scenario, applying prioritized fallbacks.
 */
export function selectBrandLogoUrl(
  settings: Partial<ResolvedBrandSettings> | null | undefined,
  variant: LogoVariant = "main"
): string | null {
  if (!settings) return null;

  switch (variant) {
    // ── LIGHT BACKGROUND SCENARIOS (Main Logo) ──
    // Priority: mainLogo -> darkLogo -> lightLogo
    case "main":
    case "full-dark":
      return settings.mainLogoUrl || settings.darkLogoUrl || settings.lightLogoUrl || null;

    // ── DARK BACKGROUND SCENARIOS (Light Logo) ──
    // Priority: lightLogo -> mainLogo -> darkLogo
    case "light":
    case "full-light":
      return settings.lightLogoUrl || settings.mainLogoUrl || settings.darkLogoUrl || null;

    // ── MONOCHROME / CONTRAST SCENARIOS (Dark Logo) ──
    // Priority: darkLogo -> mainLogo -> lightLogo
    case "dark":
      return settings.darkLogoUrl || settings.mainLogoUrl || settings.lightLogoUrl || null;

    // ── INVOICE & DOCUMENT SCENARIOS ──
    // Priority: invoiceLogo -> mainLogo -> darkLogo
    case "invoice":
      return settings.invoiceLogoUrl || settings.mainLogoUrl || settings.darkLogoUrl || null;

    // ── COMPACT MARK / SYMBOL SCENARIOS ──
    // Priority: brandMark -> mainLogo -> lightLogo -> darkLogo
    case "mark":
    case "symbol":
      return settings.brandMarkUrl || settings.mainLogoUrl || settings.lightLogoUrl || settings.darkLogoUrl || null;

    case "symbol-white":
      return settings.brandMarkUrl || settings.lightLogoUrl || settings.mainLogoUrl || null;

    // ── BROWSER FAVICON SCENARIOS ──
    // Priority: favicon -> brandMark -> mainLogo
    case "favicon":
      return settings.faviconUrl || settings.brandMarkUrl || settings.mainLogoUrl || null;

    // ── EMAIL & LOADING SCENARIOS ──
    case "email":
    case "loading":
    default:
      return settings.mainLogoUrl || settings.lightLogoUrl || settings.darkLogoUrl || null;
  }
}

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
