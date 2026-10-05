"use client";

import React from "react";

export interface BrandLogoProps {
  variant?: "full-dark" | "full-light" | "symbol" | "symbol-white";
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  customImageUrl?: string | null;
  height?: number;
  className?: string;
}

export function BrandLogo({
  variant = "full-dark",
  primaryColor = "#141B47",
  secondaryColor = "#355DAF",
  accentColor = "#F2901F",
  customImageUrl = null,
  height = 40,
  className = "",
}: BrandLogoProps) {
  
  // If the administrator has uploaded a custom logo image, render it
  if (customImageUrl) {
    return (
      <img
        src={customImageUrl}
        alt="LMX8 IMPORTS Logo"
        style={{ height: `${height}px` }}
        className={`object-contain max-w-full h-auto ${className}`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Otherwise, render the original uploaded brand asset file proportionally without recreation or modification in code
  let src = "/Asset 1@4x.png";
  if (variant === "full-light") {
    src = "/Asset 2@4x.png";
  } else if (variant === "symbol") {
    src = "/Asset 3@4x.png";
  } else if (variant === "symbol-white") {
    src = "/Asset 4@4x.png";
  }

  return (
    <img
      src={src}
      alt="LMX8 IMPORTS"
      style={{ height: `${height}px` }}
      className={`object-contain max-w-full h-auto ${className}`}
      referrerPolicy="no-referrer"
    />
  );
}
export default BrandLogo;
