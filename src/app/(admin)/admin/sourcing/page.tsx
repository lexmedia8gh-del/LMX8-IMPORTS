"use client";

import { useEffect, useState } from "react";
import {
  getAllSourcingRequestsAction,
  updateSourcingRequestStatusAction,
} from "@/app/actions/sourcing-credits";
import { PackageSearch, Clock, CheckCircle2, AlertCircle, Search, RefreshCw, Loader2, X, Edit3 } from "lucide-react";

interface SourcingRequestItem {
  id: string;
  requestNumber: string;
  productDetails: string;
  quantity: number | null;
  status: string;
  customerId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  creditsUsed: number;
  preferredSizeColor?: string | null;
  additionalInstructions?: string | null;
  adminNotes?: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FEF3C7", text: "#92400E", label: "Awaiting Review" },
  QUOTED: { bg: "#DBEAFE", text: "#1E40AF", label: "Quotation Provided" },
  APPROVED: { bg: "#D1FAE5", text: "#065F46", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", text: "#991B1B", label: "Rejected" },
  PURCHASED: { bg: "#EDE9FE", text: "#5B21B6", label: "Purchased in China" },
  SHIPPED: { bg: "#E0F2FE", text: "#0369A1", label: "Shipped" },
};

export default function AdminSourcingPage() {
  const [requests, setRequests] = useState<SourcingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<SourcingRequestItem | null>(null);
  const [newStatus, setNewStatus] = useState<any>("QUOTED");
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllSourcingRequestsAction();
      setRequests(data);
    } catch (err: any) {
      console.error("Failed to load sourcing requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    setUpdating(true);
    setFeedback(null);
    try {
      const res = await updateSourcingRequestStatusAction({
        requestId: selectedRequest.id,
        status: newStatus,
        adminNotes: adminNotes.trim(),
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({ type: "success", text: "Sourcing request updated successfully!" });
        await loadData();
        setTimeout(() => {
          setSelectedRequest(null);
          setFeedback(null);
        }, 1200);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to update status." });
    } finally {
      setUpdating(false);
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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Sourcing Requests</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Review, quote, and process live customer product sourcing applications.
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

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base text-[#172236]">All Applications</h2>
            {pendingCount > 0 ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FEF9C3] text-[#854D0E]">
                {pendingCount} Awaiting Review
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
                All Caught Up
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-brand-navy"
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
              <option value="PURCHASED">Purchased</option>
              <option value="SHIPPED">Shipped</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-brand-navy" />
            <p className="text-xs">Loading sourcing requests from PostgreSQL...</p>
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#F7F9FC] flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                      <PackageSearch size={18} className="text-[#0B1F44]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm text-[#172236] font-mono">{req.requestNumber}</p>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#172236]">{req.productDetails}</p>
                      <p className="text-xs text-[#667085] mt-0.5">
                        Applicant: <strong className="text-[#172236]">{req.customerName}</strong> ({req.customerId}) · Qty: {req.quantity || 1}
                        {req.preferredSizeColor ? ` · Specs: ${req.preferredSizeColor}` : ""}
                      </p>
                      {req.adminNotes && (
                        <p className="text-xs text-[#2563EB] bg-blue-50/60 px-2 py-1 rounded-md mt-1.5 w-fit">
                          Admin Note: {req.adminNotes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:shrink-0 self-end sm:self-center">
                    <span className="text-xs text-[#94A3B8] flex items-center gap-1 font-mono">
                      <Clock size={12} /> {req.createdAt}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setNewStatus(req.status === "PENDING" ? "QUOTED" : req.status);
                        setAdminNotes(req.adminNotes || "");
                        setFeedback(null);
                      }}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FFB800] text-[#07182F] hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                    >
                      Update / Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E5E7EB] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-lg text-[#172236]">Review Sourcing Application</h3>
                <p className="text-xs text-[#667085] font-mono">{selectedRequest.requestNumber}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-3 border border-[#E2E8F0] text-xs space-y-1.5">
              <p>
                <span className="text-[#64748B]">Customer:</span>{" "}
                <strong>{selectedRequest.customerName}</strong> ({selectedRequest.customerId})
              </p>
              <p>
                <span className="text-[#64748B]">Product:</span>{" "}
                <strong>{selectedRequest.productDetails}</strong>
              </p>
              <p>
                <span className="text-[#64748B]">Quantity:</span> {selectedRequest.quantity || 1}
              </p>
              {selectedRequest.preferredSizeColor && (
                <p>
                  <span className="text-[#64748B]">Specs/Color:</span> {selectedRequest.preferredSizeColor}
                </p>
              )}
              {selectedRequest.additionalInstructions && (
                <p>
                  <span className="text-[#64748B]">Instructions:</span> {selectedRequest.additionalInstructions}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#172236] block mb-1">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy"
                >
                  <option value="PENDING">Awaiting Review (PENDING)</option>
                  <option value="QUOTED">Quotation Provided (QUOTED)</option>
                  <option value="APPROVED">Approved (APPROVED)</option>
                  <option value="PURCHASED">Purchased in China (PURCHASED)</option>
                  <option value="SHIPPED">Shipped to Warehouse (SHIPPED)</option>
                  <option value="REJECTED">Rejected (REJECTED)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#172236] block mb-1">
                  Admin Response / Quotation Details
                </label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Provide quotation price, supplier info, or instructions for the customer..."
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy resize-none"
                />
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
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                disabled={updating}
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={handleUpdateStatus}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-secondary rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {updating && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
