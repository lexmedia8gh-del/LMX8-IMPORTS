"use client";

import { useEffect, useState } from "react";
import {
  getAllSourcingRequestsAction,
  updateSourcingRequestStatusAction,
  adminUpdateSourcingPriceAction,
  getSourcingRequestDetailsAction,
} from "@/app/actions/sourcing-credits";
import { 
  PackageSearch, Clock, CheckCircle2, AlertCircle, Search, RefreshCw, 
  Loader2, X, Edit3, DollarSign, History, ExternalLink, Calculator, ArrowRight
} from "lucide-react";

interface PriceHistoryEntry {
  id: string;
  unitPrice: number;
  quantity: number;
  totalCost: number;
  notes?: string | null;
  updatedByName?: string | null;
  createdAt: string;
}

interface SourcingRequestItem {
  id: string;
  requestNumber: string;
  productDetails: string;
  quantity: number | null;
  originalQuantity?: number | null;
  status: string;
  customerId: string;
  customerDbId?: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  creditsUsed: number;
  preferredSizeColor?: string | null;
  additionalInstructions?: string | null;
  adminNotes?: string | null;
  unitPrice?: number | null;
  totalCost?: number | null;
  priceUpdatedAt?: string | null;
  priceUpdatedBy?: string | null;
  priceNotes?: string | null;
  imageUrl?: string | null;
  customerConfirmationStatus?: string;
  createdAt: string;
  updatedAt?: string;
  priceHistory?: PriceHistoryEntry[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FEF3C7", text: "#92400E", label: "Awaiting Review" },
  QUOTED: { bg: "#DBEAFE", text: "#1E40AF", label: "Quotation Provided" },
  APPROVED: { bg: "#D1FAE5", text: "#065F46", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", text: "#991B1B", label: "Rejected / Declined" },
  PURCHASED: { bg: "#EDE9FE", text: "#5B21B6", label: "Purchased in China" },
  SHIPPED: { bg: "#E0F2FE", text: "#0369A1", label: "Shipped" },
  COMPLETED: { bg: "#DCFCE7", text: "#166534", label: "Completed" },
};

export default function AdminSourcingPage() {
  const [requests, setRequests] = useState<SourcingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Price Management / Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState<SourcingRequestItem | null>(null);
  const [unitPriceInput, setUnitPriceInput] = useState<string>("");
  const [quantityInput, setQuantityInput] = useState<number>(1);
  const [priceNotesInput, setPriceNotesInput] = useState<string>("");
  const [statusInput, setStatusInput] = useState<any>("QUOTED");
  const [adminNotesInput, setAdminNotesInput] = useState<string>("");

  const [savingPrice, setSavingPrice] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllSourcingRequestsAction();
      setRequests(data as any);
    } catch (err: any) {
      console.error("Failed to load sourcing requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openReviewModal = (req: SourcingRequestItem) => {
    setSelectedRequest(req);
    setUnitPriceInput(req.unitPrice ? String(req.unitPrice) : "");
    setQuantityInput(req.quantity || 1);
    setPriceNotesInput(req.priceNotes || "");
    setStatusInput(req.status === "PENDING" ? "QUOTED" : req.status);
    setAdminNotesInput(req.adminNotes || "");
    setFeedback(null);
  };

  // Auto calculate total cost: unitPrice * quantity
  const computedTotal = (parseFloat(unitPriceInput) || 0) * (Number(quantityInput) || 1);

  const handleSavePrice = async () => {
    if (!selectedRequest) return;
    const parsedPrice = parseFloat(unitPriceInput);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setFeedback({ type: "error", text: "Please enter a valid unit price." });
      return;
    }

    setSavingPrice(true);
    setFeedback(null);
    try {
      const res = await adminUpdateSourcingPriceAction({
        requestId: selectedRequest.id,
        unitPrice: parsedPrice,
        quantity: Number(quantityInput) || 1,
        priceNotes: priceNotesInput.trim(),
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({ 
          type: "success", 
          text: `Price published successfully! Total: GH₵ ${computedTotal.toFixed(2)}. Customer has been alerted.` 
        });
        await loadData();
        // Update local modal data
        if (res.request) {
          setSelectedRequest((prev) => prev ? {
            ...prev,
            unitPrice: parsedPrice,
            quantity: Number(quantityInput) || 1,
            totalCost: computedTotal,
            priceNotes: priceNotesInput.trim(),
            status: "QUOTED",
            customerConfirmationStatus: "AWAITING_CONFIRMATION",
          } : null);
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update price." });
    } finally {
      setSavingPrice(false);
    }
  };

  const handleUpdateStatusOnly = async () => {
    if (!selectedRequest) return;
    setUpdatingStatus(true);
    setFeedback(null);
    try {
      const res = await updateSourcingRequestStatusAction({
        requestId: selectedRequest.id,
        status: statusInput,
        adminNotes: adminNotesInput.trim(),
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({ type: "success", text: "Request status updated successfully." });
        await loadData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.productDetails.toLowerCase().includes(search.toLowerCase()) ||
      r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.customerId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Sourcing Management</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Review customer product requests, quote unit prices, manage audit histories, and process orders.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#172236] transition-colors w-fit shadow-2xs cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base text-[#172236]">Sourcing Applications</h2>
            {pendingCount > 0 ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FEF9C3] text-[#854D0E]">
                {pendingCount} Awaiting Review
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                All Up to Date
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests, customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#172236] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending (Awaiting Review)</option>
              <option value="QUOTED">Quotation Provided</option>
              <option value="APPROVED">Approved</option>
              <option value="PURCHASED">Purchased in China</option>
              <option value="SHIPPED">Shipped</option>
              <option value="REJECTED">Rejected / Declined</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-brand-navy" />
            <p className="text-xs">Loading sourcing requests and pricing history...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-3">
            <PackageSearch size={40} className="opacity-20 text-brand-navy" />
            <p className="font-bold text-base text-[#172236]">No sourcing requests found</p>
            <p className="text-xs max-w-sm">
              {search || statusFilter !== "ALL"
                ? "No applications matched the current filters."
                : "Customer product sourcing requests submitted via the portal will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {filtered.map((req) => {
              const style = STATUS_STYLE[req.status] || {
                bg: "#F1F5F9",
                text: "#475569",
                label: req.status,
              };

              return (
                <div
                  key={req.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {req.imageUrl ? (
                      <img 
                        src={req.imageUrl} 
                        alt="Product" 
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200 shrink-0" 
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#F7F9FC] flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                        <PackageSearch size={20} className="text-[#0B1F44]" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#172236] font-mono">{req.requestNumber}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {style.label}
                        </span>
                        {req.customerConfirmationStatus === "CONFIRMED" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Customer Approved
                          </span>
                        )}
                        {req.customerConfirmationStatus === "DECLINED" && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            Customer Declined
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#172236]">{req.productDetails}</p>
                      <p className="text-xs text-[#667085]">
                        Applicant: <strong className="text-[#172236]">{req.customerName}</strong> ({req.customerId}) · Qty: {req.quantity || 1}
                        {req.originalQuantity && req.originalQuantity !== req.quantity ? ` (Orig: ${req.originalQuantity})` : ""}
                        {req.preferredSizeColor ? ` · Specs: ${req.preferredSizeColor}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:self-center">
                    {/* Current Quoted Price */}
                    <div className="text-left sm:text-right">
                      {req.unitPrice != null ? (
                        <div>
                          <p className="text-xs text-gray-500">Unit: GH₵ {req.unitPrice.toFixed(2)}</p>
                          <p className="text-sm font-extrabold text-[#141B47]">
                            Total: GH₵ {(req.totalCost || (req.unitPrice * (req.quantity || 1))).toFixed(2)}
                          </p>
                          {req.priceUpdatedBy && (
                            <p className="text-[10px] text-gray-400">By {req.priceUpdatedBy}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 font-semibold">Not Priced Yet</p>
                      )}
                    </div>

                    <button
                      onClick={() => openReviewModal(req)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <DollarSign size={13} />
                      Set Price / Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DETAIL & PRICE MANAGEMENT MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#E5E7EB] space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-lg text-[#172236] flex items-center gap-2">
                  <span>Price Management & Review</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                    {selectedRequest.requestNumber}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Customer: <strong>{selectedRequest.customerName}</strong> ({selectedRequest.customerId}) · {selectedRequest.customerPhone || selectedRequest.customerEmail}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Product info banner */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] flex gap-4 text-xs">
              {selectedRequest.imageUrl && (
                <img 
                  src={selectedRequest.imageUrl} 
                  alt="Product" 
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200 shrink-0" 
                />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#172236]">{selectedRequest.productDetails}</p>
                <p className="text-gray-600">
                  Customer&apos;s Requested Quantity: <strong>{selectedRequest.originalQuantity || selectedRequest.quantity || 1}</strong>
                </p>
                {selectedRequest.preferredSizeColor && (
                  <p className="text-gray-600">Preferred Specs/Color: <strong>{selectedRequest.preferredSizeColor}</strong></p>
                )}
                {selectedRequest.additionalInstructions && (
                  <p className="text-gray-500 italic mt-1">&ldquo;{selectedRequest.additionalInstructions}&rdquo;</p>
                )}
              </div>
            </div>

            {/* PRICING WORKSPACE (PART 1 CORE REQUIREMENT) */}
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wide">
                <Calculator size={14} /> Sourcing Price Calculator & Quotation
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {/* Unit Price */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Unit Price (GH₵) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={unitPriceInput}
                    onChange={(e) => setUnitPriceInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Confirmed Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                  />
                  {selectedRequest.originalQuantity && selectedRequest.originalQuantity !== quantityInput && (
                    <p className="text-[10px] text-amber-700 mt-1">
                      Original request: {selectedRequest.originalQuantity}
                    </p>
                  )}
                </div>

                {/* Auto Calculated Total */}
                <div className="bg-white rounded-lg p-2.5 border border-blue-200 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Total Item Cost</span>
                  <span className="text-lg font-black text-[#141B47]">
                    GH₵ {computedTotal.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-400">Unit Price × Qty</span>
                </div>
              </div>

              {/* Admin Notes / Explanation */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Pricing Notes / Explanation for Customer
                </label>
                <textarea
                  rows={2}
                  value={priceNotesInput}
                  onChange={(e) => setPriceNotesInput(e.target.value)}
                  placeholder="e.g. Verified with Guangzhou manufacturer, includes domestic China factory packaging..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47] resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-gray-500">
                  Saving will publish the updated price to the customer portal and send an email alert.
                </p>
                <button
                  type="button"
                  disabled={savingPrice || !unitPriceInput}
                  onClick={handleSavePrice}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#F2901F] hover:bg-[#e08015] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {savingPrice ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  Save & Publish Price
                </button>
              </div>
            </div>

            {/* AUDIT TRAIL / PRICE REVISION HISTORY */}
            {selectedRequest.priceHistory && selectedRequest.priceHistory.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2 bg-gray-50/50">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <History size={14} /> Price Revision Audit Trail ({selectedRequest.priceHistory.length})
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedRequest.priceHistory.map((h) => (
                    <div key={h.id} className="text-xs bg-white p-2.5 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div>
                        <span className="font-bold text-gray-800">GH₵ {h.unitPrice.toFixed(2)} / unit</span>
                        <span className="text-gray-500"> × {h.quantity} = </span>
                        <strong className="text-blue-900">GH₵ {h.totalCost.toFixed(2)}</strong>
                        {h.notes && <p className="text-[11px] text-gray-500 italic mt-0.5">{h.notes}</p>}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono sm:text-right">
                        <span>{new Date(h.createdAt).toLocaleString()}</span>
                        <br />
                        <span>By: {h.updatedByName || "Admin"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STATUS UPDATE WORKSPACE */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Status</label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  >
                    <option value="PENDING">Awaiting Review (PENDING)</option>
                    <option value="QUOTED">Quotation Provided (QUOTED)</option>
                    <option value="APPROVED">Approved (APPROVED)</option>
                    <option value="PURCHASED">Purchased in China (PURCHASED)</option>
                    <option value="SHIPPED">Shipped to Warehouse (SHIPPED)</option>
                    <option value="COMPLETED">Completed (COMPLETED)</option>
                    <option value="REJECTED">Rejected / Declined (REJECTED)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">
                    Internal Admin Status Note
                  </label>
                  <input
                    type="text"
                    value={adminNotesInput}
                    onChange={(e) => setAdminNotesInput(e.target.value)}
                    placeholder="General status tracking notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                </div>
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{feedback.text}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={handleUpdateStatusOnly}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-secondary rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {updatingStatus && <Loader2 size={13} className="animate-spin" />}
                  Update Status Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
