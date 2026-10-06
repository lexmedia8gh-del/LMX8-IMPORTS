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
 * Intelligent Logo Selection System (Pure Client Safe Utility)
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
