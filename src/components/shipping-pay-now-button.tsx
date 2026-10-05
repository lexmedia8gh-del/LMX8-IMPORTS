"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { initializeShippingPaymentAction } from "@/app/actions/payments";

export function ShippingPayNowButton({ shipmentId }: { shipmentId: string }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    const callbackUrl = `${window.location.origin}/portal/payments/verify`;
    const res = await initializeShippingPaymentAction(shipmentId, callbackUrl);

    if (res.success && res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      alert(res.error || "Failed to initialize payment.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="w-full py-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-md disabled:opacity-60 disabled:cursor-not-allowed bg-accent text-white cursor-pointer"
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" /> Processing…
        </>
      ) : (
        "Pay Now with Paystack"
      )}
    </button>
  );
}
