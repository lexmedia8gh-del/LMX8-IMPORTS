"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  getAllBuyForMeRequestsAdminAction,
  getBuyForMeRequestDetailsAdminAction,
  adminSaveOrPublishQuotationAction,
  adminUpdateBuyForMeStatusAction,
  QuotationLineItemInput
} from "@/app/actions/buy-for-me";
import { 
  ShoppingBag, Search, RefreshCw, Loader2, X, DollarSign, 
  ExternalLink, CheckCircle2, AlertCircle, Calculator, Clock, 
  History, ArrowRight, ShieldCheck, Send, Save
} from "lucide-react";

interface RequestItem {
  id: string;
  requestNumber: string;
  submissionType: string;
  status: string;
  additionalInstructions?: string | null;
  customer: {
    id: string;
    name: string;
    customerIdentifier: string;
    phone?: string | null;
    email?: string | null;
  };
  itemCount: number;
  itemsSummary: string;
  firstItemImage?: string | null;
  latestQuotation?: {
    id: string;
    version: number;
    status: string;
    grandTotal: number;
    isPaid: boolean;
    publishedAt?: string | null;
  } | null;
  createdAt: string;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  SUBMITTED: { label: "Request Submitted", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  UNDER_REVIEW: { label: "Under Review", bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700" },
  QUOTATION_READY: { label: "Quotation Ready", bg: "bg-amber-50 border-amber-300", text: "text-amber-800" },
  PAYMENT_PENDING: { label: "Payment Pending", bg: "bg-orange-50 border-orange-200", text: "text-orange-700" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  PURCHASING: { label: "Purchasing in Progress", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  RECEIVED_AT_WAREHOUSE: { label: "At China Warehouse", bg: "bg-cyan-50 border-cyan-200", text: "text-cyan-700" },
  IN_TRANSIT: { label: "In Transit to Ghana", bg: "bg-sky-50 border-sky-200", text: "text-sky-700" },
  DELIVERED: { label: "Delivered / Ready", bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-900" },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50 border-red-200", text: "text-red-700" },
};

export default function AdminBuyForMePage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Selected request for pricing / detail workspace
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Quotation Workspace Form State
  const [lineItems, setLineItems] = useState<QuotationLineItemInput[]>([]);
  const [shippingFee, setShippingFee] = useState<string>("0");
  const [sourcingFee, setSourcingFee] = useState<string>("0");
  const [serviceFee, setServiceFee] = useState<string>("0");
  const [otherCharges, setOtherCharges] = useState<string>("0");
  const [otherChargesNotes, setOtherChargesNotes] = useState<string>("");
  const [quotationNotes, setQuotationNotes] = useState<string>("");

  // Status Updater State
  const [statusInput, setStatusInput] = useState<string>("UNDER_REVIEW");
  const [statusNoteInput, setStatusNoteInput] = useState<string>("");

  const [savingQuotation, setSavingQuotation] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllBuyForMeRequestsAdminAction({
        status: statusFilter,
        search,
      });
      setRequests(data as any);
    } catch (err) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const openQuotationWorkspace = async (reqId: string) => {
    setLoadingDetail(true);
    setFeedback(null);
    try {
      const detail = await getBuyForMeRequestDetailsAdminAction(reqId);
      if (detail) {
        setSelectedRequest(detail);
        setStatusInput(detail.status);
        setStatusNoteInput("");

        // Populate line items from existing quotation or items
        const latestQuote = detail.quotations[0];
        if (latestQuote && latestQuote.lineItems && latestQuote.lineItems.length > 0) {
          setLineItems(
            latestQuote.lineItems.map((li: any) => ({
              itemId: li.itemId || undefined,
              productName: li.productName,
              unitPrice: li.unitPrice,
              quantity: li.quantity,
              notes: li.notes || "",
            }))
          );
          setShippingFee(String(latestQuote.shippingFee || 0));
          setSourcingFee(String(latestQuote.sourcingFee || 0));
          setServiceFee(String(latestQuote.serviceFee || 0));
          setOtherCharges(String(latestQuote.otherCharges || 0));
          setOtherChargesNotes(latestQuote.otherChargesNotes || "");
          setQuotationNotes(latestQuote.adminNotes || "");
        } else {
          // Initialize from customer items
          setLineItems(
            detail.items.map((it: any) => ({
              itemId: it.id,
              productName: it.productName,
              unitPrice: it.unitPrice || 0,
              quantity: it.quantity || 1,
              notes: it.preferredSpecs || "",
            }))
          );
          setShippingFee("0");
          setSourcingFee("0");
          setServiceFee("0");
          setOtherCharges("0");
          setOtherChargesNotes("");
          setQuotationNotes("");
        }
      }
    } catch (err) {
      console.error("Failed to load request detail:", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateLineItem = (index: number, field: keyof QuotationLineItemInput, value: any) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Calculations
  const totalProductCost = lineItems.reduce(
    (sum, li) => sum + (Number(li.unitPrice) || 0) * (Number(li.quantity) || 1),
    0
  );
  const grandTotal =
    totalProductCost +
    (parseFloat(shippingFee) || 0) +
    (parseFloat(sourcingFee) || 0) +
    (parseFloat(serviceFee) || 0) +
    (parseFloat(otherCharges) || 0);

  const handleSaveQuotation = async (publish: boolean) => {
    if (!selectedRequest) return;
    setSavingQuotation(true);
    setFeedback(null);
    try {
      const res = await adminSaveOrPublishQuotationAction({
        requestId: selectedRequest.id,
        lineItems,
        shippingFee: parseFloat(shippingFee) || 0,
        sourcingFee: parseFloat(sourcingFee) || 0,
        serviceFee: parseFloat(serviceFee) || 0,
        otherCharges: parseFloat(otherCharges) || 0,
        otherChargesNotes: otherChargesNotes.trim(),
        adminNotes: quotationNotes.trim(),
        publish,
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: publish
            ? `Quotation published to customer! Total: GH₵ ${grandTotal.toFixed(2)}. Customer received in-app & email notification.`
            : `Quotation saved as draft.`,
        });
        await loadRequests();
        // Refresh detail
        const updated = await getBuyForMeRequestDetailsAdminAction(selectedRequest.id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to process quotation." });
    } finally {
      setSavingQuotation(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    setUpdatingStatus(true);
    setFeedback(null);
    try {
      const res = await adminUpdateBuyForMeStatusAction(
        selectedRequest.id,
        statusInput,
        statusNoteInput.trim() || undefined
      );

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({ type: "success", text: `Status updated to ${statusInput.replace(/_/g, " ")}.` });
        await loadRequests();
        const updated = await getBuyForMeRequestDetailsAdminAction(selectedRequest.id);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update status." });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Buy for Me Workspace</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Review customer concierge purchasing requests, calculate itemized quotations, publish prices, and track order fulfillment.
          </p>
        </div>
        <button
          onClick={loadRequests}
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
            <h2 className="font-semibold text-base text-[#172236]">All Buy for Me Requests</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800">
              {requests.length} Requests
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests, customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadRequests()}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#172236] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="QUOTATION_READY">Quotation Ready</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="PAYMENT_CONFIRMED">Payment Confirmed</option>
              <option value="PURCHASING">Purchasing</option>
              <option value="RECEIVED_AT_WAREHOUSE">At Warehouse</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-brand-navy" />
            <p className="text-xs">Loading Buy for Me requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-3">
            <ShoppingBag size={40} className="opacity-20 text-brand-navy" />
            <p className="font-bold text-base text-[#172236]">No requests found</p>
            <p className="text-xs max-w-sm">
              {search || statusFilter !== "ALL"
                ? "No applications matched the current filters."
                : "Customer Buy for Me requests submitted via the portal will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {requests.map((req) => {
              const badge = STATUS_BADGES[req.status] || {
                label: req.status,
                bg: "bg-gray-100 border-gray-200",
                text: "text-gray-700",
              };

              return (
                <div
                  key={req.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {req.firstItemImage ? (
                      <img
                        src={req.firstItemImage}
                        alt="Product"
                        className="w-12 h-12 object-cover rounded-xl border border-gray-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#F7F9FC] flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                        <ShoppingBag size={20} className="text-[#0B1F44]" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-[#172236] font-mono">
                          {req.requestNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {req.itemCount} item{req.itemCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#172236]">{req.itemsSummary}</p>
                      <p className="text-xs text-[#667085]">
                        Customer: <strong className="text-[#172236]">{req.customer.name}</strong> ({req.customer.customerIdentifier}) · {req.customer.phone || req.customer.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:self-center">
                    {req.latestQuotation && (
                      <div className="text-left sm:text-right">
                        <p className="text-xs text-gray-500">Quotation</p>
                        <p className="text-sm font-black text-[#141B47]">
                          GH₵ {req.latestQuotation.grandTotal.toFixed(2)}
                        </p>
                        {req.latestQuotation.isPaid ? (
                          <span className="text-[10px] font-bold text-emerald-600">Paid</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600">Unpaid</span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => openQuotationWorkspace(req.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Calculator size={13} />
                      Quote & Manage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QUOTATION WORKSPACE MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#E5E7EB] space-y-6 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-lg text-[#172236] flex items-center gap-2">
                  <span>Buy for Me Pricing Workspace</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-800">
                    {selectedRequest.requestNumber}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Customer: <strong>{selectedRequest.customer.name}</strong> ({selectedRequest.customer.customerIdentifier}) · {selectedRequest.customer.phone || selectedRequest.customer.email}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Request Details */}
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E2E8F0] space-y-3 text-xs">
              <div className="flex flex-wrap gap-4 text-gray-600">
                <span>Method: <strong>{selectedRequest.submissionType.replace(/_/g, " ")}</strong></span>
                <span>Policy: <strong>{selectedRequest.purchasingPreferences?.replace(/_/g, " ") || "Default"}</strong></span>
                <span>Shipping: <strong>{selectedRequest.deliveryPreferences?.replace(/_/g, " ") || "Default"}</strong></span>
              </div>
              {selectedRequest.additionalInstructions && (
                <p className="text-gray-700 italic border-t border-gray-200/80 pt-2">
                  &ldquo;{selectedRequest.additionalInstructions}&rdquo;
                </p>
              )}
            </div>

            {/* ITEM PRICING WORKSPACE */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                Product Line Item Pricing
              </h4>
              <div className="space-y-3">
                {lineItems.map((li, idx) => (
                  <div key={idx} className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#141B47]">
                        #{idx + 1} {li.productName}
                      </span>
                      {selectedRequest.items[idx]?.productUrl && (
                        <a
                          href={selectedRequest.items[idx].productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-mono"
                        >
                          <span>Open Supplier Link</span>
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-4 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={li.productName}
                          onChange={(e) => updateLineItem(idx, "productName", e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          Unit Price (GH₵)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={li.unitPrice}
                          onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 block mb-0.5">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
                      <input
                        type="text"
                        placeholder="Item notes / specifications / packaging..."
                        value={li.notes || ""}
                        onChange={(e) => updateLineItem(idx, "notes", e.target.value)}
                        className="text-[11px] px-2 py-1 border border-gray-200 rounded-md bg-white w-2/3"
                      />
                      <span className="font-bold text-gray-800">
                        Subtotal: GH₵ {((Number(li.unitPrice) || 0) * (Number(li.quantity) || 1)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ITEMIZED FEES & CHARGES */}
            <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                <Calculator size={14} /> Itemized Sourcing & Shipping Fees
              </h4>

              <div className="grid sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Shipping Fee (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Sourcing Fee (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sourcingFee}
                    onChange={(e) => setSourcingFee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Service Fee (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceFee}
                    onChange={(e) => setServiceFee(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Other Charges (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={otherCharges}
                    onChange={(e) => setOtherCharges(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              {parseFloat(otherCharges) > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">
                    Other Charges Explanation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Factory wooden crate packaging, battery hazardous shipping fee..."
                    value={otherChargesNotes}
                    onChange={(e) => setOtherChargesNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-700 block mb-0.5">
                  Quotation Notes for Customer
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional delivery instructions, estimated warehouse arrival date..."
                  value={quotationNotes}
                  onChange={(e) => setQuotationNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white resize-none"
                />
              </div>

              {/* TOTAL SUMMARY */}
              <div className="bg-white rounded-xl p-3 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-gray-600 space-y-0.5">
                  <p>Product Total: <strong>GH₵ {totalProductCost.toFixed(2)}</strong></p>
                  <p>Total Fees: <strong>GH₵ {(grandTotal - totalProductCost).toFixed(2)}</strong></p>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-500">Grand Total Payable</span>
                  <p className="text-xl font-black text-[#141B47]">
                    GH₵ {grandTotal.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* SAVE / PUBLISH ACTIONS */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingQuotation}
                  onClick={() => handleSaveQuotation(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Save size={13} /> Save Draft
                </button>
                <button
                  type="button"
                  disabled={savingQuotation || lineItems.length === 0}
                  onClick={() => handleSaveQuotation(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#F2901F] hover:bg-[#e08015] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingQuotation ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  Publish Quotation to Customer
                </button>
              </div>
            </div>

            {/* LIFECYCLE STATUS UPDATER */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">
                Update Order Lifecycle Status
              </h4>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Status</label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  >
                    <option value="SUBMITTED">1. Submitted (SUBMITTED)</option>
                    <option value="UNDER_REVIEW">2. Under Review (UNDER_REVIEW)</option>
                    <option value="QUOTATION_READY">3. Quotation Ready (QUOTATION_READY)</option>
                    <option value="PAYMENT_PENDING">4. Payment Pending (PAYMENT_PENDING)</option>
                    <option value="PAYMENT_CONFIRMED">5. Payment Confirmed (PAYMENT_CONFIRMED)</option>
                    <option value="PURCHASING">6. Purchasing in Progress (PURCHASING)</option>
                    <option value="RECEIVED_AT_WAREHOUSE">7. At China Warehouse (RECEIVED_AT_WAREHOUSE)</option>
                    <option value="IN_TRANSIT">8. In Transit to Ghana (IN_TRANSIT)</option>
                    <option value="DELIVERED">9. Delivered / Ready (DELIVERED)</option>
                    <option value="CANCELLED">Cancelled (CANCELLED)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Status Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Purchased on 1688, tracking # CN1234567..."
                    value={statusNoteInput}
                    onChange={(e) => setStatusNoteInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy"
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

              <div className="flex justify-between items-center pt-2">
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
                  onClick={handleUpdateStatus}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-secondary rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {updatingStatus && <Loader2 size={13} className="animate-spin" />}
                  Update Lifecycle Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
