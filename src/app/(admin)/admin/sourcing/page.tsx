"use client";

import { useEffect, useState } from "react";
import {
  getAllSourcingRequestsAction,
  getSourcingRequestDetailsAction,
  adminSaveOrPublishSourcingWorkspaceAction,
  initiateSourcingItemPhotoUploadAction,
} from "@/app/actions/sourcing-credits";
import { 
  PackageSearch, CheckCircle2, AlertCircle, Search, RefreshCw, 
  Loader2, X, History, Calculator, Plus, Trash2, Image as ImageIcon,
  UploadCloud, Upload
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PriceHistoryEntry {
  id: string;
  unitPrice: number;
  quantity: number;
  totalCost: number;
  notes?: string | null;
  updatedByName?: string | null;
  createdAt: string;
}

interface SourcingItemEntry {
  id?: string;
  productName: string;
  description?: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
  previewUrl?: string;
  uploading?: boolean;
  uploadError?: string | null;
  isPublished?: boolean;
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
  isDraft?: boolean;
  publishedAt?: string | null;
  priceUpdatedAt?: string | null;
  priceUpdatedBy?: string | null;
  priceNotes?: string | null;
  imageUrl?: string | null;
  customerConfirmationStatus?: string;
  createdAt: string;
  updatedAt?: string;
  sourcingItems?: SourcingItemEntry[];
  priceHistory?: PriceHistoryEntry[];
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FEF3C7", text: "#92400E", label: "Awaiting Review" },
  QUOTED: { bg: "#DBEAFE", text: "#1E40AF", label: "Quotation Provided" },
  APPROVED: { bg: "#D1FAE5", text: "#065F46", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", text: "#991B1B", label: "Declined" },
  PURCHASED: { bg: "#EDE9FE", text: "#5B21B6", label: "Purchased in China" },
  SHIPPED: { bg: "#E0F2FE", text: "#0369A1", label: "Shipped" },
  COMPLETED: { bg: "#DCFCE7", text: "#166534", label: "Completed" },
};

export default function AdminSourcingPage() {
  const [requests, setRequests] = useState<SourcingRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal Workspace State
  const [selectedRequest, setSelectedRequest] = useState<SourcingRequestItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Workspace items & notes
  const [workspaceItems, setWorkspaceItems] = useState<SourcingItemEntry[]>([]);
  const [adminNotesInput, setAdminNotesInput] = useState<string>("");
  const [statusInput, setStatusInput] = useState<string>("QUOTED");

  const [savingAction, setSavingAction] = useState(false);
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

  const openReviewModal = async (req: SourcingRequestItem) => {
    setSelectedRequest(req);
    setLoadingDetails(true);
    setFeedback(null);
    try {
      const res = await getSourcingRequestDetailsAction(req.id);
      if (res.success && res.request) {
        setSelectedRequest(res.request as any);
        setAdminNotesInput(res.request.adminNotes || "");
        setStatusInput(res.request.status === "PENDING" ? "QUOTED" : res.request.status);
        setWorkspaceItems(
          (res.request.sourcingItems || []).map((it: any) => ({
            id: it.id,
            productName: it.productName || "",
            description: it.description || "",
            unitPrice: it.unitPrice || 0,
            quantity: it.quantity || 1,
            subtotal: it.subtotal || 0,
            imageUrl: it.imageUrl || "",
            previewUrl: it.imageUrl || "",
            isPublished: it.isPublished,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load request details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleAddItem = () => {
    setWorkspaceItems((prev) => [
      ...prev,
      {
        productName: selectedRequest?.productDetails || "Sourced Product",
        description: "",
        unitPrice: 0,
        quantity: selectedRequest?.quantity || 1,
        subtotal: 0,
        imageUrl: "",
        previewUrl: "",
      },
    ]);
  };

  const handleItemFileUpload = async (index: number, file: File) => {
    if (!file) return;

    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
      setWorkspaceItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          uploadError: "Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP.",
        };
        return updated;
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setWorkspaceItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          uploadError: "File size exceeds 10MB limit.",
        };
        return updated;
      });
      return;
    }

    const localPreview = URL.createObjectURL(file);

    setWorkspaceItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        previewUrl: localPreview,
        uploading: true,
        uploadError: null,
      };
      return updated;
    });

    try {
      const authRes = await initiateSourcingItemPhotoUploadAction(file.name, file.type, file.size);
      if (authRes.error || !authRes.signedUrl || !authRes.objectPath) {
        throw new Error(authRes.error || "Failed to authorize file upload.");
      }

      const uploadRes = await fetch(authRes.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Direct storage upload failed with status ${uploadRes.status}`);
      }

      setWorkspaceItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          imageUrl: authRes.objectPath,
          previewUrl: localPreview,
          uploading: false,
          uploadError: null,
        };
        return updated;
      });
    } catch (err: any) {
      console.error("Sourcing item photo upload error:", err);
      setWorkspaceItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          uploading: false,
          uploadError: err?.message || "Failed to upload photo. Please try again.",
        };
        return updated;
      });
    }
  };

  const handleRemoveItemPhoto = (index: number) => {
    setWorkspaceItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        imageUrl: "",
        previewUrl: "",
        uploadError: null,
      };
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setWorkspaceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof SourcingItemEntry, value: any) => {
    setWorkspaceItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const p = parseFloat(String(updated[index].unitPrice)) || 0;
      const q = parseInt(String(updated[index].quantity), 10) || 1;
      updated[index].subtotal = Math.round(p * q * 100) / 100;
      return updated;
    });
  };

  const computedWorkspaceTotal = workspaceItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);

  const handleSaveWorkspace = async (action: "draft" | "publish") => {
    if (!selectedRequest) return;
    if (workspaceItems.length === 0) {
      setFeedback({ type: "error", text: "Please add at least one product item with pricing." });
      return;
    }

    const sanitizedItems = [];
    for (const it of workspaceItems) {
      if (!it.productName.trim()) {
        setFeedback({ type: "error", text: "All product items must have a valid product name." });
        return;
      }
      const uPrice = parseFloat(String(it.unitPrice));
      if (!Number.isFinite(uPrice) || uPrice < 0) {
        setFeedback({ type: "error", text: `Please enter a valid non-negative unit price for "${it.productName}".` });
        return;
      }
      const qty = parseInt(String(it.quantity), 10);
      if (!Number.isFinite(qty) || qty < 1) {
        setFeedback({ type: "error", text: `Please enter a valid quantity (at least 1) for "${it.productName}".` });
        return;
      }

      sanitizedItems.push({
        id: it.id,
        productName: it.productName.trim(),
        description: it.description?.trim() || "",
        unitPrice: uPrice,
        quantity: qty,
        imageUrl: it.imageUrl || "",
      });
    }

    setSavingAction(true);
    setFeedback(null);
    try {
      const res = await adminSaveOrPublishSourcingWorkspaceAction({
        requestId: selectedRequest.id,
        adminNotes: adminNotesInput.trim(),
        status: statusInput,
        action,
        items: sanitizedItems,
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({
          type: "success",
          text: action === "publish"
            ? `Quotation published successfully! Total: GH₵ ${computedWorkspaceTotal.toFixed(2)}. Customer notified.`
            : "Draft saved successfully. Customer has not been notified.",
        });
        await loadData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to save sourcing update." });
    } finally {
      setSavingAction(false);
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
            Upload product photos, attach individual prices and descriptions, and publish quotations to customers.
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
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-[#141B47]"
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
              <option value="REJECTED">Declined</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-[#141B47]" />
            <p className="text-xs">Loading sourcing requests and workspace...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-3">
            <PackageSearch size={40} className="opacity-20 text-[#141B47]" />
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
                        <PackageSearch size={20} className="text-[#141B47]" />
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
                        {req.isDraft ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            Draft Workspace
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Published Quote
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#172236]">{req.productDetails}</p>
                      <p className="text-xs text-[#667085]">
                        Customer: <strong className="text-[#172236]">{req.customerName}</strong> ({req.customerId}) · Req. Qty: {req.quantity || 1}
                        {req.preferredSizeColor ? ` · Specs: ${req.preferredSizeColor}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:self-center">
                    <div className="text-left sm:text-right">
                      {req.totalCost != null ? (
                        <div>
                          <p className="text-xs text-gray-500">Total Quotation</p>
                          <p className="text-sm font-extrabold text-[#141B47]">
                            GH₵ {req.totalCost.toFixed(2)}
                          </p>
                          {req.priceUpdatedBy && (
                            <p className="text-[10px] text-gray-400">By {req.priceUpdatedBy}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 font-semibold">Awaiting Pricing</p>
                      )}
                    </div>

                    <button
                      onClick={() => openReviewModal(req)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                    >
                      <Calculator size={13} />
                      Open Sourcing Workspace
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADMIN PHOTO UPLOAD & PRICING WORKSPACE MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-[#E5E7EB] space-y-6 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-lg text-[#172236] flex items-center gap-2">
                  <span>Admin Sourcing & Quotation Workspace</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-[#141B47] text-white">
                    {selectedRequest.requestNumber}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Customer: <strong>{selectedRequest.customerName}</strong> ({selectedRequest.customerId}) · {selectedRequest.customerPhone || selectedRequest.customerEmail}
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-[#141B47]" />
                <span className="text-xs">Loading complete submission details...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Original Customer Submission Banner */}
                <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                      Original Customer Request Submission
                    </span>
                    <span className="text-xs text-gray-400">
                      Submitted: {new Date(selectedRequest.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    {selectedRequest.imageUrl && (
                      <img 
                        src={selectedRequest.imageUrl} 
                        alt="Customer Upload" 
                        className="w-24 h-24 object-cover rounded-xl border border-gray-300 shadow-xs shrink-0" 
                      />
                    )}
                    <div className="space-y-1.5">
                      <p className="text-sm font-bold text-[#172236]">{selectedRequest.productDetails}</p>
                      <p className="text-xs text-gray-600">
                        Requested Quantity: <strong>{selectedRequest.originalQuantity || selectedRequest.quantity || 1}</strong>
                        {selectedRequest.preferredSizeColor ? ` · Specs/Color: ${selectedRequest.preferredSizeColor}` : ""}
                      </p>
                      {selectedRequest.additionalInstructions && (
                        <p className="text-xs text-gray-500 italic bg-white p-2.5 rounded-lg border border-gray-200">
                          &ldquo;{selectedRequest.additionalInstructions}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Admin Photo Upload & Product Items Workspace */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#172236] flex items-center gap-2">
                        <ImageIcon size={16} className="text-[#F2901F]" /> Admin Sourced Product Photos & Pricing
                      </h4>
                      <p className="text-xs text-gray-500">
                        Upload photos, provide distinct product descriptions, unit prices, and quantities for each item.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3.5 py-1.5 bg-[#141B47] text-white rounded-xl text-xs font-bold hover:bg-[#355DAF] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} /> Add Product Item
                    </button>
                  </div>

                  {workspaceItems.length === 0 ? (
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center bg-gray-50/50 space-y-2">
                      <PackageSearch size={32} className="mx-auto text-gray-400 opacity-60" />
                      <p className="text-xs font-semibold text-gray-700">No product items added yet</p>
                      <p className="text-[11px] text-gray-500 max-w-xs mx-auto">
                        Click &ldquo;Add Product Item&rdquo; above to upload photos, enter item names, pricing, and specifications.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {workspaceItems.map((item, index) => (
                        <div key={index} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs relative space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                            <span className="text-xs font-bold text-[#141B47] uppercase tracking-wider font-mono">
                              Item #{index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="Remove Item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-3">
                            {/* Product Name */}
                            <div className="sm:col-span-3">
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                Product Name / Title <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 5kW Solar Inverter (Pure Sine Wave)"
                                value={item.productName}
                                onChange={(e) => handleItemChange(index, "productName", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                              />
                            </div>
                          </div>

                          {/* Product Photo Upload Section */}
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                              Product Photo
                            </label>
                            
                            {item.uploading ? (
                              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center justify-center gap-2 text-xs font-semibold text-[#141B47] min-h-[80px]">
                                <Loader2 size={18} className="animate-spin text-[#F2901F]" />
                                <span>Uploading photo...</span>
                              </div>
                            ) : item.previewUrl || item.imageUrl ? (
                              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center gap-3">
                                <img
                                  src={item.previewUrl || item.imageUrl || ""}
                                  alt={item.productName || "Product Preview"}
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 shrink-0 bg-white shadow-2xs"
                                />
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-gray-700 truncate">Photo Attached</p>
                                  <div className="flex flex-wrap gap-2">
                                    <label className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs">
                                      <Upload size={12} /> Replace Photo
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,image/jpg"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleItemFileUpload(index, f);
                                        }}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItemPhoto(index)}
                                      className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                                    >
                                      <Trash2 size={12} /> Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="relative border-2 border-dashed border-gray-300 hover:border-[#141B47] bg-gray-50 hover:bg-white rounded-xl p-4 text-center transition-all cursor-pointer group">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/jpg"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleItemFileUpload(index, f);
                                  }}
                                />
                                <div className="flex flex-col items-center justify-center space-y-1">
                                  <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-[#141B47]/10 flex items-center justify-center transition-colors">
                                    <UploadCloud size={18} className="text-[#141B47] group-hover:scale-110 transition-transform" />
                                  </div>
                                  <span className="text-xs font-bold text-[#141B47] group-hover:text-[#355DAF]">
                                    Upload Photo
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    Click to upload or drag and drop (JPG, PNG, WEBP max 10MB)
                                  </span>
                                </div>
                              </div>
                            )}

                            {item.uploadError && (
                              <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                                <AlertCircle size={12} /> {item.uploadError}
                              </p>
                            )}
                          </div>

                          {/* Description / Specifications */}
                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                              Product Specifications & Description
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Describe material, brand, model, packaging, factory inspection details..."
                              value={item.description || ""}
                              onChange={(e) => handleItemChange(index, "description", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47] resize-none"
                            />
                          </div>

                          {/* Pricing Row */}
                          <div className="grid sm:grid-cols-3 gap-3 pt-1">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                Unit Price (GH₵) <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                Quantity <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                              />
                            </div>

                            <div className="bg-[#F8FAFC] rounded-xl p-2.5 border border-gray-200 flex flex-col justify-center">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Subtotal</span>
                              <span className="text-sm font-extrabold text-[#141B47]">
                                GH₵ {(item.subtotal || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Grand Total Summary */}
                      <div className="bg-[#141B47] text-white rounded-2xl p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-300">Total Sourced Items: <strong>{workspaceItems.length}</strong></p>
                          <p className="text-[11px] text-[#F2901F] font-semibold">Ready for customer quotation publishing</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-300 uppercase font-semibold">Grand Total Payable</p>
                          <p className="text-xl font-black text-[#F2901F]">GH₵ {computedWorkspaceTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Status & Admin Notes */}
                <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Request Status</label>
                    <select
                      value={statusInput}
                      onChange={(e) => setStatusInput(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#141B47]"
                    >
                      <option value="PENDING">Awaiting Review (PENDING)</option>
                      <option value="QUOTED">Quotation Provided (QUOTED)</option>
                      <option value="APPROVED">Approved (APPROVED)</option>
                      <option value="PURCHASED">Purchased in China (PURCHASED)</option>
                      <option value="SHIPPED">Shipped to Warehouse (SHIPPED)</option>
                      <option value="COMPLETED">Completed (COMPLETED)</option>
                      <option value="REJECTED">Declined (REJECTED)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      General Admin Notes / Instructions
                    </label>
                    <input
                      type="text"
                      value={adminNotesInput}
                      onChange={(e) => setAdminNotesInput(e.target.value)}
                      placeholder="Optional notes for customer portal..."
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#141B47]"
                    />
                  </div>
                </div>

                {feedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                      feedback.type === "success"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{feedback.text}</span>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingAction}
                    onClick={() => handleSaveWorkspace("draft")}
                    className="px-4 py-2.5 text-xs font-bold text-[#141B47] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingAction && <Loader2 size={13} className="animate-spin" />}
                    Save as Draft (Private)
                  </button>
                  <button
                    type="button"
                    disabled={savingAction}
                    onClick={() => handleSaveWorkspace("publish")}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#F2901F] hover:bg-[#e08015] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {savingAction && <Loader2 size={13} className="animate-spin" />}
                    Publish Updates to Customer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
