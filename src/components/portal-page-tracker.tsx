"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordCustomerPageViewAction } from "@/app/actions/analytics";

/**
 * Tracks authenticated customer page visits across the portal.
 * Deduplicates React 19 component remounts and route oscillations.
 */
export function PortalPageTracker() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);
  const lastTrackedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!pathname) return;

    const now = Date.now();
    // Prevent duplicate firing within 3 seconds for the same pathname
    if (lastTrackedPathRef.current === pathname && now - lastTrackedTimeRef.current < 3000) {
      return;
    }

    lastTrackedPathRef.current = pathname;
    lastTrackedTimeRef.current = now;

    // Record non-blocking page view in the background
    recordCustomerPageViewAction(pathname).catch(() => {});
  }, [pathname]);

  return null;
}
