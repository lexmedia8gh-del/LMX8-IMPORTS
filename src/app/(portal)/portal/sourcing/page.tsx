"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { createSourcingRequestAction, getCustomerCreditAccountAction } from "@/app/actions/sourcing-credits";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
import { useBrandSettings } from "@/components/brand-provider";

// Generate a new UUID using the Web Crypto API (available in all modern browsers)
function newUUID(): string {
  return crypto.randomUUID();
}

export default function SourcingPage() {
  const [drag, setDrag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "var(--accent)";
  const primaryColor = branding?.primaryColor || "var(--primary)";

  // The idempotency key is stable for the lifetime of this form session.
  // It only resets after a successful submission, ensuring retries reuse the same key.
  const idempotencyKeyRef = useRef<string>(newUUID());

  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const fd = new FormData(e.currentTarget);
    const productDetails = (fd.get("productDetails") as string) ?? "";
    const quantity = parseInt(fd.get("quantity") as string) || 1;
    const preferredSizeColor = (fd.get("preferredSizeColor") as string) ?? "";
    const additionalInstructions = (fd.get("additionalInstructions") as string) ?? "";

    setSubmitting(true);
    setResult(null);

    const res = await createSourcingRequestAction({
      productDetails,
      quantity,
      preferredSizeColor,
      additionalInstructions,
      idempotencyKey: idempotencyKeyRef.current,
    });

    setSubmitting(false);

    if ("error" in res && res.error) {
      setResult({ type: "error", message: res.error });
    } else if ("success" in res && res.success) {
      setResult({ type: "success", message: `Request ${res.requestNumber} submitted successfully!` });
      // Reset form and generate a fresh idempotency key for the next logical submission
      formRef.current?.reset();
      idempotencyKeyRef.current = newUUID();
    }
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>Product Sourcing</h1>
          <p className="text-sm mt-1" style={{ color: "#667085" }}>Upload an image of the item you want us to source from China.</p>
        </div>
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl" style={{ border: "1px solid #E5E7EB" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#667085" }}>Cost per Request</p>
            <p className="font-bold text-base" style={{ color: "#10B981" }}>1 Credit</p>
          </div>
          <Link href="/portal/credits">
            <button className="px-4 py-1.5 text-xs font-bold rounded-lg transition-colors hover:opacity-90 cursor-pointer" style={{ background: accentColor, color: "#FFFFFF" }}>
              Buy Credits
            </button>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* FORM COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 md:p-8" style={{ border: "1px solid #E5E7EB" }}>
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              {/* Upload area */}
              <div 
                className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 transition-colors ${drag ? "bg-amber-50/50 border-amber-400" : "bg-gray-50/50 border-gray-300 hover:border-gray-400 hover:bg-gray-50"}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); }}
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: `${primaryColor}10`, color: primaryColor }}>
                  <UploadCloud size={24} />
                </div>
                <p className="font-semibold text-sm mb-1" style={{ color: "#172236" }}>Upload product image</p>
                <p className="text-xs" style={{ color: "#667085" }}>PNG, JPG up to 10MB</p>
              </div>

              {/* Product Details */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "#172236" }}>Product Details <span className="text-red-500">*</span></label>
                <textarea
                  name="productDetails"
                  rows={3}
                  required
                  placeholder="Describe the product you want to source..."
                  className="w-full p-4 rounded-xl text-sm border focus:outline-none transition-colors bg-white resize-none"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </div>

              {/* Fields */}
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "#172236" }}>Quantity</label>
                  <input name="quantity" type="number" min={1} placeholder="Enter quantity" className="w-full px-4 h-12 rounded-xl text-sm border focus:outline-none transition-colors bg-white" style={{ borderColor: "#E5E7EB" }} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold" style={{ color: "#172236" }}>Preferred size / colour</label>
                  <input name="preferredSizeColor" type="text" placeholder="e.g. Large / Black" className="w-full px-4 h-12 rounded-xl text-sm border focus:outline-none transition-colors bg-white" style={{ borderColor: "#E5E7EB" }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: "#172236" }}>Additional instructions</label>
                <textarea name="additionalInstructions" rows={3} placeholder="Any special requirements..." className="w-full p-4 rounded-xl text-sm border focus:outline-none transition-colors bg-white resize-none" style={{ borderColor: "#E5E7EB" }} />
              </div>

              {/* Status messages */}
              {result && (
                <div className={`px-4 py-3 rounded-xl text-sm font-medium ${result.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {result.message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white"
                style={{ background: accentColor }}
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : <>Submit Request (1 Credit) <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        </div>

        {/* SIDEBAR COLUMN */}
        <div className="space-y-6">
          
          {/* Packages */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base" style={{ color: "#172236" }}>Sourcing Credit Packages</h3>
              <Link href="/portal/credits" className="text-xs font-bold hover:underline" style={{ color: accentColor }}>
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {[
                { ...CREDIT_PACKAGES.starter, id: "starter", highlight: false },
                { ...CREDIT_PACKAGES.standard, id: "standard", highlight: true },
                { ...CREDIT_PACKAGES.premium, id: "premium", highlight: false },
              ].map(pkg => (
                <Link
                  key={pkg.name}
                  href="/portal/credits"
                  className={`flex items-center justify-between p-4 rounded-xl transition-all block ${pkg.highlight ? "shadow-md scale-[1.02]" : "hover:bg-gray-50"}`}
                  style={{
                    border: pkg.highlight ? `2px solid ${accentColor}` : "1px solid #E5E7EB",
                    background: pkg.highlight ? `${accentColor}0D` : "#FFFFFF"
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm" style={{ color: "#172236" }}>{pkg.name}</p>
                      {pkg.highlight && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: primaryColor }}>Most Popular</span>}
                    </div>
                    <p className="text-xs font-medium mt-0.5" style={{ color: "#10B981" }}>{pkg.credits} Credit{pkg.credits > 1 ? 's' : ''}</p>
                  </div>
                  <p className="font-bold text-base" style={{ color: "#172236" }}>{formatCurrency(pkg.price)}</p>
                </Link>
              ))}
            </div>
            <Link
              href="/portal/credits"
              className="mt-4 block w-full py-2.5 rounded-xl text-center text-xs font-bold transition-all hover:opacity-90 text-white"
              style={{ background: accentColor }}
            >
              Buy Sourcing Credits
            </Link>
          </div>

          {/* How it works */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E5E7EB" }}>
            <h3 className="font-bold text-base mb-4" style={{ color: "#172236" }}>How It Works</h3>
            <div className="space-y-4">
              {[
                "Buy credits or get them from admin.",
                "Upload product image and details.",
                "We search and give you a quotation.",
                "Approve and complete payment.",
                "Your item is purchased and shipped."
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 text-white" style={{ background: primaryColor }}>
                    {i + 1}
                  </div>
                  <p className="text-xs font-medium leading-relaxed" style={{ color: "#667085" }}>{step}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
