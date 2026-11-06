"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  ArrowLeft, ShoppingBag, Clock, CheckCircle2, AlertCircle, 
  ExternalLink, CreditCard, Loader2, Sparkles, Truck, Package, ShieldCheck, Check
} from "lucide-react";
import { 
  getCustomerBuyForMeRequestByIdAction, 
  initializeBuyForMePaymentAction,
  verifyBuyForMePaymentAction 
} from "@/app/actions/buy-for-me";
import { useBrandSettings } from "@/components/brand-provider";

const STAGES = [
  { key: "SUBMITTED", label: "Request Submitted" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "QUOTATION_READY", label: "Quotation Ready" },
  { key: "PAYMENT_PENDING", label: "Payment Pending" },
  { key: "PAYMENT_CONFIRMED", label: "Payment Confirmed" },
  { key: "PURCHASING", label: "Purchasing in Progress" },
  { key: "RECEIVED_AT_WAREHOUSE", label: "At China Warehouse" },
  { key: "IN_TRANSIT", label: "In Transit to Ghana" },
  { key: "DELIVERED", label: "Delivered / Ready" },
];

export default function BuyForMeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const requestId = resolvedParams.id;
  const searchParams = useSearchParams();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment states
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "#F2901F";
  const primaryColor = branding?.primaryColor || "#141B47";

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomerBuyForMeRequestByIdAction(requestId);
      if (!data) {
        setError("Request not found or access denied.");
      } else {
        setRequest(data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load request details.");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Handle Paystack callback verification if redirected back with reference
  useEffect(() => {
    const ref = searchParams?.get("reference") || searchParams?.get("trxref");
    if (ref && requestId) {
      setPaying(true);
      verifyBuyForMePaymentAction(ref).then((res) => {
        setPaying(false);
        if (res.success) {
          setPaymentSuccess("Payment verified successfully! Your items are now being scheduled for purchase.");
          loadDetails();
        } else {
          setPaymentError(res.error || "Payment verification failed.");
        }
      });
    }
  }, [searchParams, requestId, loadDetails]);

  const handlePayNow = async () => {
    if (!request) return;
    setPaying(true);
    setPaymentError(null);
    try {
      const currentUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const res = await initializeBuyForMePaymentAction(request.id, currentUrl);
      if (res.error) {
        setPaymentError(res.error);
        setPaying(false);
      } else if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      }
    } catch (err: any) {
      setPaymentError(err?.message || "Failed to initialize payment.");
      setPaying(false);
    }
  };

  const getStageIndex = (status: string) => {
    return STAGES.findIndex((s) => s.key === status);
  };

  if (loading) {
    return (
      <div className="py-24 text-center max-w-4xl mx-auto flex flex-col items-center gap-2">
        <Loader2 size={32} className="animate-spin text-[#141B47]" />
        <p className="text-xs text-gray-500 font-medium">Loading request details...</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <AlertCircle size={40} className="mx-auto text-red-500" />
        <h2 className="text-lg font-bold text-gray-900">Unable to load request</h2>
        <p className="text-xs text-gray-600">{error || "The requested Buy for Me order does not exist."}</p>
        <Link
          href="/portal/buy-for-me"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#141B47]"
        >
          <ArrowLeft size={14} /> Back to Buy for Me
        </Link>
      </div>
    );
  }

  const currentStageIndex = getStageIndex(request.status);
  const latestQuotation = request.quotations[0] || null;

  return (
    <div className="space-y-7 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/portal/buy-for-me"
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#172236] font-mono">
                {request.requestNumber}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {request.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              Submitted on {new Date(request.createdAt).toLocaleDateString()} · {request.items.length} product(s)
            </p>
          </div>
        </div>
      </div>

      {paymentSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{paymentSuccess}</span>
        </div>
      )}

      {paymentError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{paymentError}</span>
        </div>
      )}

      {/* 9-STAGE STATUS PROGRESS TRACKER */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-5">
          Order Lifecycle Progress
        </h3>
        <div className="overflow-x-auto pb-2">
          <div className="flex items-center min-w-[700px] justify-between relative">
            {STAGES.map((st, i) => {
              const isPast = currentStageIndex > i;
              const isCurrent = currentStageIndex === i;
              const isUpcoming = currentStageIndex < i;

              return (
                <div key={st.key} className="flex-1 flex flex-col items-center relative text-center">
                  {/* Connecting Line */}
                  {i < STAGES.length - 1 && (
                    <div
                      className={`absolute top-3.5 left-1/2 w-full h-0.5 -z-0 ${
                        isPast ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    />
                  )}

                  {/* Icon Circle */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 transition-colors ${
                      isPast
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-[#141B47] text-white ring-4 ring-[#141B47]/20"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {isPast ? <Check size={14} /> : i + 1}
                  </div>

                  {/* Label */}
                  <p
                    className={`text-[11px] mt-2 font-semibold max-w-[90px] leading-tight ${
                      isCurrent
                        ? "text-[#141B47] font-bold"
                        : isPast
                        ? "text-gray-700"
                        : "text-gray-400"
                    }`}
                  >
                    {st.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* QUOTATION BREAKDOWN (IF AVAILABLE) */}
      {latestQuotation && (
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-amber-300 shadow-sm space-y-6 ring-2 ring-amber-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  Official Quotation (v{latestQuotation.version})
                </span>
                {latestQuotation.isPaid && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    Paid & Confirmed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                Published {latestQuotation.publishedAt ? new Date(latestQuotation.publishedAt).toLocaleString() : ""}
                {latestQuotation.publishedByName ? ` by ${latestQuotation.publishedByName}` : ""}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-gray-500">Grand Total Payable</span>
              <p className="text-2xl font-black text-[#141B47]">
                GH₵ {latestQuotation.grandTotal.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Itemized Line Items */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-gray-600">
              Itemized Products Cost
            </h4>
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {latestQuotation.lineItems.map((li: any, idx: number) => (
                <div key={li.id} className="p-3.5 flex items-center justify-between text-xs bg-white">
                  <div>
                    <span className="font-bold text-gray-900">{li.productName}</span>
                    <p className="text-gray-500 text-[11px]">
                      GH₵ {li.unitPrice.toFixed(2)} × {li.quantity}
                      {li.notes && <span className="italic"> ({li.notes})</span>}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900">
                    GH₵ {li.subtotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fees Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Total Product Cost:</span>
              <span className="font-semibold text-gray-900">GH₵ {latestQuotation.totalProductCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping Fee:</span>
              <span className="font-semibold text-gray-900">GH₵ {latestQuotation.shippingFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Sourcing / Procurement Fee:</span>
              <span className="font-semibold text-gray-900">GH₵ {latestQuotation.sourcingFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Service Fee / Commission:</span>
              <span className="font-semibold text-gray-900">GH₵ {latestQuotation.serviceFee.toFixed(2)}</span>
            </div>
            {latestQuotation.otherCharges > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>
                  Other Charges {latestQuotation.otherChargesNotes ? `(${latestQuotation.otherChargesNotes})` : ""}:
                </span>
                <span className="font-semibold text-gray-900">GH₵ {latestQuotation.otherCharges.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
              <span className="font-bold text-sm text-gray-800">Grand Total:</span>
              <span className="text-xl font-black text-[#141B47]">
                GH₵ {latestQuotation.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {latestQuotation.adminNotes && (
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900">
              <span className="font-bold">Admin Sourcing Note:</span> {latestQuotation.adminNotes}
            </div>
          )}

          {/* PAY NOW CTA */}
          {!latestQuotation.isPaid && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-200">
              <div>
                <p className="font-bold text-sm text-[#141B47]">Ready to place this order?</p>
                <p className="text-xs text-gray-600">
                  Securely complete payment via Paystack to dispatch our China purchasing agents.
                </p>
              </div>
              <button
                type="button"
                disabled={paying}
                onClick={handlePayNow}
                className="px-6 py-3 rounded-xl text-xs font-bold text-white transition-all hover:opacity-95 shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shrink-0"
                style={{ background: accentColor }}
              >
                {paying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Initializing Paystack...
                  </>
                ) : (
                  <>
                    <CreditCard size={16} /> Pay GH₵ {latestQuotation.grandTotal.toFixed(2)} with Paystack
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* REQUESTED PRODUCTS LIST */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-[#172236]">Requested Products ({request.items.length})</h3>
        <div className="divide-y divide-gray-100">
          {request.items.map((it: any) => (
            <div key={it.id} className="py-4 flex flex-col sm:flex-row sm:items-start gap-4">
              {it.imageUrl ? (
                <img
                  src={it.imageUrl}
                  alt={it.productName}
                  className="w-20 h-20 object-cover rounded-xl border border-gray-200 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                  <ShoppingBag size={24} />
                </div>
              )}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-[#172236]">{it.productName}</p>
                  <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
                    Qty: {it.quantity}
                  </span>
                </div>
                {it.productUrl && (
                  <a
                    href={it.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono"
                  >
                    <span>View Product Link</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                {it.preferredSpecs && (
                  <p className="text-xs text-gray-600">
                    Specs/Colour: <strong>{it.preferredSpecs}</strong>
                  </p>
                )}
                {it.budget && (
                  <p className="text-xs text-emerald-700">
                    Target Budget: <strong>GH₵ {it.budget}</strong>
                  </p>
                )}
                {it.description && (
                  <p className="text-xs text-gray-500 italic">&ldquo;{it.description}&rdquo;</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STATUS & REVISION HISTORY */}
      {request.statusHistory && request.statusHistory.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500">
            Status Tracking Log
          </h3>
          <div className="space-y-2">
            {request.statusHistory.map((sh: any) => (
              <div
                key={sh.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-0"
              >
                <div>
                  <span className="font-bold text-[#141B47]">
                    {sh.status.replace(/_/g, " ")}
                  </span>
                  {sh.note && <span className="text-gray-500 ml-2">— {sh.note}</span>}
                </div>
                <span className="text-[11px] text-gray-400 font-mono">
                  {new Date(sh.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
