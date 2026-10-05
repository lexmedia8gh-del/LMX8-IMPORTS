"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

  async function handlePurchase() {
    setLoading(true);
    const callbackUrl = `${window.location.origin}/portal/payments/verify`;
    const res = await initializeCreditPurchaseAction(packageId, callbackUrl);

    if (res.success && res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      alert(res.error || "Failed to initialize payment.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePurchase}
      disabled={loading}
      className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed ${
        popular ? "bg-[#FFB800] text-[#07182F]" : "bg-[#0B1F44] text-white"
      }`}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin" /> Processing...
        </>
      ) : (
        `Purchase ${packageName}`
      )}
    </button>
  );
}
