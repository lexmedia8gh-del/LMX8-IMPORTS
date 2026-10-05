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
        className={`object-contain max-w-full ${className}`}
      />
    );
  }

  // Otherwise, render the exact, high-fidelity LMX8 vector SVG representation
  const textColor = variant === "full-light" ? "#FFFFFF" : "#141B47";
  const strokeColor = variant === "symbol-white" ? "#FFFFFF" : secondaryColor;
  const arrowColor = variant === "symbol-white" ? "#FFFFFF" : accentColor;
  const navyBoxColor = variant === "symbol-white" ? "#FFFFFF" : primaryColor;

  if (variant === "symbol" || variant === "symbol-white") {
    return (
      <svg
        viewBox="0 0 100 100"
        height={height}
        className={className}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: `${height}px`, width: "auto" }}
      >
        {variant === "symbol" && (
          <rect width="100" height="100" rx="20" fill={primaryColor} />
        )}
        <g transform={variant === "symbol" ? "translate(10, 10) scale(0.8)" : "scale(1)"}>
          {/* Orbit loop */}
          <path
            d="M 50 12 C 29 12 12 29 12 50 C 12 71 29 88 50 88 C 71 88 88 71 88 50 C 88 38 82 27 72 20"
            stroke={strokeColor}
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Arrow line */}
          <path
            d="M 23 77 L 72 28"
            stroke={arrowColor}
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <path
            d="M 48 24 L 76 24 L 76 52"
            stroke={arrowColor}
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    );
  }

  // Full Logo variants ('full-dark' or 'full-light')
  return (
    <svg
      viewBox="0 0 320 80"
      height={height}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ height: `${height}px`, width: "auto" }}
    >
      {/* Circular emblem with crossing arrow */}
      <g transform="translate(5, 0) scale(0.8)">
        <path
          d="M 50 12 C 29 12 12 29 12 50 C 12 71 29 88 50 88 C 71 88 88 71 88 50 C 88 38 82 27 72 20"
          stroke={secondaryColor}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 23 77 L 72 28"
          stroke={accentColor}
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M 48 24 L 76 24 L 76 52"
          stroke={accentColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Vertical navy container with LMX8 stacked */}
      <rect x="90" y="10" width="22" height="60" rx="3" fill={navyBoxColor} />
      <g fill="#FFFFFF" fontFamily="Impact, sans-serif" fontSize="11" fontWeight="900" textAnchor="middle">
        <text x="101" y="22">L</text>
        <text x="101" y="35">M</text>
        <text x="101" y="48">X</text>
        <text x="101" y="61">8</text>
      </g>

      {/* Word IMPORTS in heavy bold condensed font */}
      <text
        x="118"
        y="58"
        fill={textColor}
        fontFamily="Impact, Arial Black, sans-serif"
        fontSize="48"
        fontWeight="900"
        letterSpacing="0"
      >
        IMPORTS
      </text>
    </svg>
  );
}
export default BrandLogo;
