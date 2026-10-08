"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ResolvedBrandSettings, DEFAULT_BRANDING, LogoVariant, selectBrandLogoUrl } from "@/lib/branding-utils";
import { getBrandSettingsAction } from "@/app/actions/branding";

interface BrandContextType {
  branding: ResolvedBrandSettings | null;
  refreshBranding: () => Promise<void>;
  getLogoUrl: (variant?: LogoVariant) => string | null;
}

const BrandContext = createContext<BrandContextType>({
  branding: null,
  refreshBranding: async () => {},
  getLogoUrl: () => null,
});

export function BrandProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  initialBranding?: ResolvedBrandSettings | null;
}) {
  const [branding, setBranding] = useState<ResolvedBrandSettings | null>(initialBranding || (DEFAULT_BRANDING as ResolvedBrandSettings));

  const refreshBranding = useCallback(async () => {
    try {
      const data = await getBrandSettingsAction();
      if (data) {
        setBranding(data);
      }
    } catch (err) {
      console.warn("[BrandProvider] Failed to fetch brand settings:", err);
    }
  }, []);

  useEffect(() => {
    // If not provided initially, load settings
    if (!initialBranding) {
      refreshBranding();
    }

    // Subscribe to dynamic branding changes dispatched by admin settings
    const handleUpdate = () => {
      refreshBranding();
    };

    window.addEventListener("lmx8-branding-updated", handleUpdate);
    return () => window.removeEventListener("lmx8-branding-updated", handleUpdate);
  }, [initialBranding, refreshBranding]);

  // Dynamically update document title, favicon, and CSS custom properties when branding changes
  useEffect(() => {
    if (typeof document === "undefined" || !branding) return;

    if (branding.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "shortcut icon";
        document.head.appendChild(link);
      }
      link.href = branding.faviconUrl;
    }

    // Apply active Admin -> Branding colors as dynamic CSS variables on :root
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty("--primary", branding.primaryColor);
      root.style.setProperty("--color-brand-navy", branding.primaryColor);
      root.style.setProperty("--color-lmx-navy", branding.primaryColor);
    }
    if (branding.secondaryColor) {
      root.style.setProperty("--secondary", branding.secondaryColor);
      root.style.setProperty("--color-brand-secondary", branding.secondaryColor);
      root.style.setProperty("--color-lmx-mid", branding.secondaryColor);
    }
    if (branding.accentColor) {
      root.style.setProperty("--accent", branding.accentColor);
      root.style.setProperty("--ring", branding.accentColor);
      root.style.setProperty("--color-brand-gold", branding.accentColor);
      root.style.setProperty("--color-lmx-gold", branding.accentColor);
    }
  }, [branding]);

  const getLogoUrl = useCallback(
    (variant: LogoVariant = "main") => {
      return selectBrandLogoUrl(branding, variant);
    },
    [branding]
  );

  return (
    <BrandContext.Provider value={{ branding, refreshBranding, getLogoUrl }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrandSettings() {
  try {
    const context = useContext(BrandContext);
    return context || null;
  } catch {
    return null;
  }
}
