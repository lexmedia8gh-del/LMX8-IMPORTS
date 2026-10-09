"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordCustomerPageViewAction } from "@/app/actions/customer-analytics";

export function CustomerPageTracker() {
  const pathname = usePathname();
  const lastRecordedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/portal")) return;

    // Deduplicate rapid renders, strict mode double-invocations, and remounts
    const key = `${pathname}:${Math.floor(Date.now() / 3000)}`; // 3-second debounce window
    if (lastRecordedRef.current === key) return;
    lastRecordedRef.current = key;

    const timer = setTimeout(() => {
      recordCustomerPageViewAction(pathname, document.title).catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
