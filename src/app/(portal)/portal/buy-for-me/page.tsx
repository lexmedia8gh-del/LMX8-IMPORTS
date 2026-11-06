"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { 
  ShoppingBag, Plus, UploadCloud, Link as LinkIcon, ListPlus, 
  Trash2, ArrowRight, ArrowLeft, CheckCircle2, Clock, 
  AlertCircle, ChevronRight, Eye, RefreshCw, Loader2, Sparkles, Image as ImageIcon
} from "lucide-react";
import { 
  createBuyForMeRequestAction, 
  getCustomerBuyForMeRequestsAction,
  CreateBuyForMeItemInput,
  CreateBuyForMeRequestInput
} from "@/app/actions/buy-for-me";
import { useBrandSettings } from "@/components/brand-provider";

type SubmissionMode = "IMAGE_UPLOAD" | "MANUAL_LIST" | "LINK_SUBMISSION";

interface FormItem {
  id: string;
  productName: string;
  description: string;
  productUrl: string;
  quantity: number;
  preferredSpecs: string;
  budget: string;
  imageUrl?: string;
}

const INITIAL_ITEM = (): FormItem => ({
  id: `item-${Date.now()}-${Math.random()}`,
  productName: "",
  description: "",
  productUrl: "",
  quantity: 1,
  preferredSpecs: "",
  budget: "",
  imageUrl: "",
});

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  SUBMITTED: { label: "Request Submitted", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  UNDER_REVIEW: { label: "Under Review", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  QUOTATION_READY: { label: "Quotation Ready", bg: "bg-amber-50 border-amber-300 ring-2 ring-amber-100", text: "text-amber-800" },
  PAYMENT_PENDING: { label: "Payment Pending", bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PURCHASING: { label: "Purchasing in Progress", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  RECEIVED_AT_WAREHOUSE: { label: "At China Warehouse", bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700" },
  IN_TRANSIT: { label: "In Transit to Ghana", bg: "bg-sky-50 border-sky-200", text: "text-sky-700" },
  DELIVERED: { label: "Delivered / Ready", bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-900" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50 border-red-200", text: "text-red-700" },
};

export default function BuyForMePortalPage() {
  const [view, setView] = useState<"dashboard" | "new_request">("dashboard");
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Form State
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("MANUAL_LIST");
  const [step, setStep] = useState<"fill" | "review">("fill");
  const [items, setItems] = useState<FormItem[]>([INITIAL_ITEM()]);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [purchasingPreferences, setPurchasingPreferences] = useState("EXACT_MATCH");
  const [deliveryPreferences, setDeliveryPreferences] = useState("STANDARD");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "#F2901F";
  const primaryColor = branding?.primaryColor || "#141B47";

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await getCustomerBuyForMeRequestsAction();
      setRequests(data || []);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const addItem = () => {
    setItems((prev) => [...prev, INITIAL_ITEM()]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, field: keyof FormItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleImageUpload = (id: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image file size should be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      updateItem(id, "imageUrl", e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validateAndProceedToReview = () => {
    setFormError(null);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productName.trim()) {
        setFormError(`Product #${i + 1} must have a name or description.`);
        return;
      }
      if (submissionMode === "LINK_SUBMISSION" && !item.productUrl.trim()) {
        setFormError(`Product #${i + 1} requires a link (1688, Taobao, Alibaba, etc.).`);
        return;
      }
      if (!item.quantity || item.quantity < 1) {
        setFormError(`Product #${i + 1} quantity must be at least 1.`);
        return;
      }
    }
    setStep("review");
  };

  const handleSubmitFinal = async () => {
    setSubmitting(true);
    setFormError(null);

    const payload: CreateBuyForMeRequestInput = {
      submissionType: submissionMode,
      items: items.map((it) => ({
        productName: it.productName.trim(),
        description: it.description?.trim() || undefined,
        productUrl: it.productUrl?.trim() || undefined,
        quantity: Number(it.quantity) || 1,
        preferredSpecs: it.preferredSpecs?.trim() || undefined,
        budget: it.budget ? parseFloat(it.budget) : undefined,
        imageUrl: it.imageUrl || undefined,
      })),
      additionalInstructions: additionalInstructions.trim() || undefined,
      purchasingPreferences,
      deliveryPreferences,
    };

    try {
      const res = await createBuyForMeRequestAction(payload);
      if (res.error) {
        setFormError(res.error);
        setSubmitting(false);
      } else {
        // Reset and go back to dashboard
        setItems([INITIAL_ITEM()]);
        setAdditionalInstructions("");
        setStep("fill");
        setView("dashboard");
        await loadRequests();
      }
    } catch (err: any) {
      setFormError(err?.message || "Failed to submit request.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Buy for Me</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-[#141B47]">
              Concierge Procurement
            </span>
          </div>
          <p className="text-sm mt-1 text-[#667085]">
            Let LMX8 IMPORTS purchase products on your behalf from China, negotiate factory prices, inspect items, and ship them to Ghana.
          </p>
        </div>

        {view === "dashboard" ? (
          <button
            onClick={() => setView("new_request")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:opacity-95 transition-opacity cursor-pointer w-fit"
            style={{ background: accentColor }}
          >
            <Plus size={16} />
            New Buy for Me Request
          </button>
        ) : (
          <button
            onClick={() => {
              setView("dashboard");
              setStep("fill");
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer w-fit"
          >
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
        )}
      </div>

      {view === "dashboard" ? (
        /* DASHBOARD VIEW */
        <div className="space-y-6">
          {/* Quick Info Card */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-500 uppercase">Active Requests</span>
              <p className="text-2xl font-black text-[#141B47] mt-1">
                {requests.filter((r) => !["DELIVERED", "CANCELLED"].includes(r.status)).length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Being reviewed, quoted, or processed</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-500 uppercase">Quotations Ready</span>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {requests.filter((r) => r.status === "QUOTATION_READY" || (r.latestQuotation && !r.latestQuotation.isPaid)).length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Awaiting your review and payment</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
              <span className="text-xs font-bold text-gray-500 uppercase">How It Works</span>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Submit items via photo, list, or link → Receive transparent quotation with all fees → Pay securely with Paystack → Track from China to Ghana.
              </p>
            </div>
          </div>

          {/* Requests List */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-base text-[#172236]">My Buy for Me Requests</h2>
              <button
                onClick={loadRequests}
                disabled={loadingRequests}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 cursor-pointer"
              >
                <RefreshCw size={12} className={loadingRequests ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {loadingRequests ? (
              <div className="py-20 text-center text-gray-500 flex flex-col items-center gap-2">
                <Loader2 size={28} className="animate-spin text-[#141B47]" />
                <p className="text-xs">Loading requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-20 text-center text-gray-500 flex flex-col items-center gap-3">
                <ShoppingBag size={40} className="text-gray-300" />
                <p className="font-bold text-base text-[#172236]">No Buy for Me requests yet</p>
                <p className="text-xs max-w-sm">
                  Ready to buy something from 1688, Taobao, or Chinese suppliers? Submit your product links or photos and we will purchase it for you.
                </p>
                <button
                  onClick={() => setView("new_request")}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white mt-2 cursor-pointer"
                  style={{ background: accentColor }}
                >
                  Create Your First Request
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {requests.map((r) => {
                  const badge = STATUS_BADGES[r.status] || {
                    label: r.status,
                    bg: "bg-gray-100 border-gray-200",
                    text: "text-gray-700",
                  };
                  const quote = r.latestQuotation;

                  return (
                    <div
                      key={r.id}
                      className="p-6 hover:bg-gray-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {r.firstItemImage ? (
                          <img
                            src={r.firstItemImage}
                            alt="Product"
                            className="w-14 h-14 object-cover rounded-xl border border-gray-200 shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shrink-0">
                            <ShoppingBag size={24} />
                          </div>
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-bold text-[#141B47]">
                              {r.requestNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg} ${badge.text}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {r.itemCount} item{r.itemCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#172236]">
                            {r.firstItemName}
                            {r.itemCount > 1 ? ` and ${r.itemCount - 1} other item(s)` : ""}
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            Submitted: {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-center">
                        {quote && (
                          <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-gray-500">Quotation</span>
                            <p className="text-base font-extrabold text-[#141B47]">
                              GH₵ {quote.grandTotal.toFixed(2)}
                            </p>
                            {quote.isPaid ? (
                              <span className="text-[10px] font-bold text-emerald-600">Paid</span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-600">Payment Pending</span>
                            )}
                          </div>
                        )}

                        <Link
                          href={`/portal/buy-for-me/${r.id}`}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#141B47] hover:bg-[#355DAF] transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          View Details & Quote
                          <ChevronRight size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NEW REQUEST FORM */
        <div className="space-y-6">
          {step === "fill" ? (
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-7">
              {/* Submission Mode Selector */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">
                  Choose Submission Method
                </label>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "MANUAL_LIST",
                      icon: ListPlus,
                      title: "Option B: List Products",
                      desc: "Provide product details, specs, quantities & budget",
                    },
                    {
                      id: "LINK_SUBMISSION",
                      icon: LinkIcon,
                      title: "Option C: Paste Links",
                      desc: "Submit URLs from 1688, Taobao, Alibaba, etc.",
                    },
                    {
                      id: "IMAGE_UPLOAD",
                      icon: UploadCloud,
                      title: "Option A: Upload Photos",
                      desc: "Upload photos or screenshots of items",
                    },
                  ].map((mode) => {
                    const active = submissionMode === mode.id;
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSubmissionMode(mode.id as SubmissionMode)}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? "border-[#141B47] bg-[#141B47]/5 ring-2 ring-[#141B47]"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <Icon size={20} className={active ? "text-[#141B47]" : "text-gray-400"} />
                        <p className={`font-bold text-xs mt-2 ${active ? "text-[#141B47]" : "text-gray-700"}`}>
                          {mode.title}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{mode.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h3 className="font-bold text-base text-[#172236]">
                    Products to Purchase ({items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#141B47] hover:underline cursor-pointer"
                  >
                    <Plus size={14} /> Add Another Product
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700">
                          Product #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        )}
                      </div>

                      {/* Product Name */}
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="text-xs font-semibold text-gray-700">
                            Product Name / Model <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Wireless Noise Cancelling Headphones - Model X"
                            value={item.productName}
                            onChange={(e) => updateItem(item.id, "productName", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-700">
                            Quantity <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                          />
                        </div>
                      </div>

                      {/* If LINK_SUBMISSION, require URL */}
                      {submissionMode === "LINK_SUBMISSION" && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-700">
                            Product Link (1688, Taobao, Alibaba, Tmall, etc.) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="url"
                            placeholder="https://detail.1688.com/offer/..."
                            value={item.productUrl}
                            onChange={(e) => updateItem(item.id, "productUrl", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 font-mono"
                          />
                        </div>
                      )}

                      {/* Specs & Budget */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-700">
                            Preferred Specifications (Size, Colour, Material)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Colour: Matte Black, Size: XL, Voltage: 220V"
                            value={item.preferredSpecs}
                            onChange={(e) => updateItem(item.id, "preferredSpecs", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-700">
                            Target Budget per Unit (Optional, GH₵)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 150.00"
                            value={item.budget}
                            onChange={(e) => updateItem(item.id, "budget", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                          />
                        </div>
                      </div>

                      {/* Product Description */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700">
                          Description or Specific Requirements
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Describe specific features, packaging preferences, or barcode requirements..."
                          value={item.description}
                          onChange={(e) => updateItem(item.id, "description", e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 resize-none"
                        />
                      </div>

                      {/* Image Upload for item */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-700">
                          Product Image / Screenshot
                        </label>
                        {item.imageUrl ? (
                          <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-gray-200">
                            <img
                              src={item.imageUrl}
                              alt="Item preview"
                              className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                            />
                            <div className="flex-1 text-xs">
                              <p className="font-semibold text-gray-800">Image attached</p>
                              <p className="text-[11px] text-gray-500">Ready for review</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, "imageUrl", "")}
                              className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <label className="border border-dashed border-gray-300 rounded-xl p-3 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 cursor-pointer text-xs text-gray-600">
                            <UploadCloud size={16} />
                            <span>Upload product photo or screenshot (PNG, JPG)</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload(item.id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full py-2.5 rounded-xl border border-dashed border-gray-300 hover:border-gray-400 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Add Another Product to this Request
                </button>
              </div>

              {/* Preferences Section */}
              <div className="pt-4 border-t border-gray-100 space-y-4">
                <h3 className="font-bold text-base text-[#172236]">Procurement & Shipping Preferences</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Alternative Product Policy
                    </label>
                    <select
                      value={purchasingPreferences}
                      onChange={(e) => setPurchasingPreferences(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                    >
                      <option value="EXACT_MATCH">Exact Match Only (Reject if not 100% same)</option>
                      <option value="CHEAPER_ALTERNATIVE">Suggest Cheaper / Equivalent Alternative</option>
                      <option value="BEST_QUALITY">Suggest Best Quality Match Available</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Delivery Speed Preference
                    </label>
                    <select
                      value={deliveryPreferences}
                      onChange={(e) => setDeliveryPreferences(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20"
                    >
                      <option value="STANDARD">Standard Air Freight (Fast & economical)</option>
                      <option value="EXPRESS">Express Air (Urgent delivery)</option>
                      <option value="SEA_FREIGHT">Sea Freight (Bulk / Heavy items)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-700">
                    Additional Instructions / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                    placeholder="e.g. Please check electrical plugs for UK/Ghana compatibility, test before shipping..."
                    className="w-full px-3.5 py-2 rounded-xl text-xs border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]/20 resize-none"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setView("dashboard")}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={validateAndProceedToReview}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  style={{ background: accentColor }}
                >
                  Review Order Details <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* REVIEW SCREEN */
            <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-6">
              <div className="pb-3 border-b border-gray-100">
                <h2 className="text-lg font-bold text-[#172236]">Review Your Buy for Me Request</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Inspect the details before final submission. Our sourcing team in China will receive this immediately.
                </p>
              </div>

              {/* Items Summary */}
              <div className="space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500">
                  Products ({items.length})
                </h3>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                  {items.map((it, idx) => (
                    <div key={it.id} className="p-4 flex items-start gap-4">
                      {it.imageUrl ? (
                        <img
                          src={it.imageUrl}
                          alt="Item"
                          className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                          <ShoppingBag size={20} />
                        </div>
                      )}
                      <div className="space-y-1 flex-1 text-xs">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm text-gray-900">{it.productName}</p>
                          <span className="font-bold text-xs px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-800">
                            Qty: {it.quantity}
                          </span>
                        </div>
                        {it.productUrl && (
                          <p className="text-blue-600 truncate max-w-md font-mono text-[11px]">
                            {it.productUrl}
                          </p>
                        )}
                        {it.preferredSpecs && (
                          <p className="text-gray-600">Specs: <strong>{it.preferredSpecs}</strong></p>
                        )}
                        {it.budget && (
                          <p className="text-emerald-700">Target Budget: <strong>GH₵ {it.budget}</strong></p>
                        )}
                        {it.description && (
                          <p className="text-gray-500 italic mt-0.5">&ldquo;{it.description}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferences Summary */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Alternative Policy:</span>
                  <span className="font-semibold text-gray-800">{purchasingPreferences.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping Speed:</span>
                  <span className="font-semibold text-gray-800">{deliveryPreferences.replace(/_/g, " ")}</span>
                </div>
                {additionalInstructions && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-gray-500 block mb-0.5">Instructions:</span>
                    <p className="text-gray-700 italic">{additionalInstructions}</p>
                  </div>
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep("fill")}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Edit
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitFinal}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-95 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                  style={{ background: accentColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Submitting Request...
                    </>
                  ) : (
                    <>
                      Confirm & Submit Request <CheckCircle2 size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
