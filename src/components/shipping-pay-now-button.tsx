"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { initializeShippingPaymentAction } from "@/app/actions/payments";
import { useBrandSettings } from "@/components/brand-provider";

export function ShippingPayNowButton({ shipmentId }: { shipmentId: string }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  async function handlePay() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const callbackUrl = `${window.location.origin}/portal/payments/verify`;
      const res = await initializeShippingPaymentAction(shipmentId, callbackUrl);

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
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full py-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md disabled:opacity-60 disabled:cursor-not-allowed text-white cursor-pointer"
        style={{ background: branding?.accentColor || "var(--accent)" }}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Processing…
          </>
        ) : (
          "Pay Now with Paystack"
        )}
      </button>
    </div>
  );
}
