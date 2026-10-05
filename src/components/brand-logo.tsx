"use client";

import React, { useState, useEffect } from "react";
import { LogoVariant, ResolvedBrandSettings, selectBrandLogoUrl, DEFAULT_BRANDING } from "@/lib/branding";
import { useBrandSettings } from "@/components/brand-provider";
import { getBrandSettingsAction } from "@/app/actions/branding";

export interface BrandLogoProps {
  variant?: LogoVariant;
  customImageUrl?: string | null;
  branding?: Partial<ResolvedBrandSettings> | null;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  height?: number | string;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function BrandLogo({
  variant = "main",
  customImageUrl = null,
  branding: propBranding = null,
  primaryColor: propPrimaryColor,
  secondaryColor: propSecondaryColor,
  accentColor: propAccentColor,
  height = 40,
  className = "",
  alt,
}: BrandLogoProps) {
  // Try getting branding from context
  const context = useBrandSettings();
  const [localBranding, setLocalBranding] = useState<ResolvedBrandSettings | null>(null);

  // If used outside of BrandProvider, load branding locally and listen for updates
  useEffect(() => {
    if (!context?.branding && !propBranding) {
      getBrandSettingsAction().then(setLocalBranding).catch(() => {});

      const handleUpdate = () => {
        getBrandSettingsAction().then(setLocalBranding).catch(() => {});
      };
      window.addEventListener("lmx8-branding-updated", handleUpdate);
      return () => window.removeEventListener("lmx8-branding-updated", handleUpdate);
    }
  }, [context?.branding, propBranding]);

  const activeBranding = propBranding || context?.branding || localBranding;
  const businessName = activeBranding?.businessName || DEFAULT_BRANDING.businessName;
  const altText = alt || `${businessName} Logo`;

  // 1. If a manual customImageUrl was passed directly, honor it
  // 2. Otherwise, use the centralized intelligent logo selection system
  const resolvedLogoUrl = customImageUrl || selectBrandLogoUrl(activeBranding, variant);

  const numericHeight = typeof height === "number" ? height : parseInt(String(height), 10) || 40;
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  // If an uploaded logo asset is available, render it proportionally without distortion or CSS recoloring
  if (resolvedLogoUrl) {
    return (
      <img
        src={resolvedLogoUrl}
        alt={altText}
        style={{ height: heightStyle, width: "auto" }}
        className={`object-contain max-w-full h-auto ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Fallback: Render official responsive SVG vector when no uploaded asset is configured
  const isLight = variant === "light" || variant === "full-light" || variant === "symbol-white";
  const isSymbol = variant === "symbol" || variant === "mark" || variant === "symbol-white" || variant === "favicon";

  const primaryNavy = propPrimaryColor || activeBranding?.primaryColor || DEFAULT_BRANDING.primaryColor;
  const secondaryBlue = propSecondaryColor || activeBranding?.secondaryColor || DEFAULT_BRANDING.secondaryColor;
  const brandOrange = propAccentColor || activeBranding?.accentColor || DEFAULT_BRANDING.accentColor;

  if (isSymbol) {
    const symbolWidth = Math.round(numericHeight);
    return (
      <svg
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: heightStyle, width: `${symbolWidth}px` }}
        className={`shrink-0 ${className}`}
        aria-label={altText}
        role="img"
      >
        <circle cx="30" cy="30" r="28" fill={primaryNavy} />
        {/* Orbit ellipse */}
        <ellipse cx="30" cy="30" rx="20" ry="9" stroke={secondaryBlue} strokeWidth="2.5" transform="rotate(-25 30 30)" />
        {/* Dynamic Forward Arrow */}
        <path
          d="M21 37L35 30L21 23L25 30L21 37Z"
          fill={brandOrange}
        />
        {/* Inner Core */}
        <circle cx="30" cy="30" r="3.5" fill="#FFFFFF" />
      </svg>
    );
  }

  // Full Horizontal Vector Logo
  const fullWidth = Math.round(numericHeight * 4.2);
  const textColor = isLight ? "#FFFFFF" : primaryNavy;
  const subtitleColor = isLight ? "#94A3B8" : secondaryBlue;

  return (
    <svg
      viewBox="0 0 240 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: heightStyle, width: `${fullWidth}px` }}
      className={`shrink-0 object-contain ${className}`}
      aria-label={altText}
      role="img"
    >
      {/* Icon portion */}
      <circle cx="30" cy="30" r="26" fill={primaryNavy} />
      <ellipse cx="30" cy="30" rx="18" ry="8" stroke={secondaryBlue} strokeWidth="2.5" transform="rotate(-25 30 30)" />
      <path
        d="M22 36L35 30L22 24L26 30L22 36Z"
        fill={brandOrange}
      />
      <circle cx="30" cy="30" r="3" fill="#FFFFFF" />

      {/* Wordmark portion */}
      <text
        x="66"
        y="35"
        fill={textColor}
        fontFamily="var(--font-poppins), system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="24"
        letterSpacing="0.05em"
      >
        LMX8
      </text>
      <text
        x="68"
        y="49"
        fill={subtitleColor}
        fontFamily="var(--font-poppins), system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="9.5"
        letterSpacing="0.32em"
      >
        IMPORTS
      </text>
    </svg>
  );
}

export default BrandLogo;
