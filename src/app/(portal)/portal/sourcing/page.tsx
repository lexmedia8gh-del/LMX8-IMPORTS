"use client";

import { useState, useRef, useEffect } from "react";
import { 
  UploadCloud, CheckCircle2, ArrowRight, Loader2, RefreshCw, 
  PackageSearch, Clock, AlertCircle, Eye, Check, X, History,
  DollarSign, Sparkles, ChevronDown, ChevronUp
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";
import { 
  createSourcingRequestAction, 
  getCustomerCreditAccountAction,
  getCustomerSourcingRequestsAction,
  customerRespondToSourcingPriceAction 
} from "@/app/actions/sourcing-credits";
import { CREDIT_PACKAGES } from "@/lib/credit-packages";
import { useBrandSettings } from "@/components/brand-provider";

export const dynamic = "force-dynamic";

function newUUID(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

export default function SourcingPage() {
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit");
  const [drag, setDrag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sourcing requests list
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Credit balance
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "#F2901F";
  const primaryColor = branding?.primaryColor || "#141B47";

  const idempotencyKeyRef = useRef<string>(newUUID());
  const formRef = useRef<HTMLFormElement>(null);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const [reqData, creditData] = await Promise.all([
        getCustomerSourcingRequestsAction(),
        getCustomerCreditAccountAction().catch(() => null),
      ]);
      setRequests(reqData || []);
      if (creditData) {
        setCreditBalance(creditData.balance);
      }
    } catch (err) {
      console.error("Failed to load sourcing requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  function handleFileSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

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
      imageUrl: imagePreview || undefined,
      idempotencyKey: idempotencyKeyRef.current,
    });

    setSubmitting(false);

    if ("error" in res && res.error) {
      setResult({ type: "error", message: res.error });
    } else if ("success" in res && res.success) {
      setResult({ 
        type: "success", 
        message: `Request ${res.requestNumber} submitted successfully! Our procurement team has been alerted.` 
      });
      formRef.current?.reset();
      setImagePreview(null);
      idempotencyKeyRef.current = newUUID();
      await loadRequests();
    }
  }

  async function handleCustomerResponse(requestId: string, action: "CONFIRM" | "DECLINE") {
    const isConfirm = action === "CONFIRM";
    const confirmed = window.confirm(
      isConfirm 
        ? "Are you sure you want to approve this sourcing quotation?" 
        : "Are you sure you want to decline this sourcing quotation?"
    );
    if (!confirmed) return;

    setRespondingId(requestId);
    try {
      const res = await customerRespondToSourcingPriceAction({
        requestId,
        action,
      });
      if (res.error) {
        alert(res.error);
      } else {
        await loadRequests();
      }
    } catch (err: any) {
      alert(err?.message || "Failed to submit quotation response.");
    } finally {
      setRespondingId(null);
    }
  }

  const getStatusBadge = (req: any) => {
    if (req.customerConfirmationStatus === "DECLINED" || req.status === "REJECTED") {
      return {
        label: "Declined",
        bg: "bg-red-50 text-red-700 border-red-200",
      };
    }
    if (req.customerConfirmationStatus === "AWAITING_CONFIRMATION" || (req.status === "QUOTED" && req.unitPrice != null)) {
      return {
        label: "Price Updated — Review Quote",
        bg: "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-300/40",
      };
    }
    if (req.customerConfirmationStatus === "CONFIRMED" || req.status === "APPROVED") {
      return {
        label: "Approved & In Progress",
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    if (req.status === "PURCHASED" || req.status === "SHIPPED") {
      return {
        label: req.status === "PURCHASED" ? "Purchased in China" : "Shipped",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (req.status === "COMPLETED") {
      return {
        label: "Completed",
        bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
      };
    }
    return {
      label: "Awaiting Price Review",
      bg: "bg-gray-100 text-gray-700 border-gray-200",
    };
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>Product Sourcing</h1>
          <p className="text-sm mt-1" style={{ color: "#667085" }}>
            Submit products you want sourced from verified manufacturers in China, track updated prices, and confirm quotes.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-gray-200 shadow-2xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Available Credits</p>
            <p className="font-bold text-base text-emerald-600">
              {creditBalance !== null ? `${creditBalance} Credit${creditBalance === 1 ? "" : "s"}` : "1 Credit / req"}
            </p>
          </div>
          <Link href="/portal/credits">
            <button 
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors hover:opacity-90 cursor-pointer text-white" 
              style={{ background: accentColor }}
            >
              Buy Credits
            </button>
          </Link>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab("submit")}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors relative ${
            activeTab === "submit" ? "text-[#141B47]" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>Submit New Request</span>
          {activeTab === "submit" && (
            <span 
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" 
              style={{ background: accentColor }} 
            />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("history");
            loadRequests();
          }}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors relative ${
            activeTab === "history" ? "text-[#141B47]" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>My Sourcing Requests</span>
          <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-700">
            {requests.length}
          </span>
          {activeTab === "history" && (
            <span 
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" 
              style={{ background: accentColor }} 
            />
          )}
        </button>
      </div>

      {activeTab === "submit" ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* FORM COLUMN */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                {/* Upload area with real image selector & preview */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#172236] block">
                    Product Image (Optional)
                  </label>
                  {imagePreview ? (
                    <div className="relative border rounded-xl p-3 bg-gray-50 flex items-center gap-4">
                      <img 
                        src={imagePreview} 
                        alt="Product preview" 
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200" 
                      />
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-800">Image attached</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Will be sent to sourcing team</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImagePreview(null)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div 
                      className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
                        drag ? "bg-amber-50/50 border-amber-400" : "bg-gray-50/60 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                      onDragLeave={() => setDrag(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDrag(false);
                        if (e.dataTransfer.files?.[0]) {
                          handleFileSelected(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleFileSelected(e.target.files[0]);
                          }
                        }}
                      />
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: `${primaryColor}15`, color: primaryColor }}>
                        <UploadCloud size={24} />
                      </div>
                      <p className="font-semibold text-sm mb-1 text-[#172236]">Click or drop product photo here</p>
                      <p className="text-xs text-[#667085]">PNG, JPG, WebP up to 5MB</p>
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172236]">Product Details & Name <span className="text-red-500">*</span></label>
                  <textarea
                    name="productDetails"
                    rows={3}
                    required
                    placeholder="Describe the product name, materials, model, or link..."
                    className="w-full p-4 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 transition-colors bg-white resize-none"
                  />
                </div>

                {/* Quantity and specs */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236]">Requested Quantity</label>
                    <input 
                      name="quantity" 
                      type="number" 
                      min={1} 
                      defaultValue={1}
                      placeholder="Enter quantity" 
                      className="w-full px-4 h-12 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 transition-colors bg-white" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236]">Preferred size / colour / specs</label>
                    <input 
                      name="preferredSizeColor" 
                      type="text" 
                      placeholder="e.g. 500ml / Matte Black" 
                      className="w-full px-4 h-12 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 transition-colors bg-white" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172236]">Additional instructions</label>
                  <textarea 
                    name="additionalInstructions" 
                    rows={3} 
                    placeholder="Any packaging requirements, target price, or inspection notes..." 
                    className="w-full p-4 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 transition-colors bg-white resize-none" 
                  />
                </div>

                {/* Status messages */}
                {result && (
                  <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-between gap-2 ${
                    result.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
                  }`}>
                    <span>{result.message}</span>
                    {result.type === "success" && (
                      <button 
                        type="button" 
                        onClick={() => setActiveTab("history")}
                        className="text-xs font-bold underline cursor-pointer"
                      >
                        View My Requests →
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-95 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white"
                  style={{ background: accentColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Submitting Request...
                    </>
                  ) : (
                    <>
                      Submit Request (1 Credit) <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* SIDEBAR COLUMN */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-[#172236]">Sourcing Credit Packages</h3>
                <Link href="/portal/credits" className="text-xs font-bold hover:underline" style={{ color: accentColor }}>
                  Buy More →
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
                    className={`flex items-center justify-between p-4 rounded-xl transition-all block ${
                      pkg.highlight ? "shadow-xs ring-2 ring-[#F2901F]" : "hover:bg-gray-50 border border-gray-200"
                    }`}
                    style={{
                      background: pkg.highlight ? "#FFFDF7" : "#FFFFFF"
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-[#172236]">{pkg.name}</p>
                        {pkg.highlight && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white bg-[#141B47]">Best Value</span>}
                      </div>
                      <p className="text-xs font-medium mt-0.5 text-emerald-600">{pkg.credits} Credit{pkg.credits > 1 ? 's' : ''}</p>
                    </div>
                    <p className="font-bold text-base text-[#172236]">{formatCurrency(pkg.price)}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <h3 className="font-bold text-base mb-3 text-[#172236]">How Price Quoting Works</h3>
              <div className="space-y-3.5 text-xs text-gray-600">
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#141B47] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">1</span>
                  <p>Our China team liaises with verified factories for your requested product.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#141B47] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">2</span>
                  <p>The admin updates the item&apos;s unit price and total cost with supplier notes.</p>
                </div>
                <div className="flex gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#141B47] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">3</span>
                  <p>You receive an instant notification to confirm or decline the quotation directly here.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MY SOURCING REQUESTS TAB */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200">
            <span className="text-xs text-gray-500">
              Showing <strong>{requests.length}</strong> sourcing request{requests.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={loadRequests}
              disabled={loadingRequests}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
            >
              <RefreshCw size={13} className={loadingRequests ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {loadingRequests ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-200">
              <Loader2 size={32} className="animate-spin text-[#141B47] mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Loading your sourcing requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-gray-200 space-y-3">
              <PackageSearch size={44} className="mx-auto text-gray-300" />
              <h3 className="font-bold text-base text-[#172236]">No sourcing requests yet</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                Submit your first sourcing request to have our procurement specialists find verified factories and quote prices for you.
              </p>
              <button
                onClick={() => setActiveTab("submit")}
                className="px-4 py-2 text-xs font-bold rounded-lg text-white cursor-pointer mt-2"
                style={{ background: accentColor }}
              >
                Submit a Request
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((req) => {
                const badge = getStatusBadge(req);
                const isAwaitingConfirmation = req.customerConfirmationStatus === "AWAITING_CONFIRMATION";
                const isHistoryOpen = expandedHistoryId === req.id;

                return (
                  <div 
                    key={req.id} 
                    className={`bg-white rounded-2xl border transition-all p-5 md:p-6 shadow-sm ${
                      isAwaitingConfirmation ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-100">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-[#141B47]">
                          {req.requestNumber}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {req.originalQuantity && req.originalQuantity !== req.quantity && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            Qty adjusted: {req.originalQuantity} → {req.quantity}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                        <span>Submitted: {req.createdAt}</span>
                        {req.priceUpdatedAt && (
                          <span>· Quoted: {new Date(req.priceUpdatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-5 pt-4">
                      {/* Original Request Banner */}
                      <div className="bg-[#F8FAFC] rounded-xl p-4 border border-gray-200 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Your Original Submission
                        </span>
                        <div className="flex items-start gap-3">
                          {req.imageUrl ? (
                            <img src={req.imageUrl} alt="Request" className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                              <PackageSearch size={20} />
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-xs text-[#172236]">{req.productDetails}</p>
                            <p className="text-[11px] text-gray-600">
                              Requested Qty: <strong>{req.quantity || 1}</strong>
                              {req.preferredSizeColor && ` · Specs: ${req.preferredSizeColor}`}
                            </p>
                            {req.additionalInstructions && (
                              <p className="text-[11px] text-gray-500 italic mt-0.5">&ldquo;{req.additionalInstructions}&rdquo;</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Admin Sourced Product Cards */}
                      {req.sourcingItems && req.sourcingItems.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-1.5">
                            <span>Sourced Product Quotation</span>
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                              {req.sourcingItems.length} Item{req.sourcingItems.length > 1 ? "s" : ""}
                            </span>
                          </p>

                          <div className="grid sm:grid-cols-2 gap-3">
                            {req.sourcingItems.map((item: any) => (
                              <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs space-y-2.5 flex flex-col justify-between">
                                <div className="flex items-start gap-3">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.productName} className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0" />
                                  ) : (
                                    <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                                      <PackageSearch size={20} />
                                    </div>
                                  )}
                                  <div className="space-y-1 min-w-0">
                                    <h5 className="font-bold text-xs text-[#172236] truncate">{item.productName}</h5>
                                    {item.description && (
                                      <p className="text-[11px] text-gray-600 line-clamp-2">{item.description}</p>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                                  <span className="text-gray-500">
                                    GH₵ {item.unitPrice.toFixed(2)} × {item.quantity}
                                  </span>
                                  <span className="font-extrabold text-[#141B47]">
                                    GH₵ {item.subtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Grand Total & Notes */}
                          <div className="bg-[#141B47] text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              {req.adminNotes && (
                                <p className="text-xs text-gray-200 mb-1">
                                  <strong>Admin Notes:</strong> {req.adminNotes}
                                </p>
                              )}
                              <p className="text-[11px] text-[#F2901F]">Please review quotation and confirm below.</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] uppercase text-gray-300 font-semibold block">Total Quotation Amount</span>
                              <span className="text-lg font-black text-[#F2901F]">
                                GH₵ {(req.totalCost || req.sourcingItems.reduce((s: number, i: any) => s + i.subtotal, 0)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Fallback single price view */
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold text-gray-700">Single Quotation Summary</p>
                            {req.unitPrice != null ? (
                              <p className="text-xs text-gray-600 mt-0.5">
                                GH₵ {req.unitPrice.toFixed(2)} / unit × {req.quantity || 1} = <strong>GH₵ {(req.totalCost || (req.unitPrice * (req.quantity || 1))).toFixed(2)}</strong>
                              </p>
                            ) : (
                              <p className="text-xs text-amber-600 font-semibold mt-0.5">Awaiting Quotation Review</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Customer Confirmation Action if Awaiting */}
                      {isAwaitingConfirmation && (
                        <div className="pt-3 border-t border-amber-200 flex gap-3">
                          <button
                            onClick={() => handleCustomerResponse(req.id, "CONFIRM")}
                            disabled={respondingId === req.id}
                            className="flex-1 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                          >
                            {respondingId === req.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <>
                                <Check size={14} /> Confirm Quotation
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleCustomerResponse(req.id, "DECLINE")}
                            disabled={respondingId === req.id}
                            className="py-2 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Decline Quotation
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Price History Toggle */}
                    {req.priceHistory && req.priceHistory.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryId(isHistoryOpen ? null : req.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 cursor-pointer"
                        >
                          <History size={13} />
                          <span>Price Update History ({req.priceHistory.length})</span>
                          {isHistoryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {isHistoryOpen && (
                          <div className="mt-2.5 space-y-2 bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
                            {req.priceHistory.map((ph: any) => (
                              <div key={ph.id} className="flex flex-col sm:flex-row sm:items-center justify-between pb-1.5 border-b border-gray-200 last:border-0 last:pb-0 gap-1">
                                <div>
                                  <span className="font-semibold text-gray-800">
                                    GH₵ {ph.unitPrice.toFixed(2)}/unit × {ph.quantity} = GH₵ {ph.totalCost.toFixed(2)}
                                  </span>
                                  {ph.notes && <p className="text-gray-500 italic mt-0.5">{ph.notes}</p>}
                                </div>
                                <div className="text-[11px] text-gray-400 font-mono">
                                  {new Date(ph.createdAt).toLocaleString()} by {ph.updatedByName}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
