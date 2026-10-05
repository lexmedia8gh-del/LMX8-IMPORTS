"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { initializeCreditPurchaseAction } from "@/app/actions/payments";
import type { CreditPackageId } from "@/lib/credit-packages";

export function CreditPurchaseButton({
  packageId,
  packageName,
  popular,
}: {
  packageId: CreditPackageId;
  packageName: string;
  popular: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePurchase() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const callbackUrl = `${window.location.origin}/portal/payments/verify`;
      const res = await initializeCreditPurchaseAction(packageId, callbackUrl);

      if (res.success && res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        setErrorMessage(res.error || "Failed to initialize payment. Please try again.");
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to initialize payment. Please check your network.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white"
        style={{ background: popular ? "#F2901F" : "#141B47" }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Processing...
          </>
        ) : (
          `Purchase ${packageName}`
        )}
      </button>
    </div>
  );
}
