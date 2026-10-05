"use client";

import { useEffect, useState } from "react";
import {
  getBatchesAction,
  createBatchAction,
  getShipmentsAction,
  updateBatchStatusAction,
  closeBatchAction,
} from "@/app/actions";
import { Batch, Shipment } from "@/lib/db";
import { Search, Plus, Package2, ArrowRight, AlertTriangle, Clock, Trash2, CheckCircle2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import Link from "next/link";

const BATCH_STATUSES = [
  "OPEN",
  "IN TRANSIT",
  "ARRIVED IN GHANA",
  "PROCESSING / COLLECTION",
  "CLOSED",
];

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Close Batch Confirmation Modal State
  const [batchToClose, setBatchToClose] = useState<Batch | null>(null);
  const [closing, setClosing] = useState(false);

  // Cleanup Trigger State
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    departure: "",
    arrival: "",
    status: "OPEN",
  });

  const loadData = async () => {
    setLoading(true);
    const [b, s] = await Promise.all([getBatchesAction(), getShipmentsAction()]);
    setBatches(b);
    setShipments(s);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    await createBatchAction({
      name: formData.name || formData.description,
      description: formData.description,
      departure: formData.departure,
      arrival: formData.arrival,
      status: formData.status,
    });
    await loadData();
    setCreating(false);
    setSheetOpen(false);
    setFormData({ name: "", description: "", departure: "", arrival: "", status: "OPEN" });
  };

  const handleStatusChange = async (batch: Batch, newStatus: string) => {
    if (newStatus === "CLOSED") {
      // Require explicit confirmation
      setBatchToClose(batch);
      return;
    }
    await updateBatchStatusAction(batch.id, newStatus);
    await loadData();
  };

  const handleConfirmClose = async () => {
    if (!batchToClose) return;
    setClosing(true);
    try {
      await closeBatchAction(batchToClose.id);
      setBatchToClose(null);
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to close batch.");
    } finally {
      setClosing(false);
    }
  };

  const handleManualCleanup = async () => {
    setCleaning(true);
    setCleanupMessage(null);
    try {
      const response = await fetch("/api/admin/file-retention", { method: "POST" });
      if (!response.ok) {
        throw new Error("Cleanup request failed");
      }
      const res = await response.json();
      setCleanupMessage(
        `Cleanup completed: ${res.totalFilesDeleted} file(s) permanently deleted across ${res.processedBatchesCount} expired closed batch(es).`
      );
      await loadData();
    } catch (err: any) {
      setCleanupMessage(`Cleanup error: ${err?.message || "Unexpected error"}`);
    } finally {
      setCleaning(false);
    }
  };

  const getShipmentCount = (batchId: string) => shipments.filter((s) => s.batch === batchId).length;

  const filtered = batches.filter(
    (b) =>
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase()) ||
      b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>
            Batch Management & Lifecycle
          </h1>
          <p className="text-sm mt-1" style={{ color: "#667085" }}>
            Group shipments into batches, manage lifecycle states, and control file retention.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualCleanup}
            disabled={cleaning}
            title="Execute server-side permanent file deletion for batches past their 7-day retention period"
            className="px-4 py-2.5 text-xs font-bold rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-[#0B1F44] flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Trash2 size={15} className="text-red-500" />
            {cleaning ? "Processing..." : "Run Retention Cleanup"}
          </button>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger className="px-5 py-2.5 text-sm font-bold rounded-xl transition-all hover:opacity-90 shadow-sm flex items-center gap-2 bg-[#FFB800] text-[#07182F]">
              <Plus size={16} /> Create Batch
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-[#F7F9FC]">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-xl font-bold text-[#172236]">Create New Batch</SheetTitle>
              </SheetHeader>
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172236]">Batch Name / Description</label>
                  <input
                    required
                    placeholder="e.g. October Sea Freight Consignment"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236]">Est. Departure</label>
                    <input
                      type="date"
                      required
                      value={formData.departure}
                      onChange={(e) => setFormData({ ...formData, departure: e.target.value })}
                      className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236]">Est. Arrival</label>
                    <input
                      type="date"
                      required
                      value={formData.arrival}
                      onChange={(e) => setFormData({ ...formData, arrival: e.target.value })}
                      className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#172236]">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB]"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN TRANSIT">IN TRANSIT</option>
                    <option value="ARRIVED IN GHANA">ARRIVED IN GHANA</option>
                    <option value="PROCESSING / COLLECTION">PROCESSING / COLLECTION</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full h-12 mt-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm bg-[#0B1F44] text-white disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Generate Batch ID"}
                </button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {cleanupMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-blue-600 shrink-0" />
          <span>{cleanupMessage}</span>
        </div>
      )}

      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search batches by ID, name or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white shadow-sm border-[#E5E7EB] text-[#172236]"
        />
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-10 text-center text-[#667085]">Loading batches...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center text-center bg-white rounded-2xl border border-[#E5E7EB]">
            <Package2 size={48} className="mb-4 text-gray-200" />
            <p className="font-bold text-lg text-[#172236]">No batches found</p>
          </div>
        ) : (
          filtered.map((batch) => {
            const isClosed = batch.status === "CLOSED";
            const deletionDate = batch.fileDeletionAt ? new Date(batch.fileDeletionAt) : null;
            const isRetentionExpired = deletionDate ? deletionDate.getTime() <= Date.now() : false;

            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div>
                      <h3 className="font-bold text-lg text-[#172236]">{batch.id}</h3>
                      <p className="text-sm text-[#667085] mt-0.5">{batch.description || batch.name}</p>
                    </div>

                    <span
                      className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isClosed
                          ? "bg-gray-100 text-gray-700 border border-gray-300"
                          : batch.status === "ARRIVED IN GHANA"
                          ? "bg-amber-100 text-amber-800"
                          : batch.status === "IN TRANSIT"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {batch.status}
                    </span>
                  </div>

                  {/* Lifecycle Status Selector */}
                  <div className="mb-4">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                      Batch Lifecycle State
                    </label>
                    {isClosed ? (
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <Clock size={14} className="text-gray-500" />
                          <span>Batch Closed</span>
                        </div>
                        {deletionDate && (
                          <p className="text-[11px] text-gray-500 mt-1">
                            {isRetentionExpired ? (
                              <span className="text-red-600 font-medium">Retention Expired (Ready for cleanup)</span>
                            ) : (
                              <span>Permanent file deletion on: <strong>{deletionDate.toLocaleDateString()}</strong></span>
                            )}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={batch.status}
                          onChange={(e) => handleStatusChange(batch, e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white border-[#E5E7EB] focus:outline-none focus:border-yellow-400"
                        >
                          {BATCH_STATUSES.filter((s) => s !== "CLOSED").map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => setBatchToClose(batch)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors shrink-0"
                        >
                          Close Batch
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 pt-3 border-t border-[#F1F5F9]">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Departure</p>
                      <p className="text-sm font-semibold text-[#172236]">{batch.departure || "TBD"}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1">Arrival</p>
                      <p className="text-sm font-semibold text-[#172236]">{batch.arrival || "TBD"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9]">
                  <div>
                    <p className="text-xs text-[#667085]">Total Shipments</p>
                    <p className="font-bold text-[#172236]">{getShipmentCount(batch.id)}</p>
                  </div>
                  <Link href={`/admin/shipments?batch=${batch.id}`}>
                    <button className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F44] hover:text-[#FFB800] transition-colors">
                      View list <ArrowRight size={14} />
                    </button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── EXPLICIT CLOSE BATCH CONFIRMATION MODAL ── */}
      {batchToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-200 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#172236]">
                  Close Batch & Start 7-Day File Retention
                </h2>
                <p className="text-xs text-[#667085] mt-0.5">Batch: {batchToClose.id}</p>
              </div>
            </div>

            <div className="space-y-3 bg-[#F7F9FC] p-4 rounded-xl text-xs text-[#172236] leading-relaxed border border-[#E5E7EB]">
              <p className="font-semibold text-gray-900">
                Close this batch and begin the 7-day file retention period?
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[#667085]">
                <li>The batch status will be marked <strong>CLOSED</strong>.</li>
                <li>Shipment records, customer records, and tracking history will remain permanently available.</li>
                <li>Uploaded cargo photos/files will remain temporarily available for <strong>7 days</strong>.</li>
                <li>All uploaded storage files will be <strong>permanently deleted after 7 days</strong>.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBatchToClose(null)}
                disabled={closing}
                className="px-5 py-2.5 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={closing}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {closing ? "Closing..." : "Confirm Closure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
