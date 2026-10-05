"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ResolvedBrandSettings, DEFAULT_BRANDING, LogoVariant, selectBrandLogoUrl } from "@/lib/branding";
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
  const [branding, setBranding] = useState<ResolvedBrandSettings | null>(initialBranding || null);

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

  // Dynamically update document title and favicon when branding changes
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
  const context = useContext(BrandContext);
  return context;
}
