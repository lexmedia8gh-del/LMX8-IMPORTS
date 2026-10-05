"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { 
  Database, Truck, Layers, Users, Clock, Bell, Shield, 
  AlertTriangle, Trash2, Eye, RefreshCw, Search, CheckCircle2, 
  X, Lock, ShieldAlert, ArrowRight, UserX, UserCheck
} from "lucide-react";
import { AdminDrawer } from "@/components/admin-drawer";
import { 
  getDatabaseOverviewAction,
  getDataRecordsAction,
  getRecordRelationshipsAction,
  deleteShipmentSafeAction,
  deleteBatchSafeAction,
  deleteCustomerSafeAction,
  deactivateCustomerSafeAction,
  deleteTrackingEventSafeAction,
  deleteNotificationSafeAction,
  cleanupTestDataAction,
} from "@/app/actions/data-management";
import Link from "next/link";

type TabType = "shipments" | "batches" | "customers" | "events" | "notifications" | "danger";

export default function AdminDataManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shipments");
  const [overview, setOverview] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Detail Drawer State
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);
  const [entityDetails, setEntityDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Deletion Modal State
  const [recordToDelete, setRecordToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>("");
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Danger Zone Test Purge State
  const [testPurgeText, setTestPurgeText] = useState<string>("");
  const [testPurgePin, setTestPurgePin] = useState<string>("");
  const [testPurgeResult, setTestPurgeResult] = useState<any>(null);
  const [testPurgeError, setTestPurgeError] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  // Success Feedback
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // Load Overview & Records
  const loadOverview = useCallback(async () => {
    try {
      const data = await getDatabaseOverviewAction();
      setOverview(data);
    } catch (e) {
      console.error("Failed to load DB overview:", e);
    }
  }, []);

  const loadRecords = useCallback(async (tab: TabType) => {
    if (tab === "danger") return;
    setLoading(true);
    try {
      const data = await getDataRecordsAction(tab);
      setRecords(data);
    } catch (e) {
      console.error(`Failed to load ${tab} records:`, e);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setSearch("");
    if (activeTab !== "danger") {
      loadRecords(activeTab);
    }
  }, [activeTab, loadRecords]);

  // Load Single Entity Details for Drawer
  const handleOpenDetails = async (type: string, id: string) => {
    setSelectedEntity({ type, id });
    setLoadingDetails(true);
    try {
      const data = await getRecordRelationshipsAction(type, id);
      setEntityDetails(data);
    } catch (e) {
      console.error("Failed to inspect record:", e);
      setEntityDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    setDeleteError(null);
    setIsDeleting(true);

    try {
      let res: any;
      if (recordToDelete.type === "Shipment") {
        res = await deleteShipmentSafeAction(recordToDelete.id, deleteConfirmationText, adminPinInput || undefined);
      } else if (recordToDelete.type === "Batch") {
        res = await deleteBatchSafeAction(recordToDelete.id, deleteConfirmationText, adminPinInput || undefined);
      } else if (recordToDelete.type === "Customer") {
        res = await deleteCustomerSafeAction(recordToDelete.id, deleteConfirmationText, adminPinInput || undefined);
      } else if (recordToDelete.type === "TrackingEvent") {
        res = await deleteTrackingEventSafeAction(recordToDelete.id);
      } else if (recordToDelete.type === "Notification") {
        res = await deleteNotificationSafeAction(recordToDelete.id);
      }

      if (res?.error) {
        setDeleteError(res.error);
        setIsDeleting(false);
      } else {
        showToast(`✓ ${recordToDelete.type} record (${recordToDelete.name}) safely deleted.`);
        setRecordToDelete(null);
        setDeleteConfirmationText("");
        setAdminPinInput("");
        setIsDeleting(false);
        setSelectedEntity(null);
        loadOverview();
        if (activeTab !== "danger") loadRecords(activeTab);
      }
    } catch (err: any) {
      setDeleteError(err?.message || "An unexpected error occurred during deletion.");
      setIsDeleting(false);
    }
  };

  // Execute Customer Deactivation
  const handleToggleCustomerStatus = async (customerId: string) => {
    startTransition(async () => {
      const res = await deactivateCustomerSafeAction(customerId);
      if (res?.success) {
        showToast(`Customer status updated to ${res.status}.`);
        loadOverview();
        loadRecords("customers");
        if (selectedEntity) handleOpenDetails("Customer", customerId);
      }
    });
  };

  // Execute Test Data Purge
  const handleRunTestPurge = async () => {
    setTestPurgeError(null);
    setTestPurgeResult(null);
    setIsPurging(true);

    try {
      const res = await cleanupTestDataAction(testPurgeText, testPurgePin);
      if (res?.error) {
        setTestPurgeError(res.error);
      } else {
        setTestPurgeResult(res);
        showToast(`Purged ${res.deletedShipmentsCount} test shipment(s) and ${res.deletedBatchesCount} test batch(es).`);
        setTestPurgeText("");
        setTestPurgePin("");
        loadOverview();
      }
    } catch (err: any) {
      setTestPurgeError(err?.message || "Purge execution failed.");
    } finally {
      setIsPurging(false);
    }
  };

  // Filter Records
  const filteredRecords = records.filter((r) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return Object.values(r).some((v) => 
      typeof v === "string" && v.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141B47] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-[#F2901F]" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              Admin Protected
            </span>
            <span className="text-xs text-[#667085]">Audit Logged</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#141B47]">Data Management &amp; Record Control</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Inspect data dependencies, review relationships, and execute controlled administrative cleanup.
          </p>
        </div>

        <button
          onClick={() => {
            loadOverview();
            if (activeTab !== "danger") loadRecords(activeTab);
          }}
          className="px-4 py-2 text-xs font-bold rounded-xl border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#141B47] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer self-start md:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Data
        </button>
      </div>

      {/* ── KPI STATISTIC CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Shipments", count: overview?.shipments ?? "—", tab: "shipments" as TabType, icon: <Truck size={16} />, color: "#355DAF" },
          { label: "Batches", count: overview?.batches ?? "—", tab: "batches" as TabType, icon: <Layers size={16} />, color: "#F2901F" },
          { label: "Customers", count: overview?.customers ?? "—", tab: "customers" as TabType, icon: <Users size={16} />, color: "#10B981" },
          { label: "Tracking Events", count: overview?.trackingEvents ?? "—", tab: "events" as TabType, icon: <Clock size={16} />, color: "#8B5CF6" },
          { label: "Notifications", count: overview?.notifications ?? "—", tab: "notifications" as TabType, icon: <Bell size={16} />, color: "#EC4899" },
          { label: "Payments (Protected)", count: overview?.payments ?? "—", tab: null, icon: <Shield size={16} />, color: "#059669" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => kpi.tab && setActiveTab(kpi.tab)}
            className={`p-4 rounded-2xl border transition-all ${
              kpi.tab
                ? "bg-white hover:shadow-md cursor-pointer border-[#E5E7EB]"
                : "bg-[#F7F9FC] border-gray-200 cursor-default"
            } ${activeTab === kpi.tab ? "ring-2 ring-[#F2901F]" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] truncate">
                {kpi.label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: kpi.color }}
              >
                {kpi.icon}
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-[#141B47] tabular-nums">{kpi.count}</p>
          </div>
        ))}
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        <div className="flex border-b border-[#F1F5F9] bg-[#F7F9FC] overflow-x-auto scrollbar-none">
          {[
            { id: "shipments" as TabType, label: "Shipments", icon: <Truck size={15} /> },
            { id: "batches" as TabType, label: "Batches", icon: <Layers size={15} /> },
            { id: "customers" as TabType, label: "Customers", icon: <Users size={15} /> },
            { id: "events" as TabType, label: "Tracking Events", icon: <Clock size={15} /> },
            { id: "notifications" as TabType, label: "Notifications", icon: <Bell size={15} /> },
            { id: "danger" as TabType, label: "Danger Zone & Purge", icon: <ShieldAlert size={15} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                activeTab === t.id
                  ? t.id === "danger"
                    ? "border-red-600 text-red-600 bg-red-50/50"
                    : "border-[#F2901F] text-[#141B47] bg-white"
                  : "border-transparent text-[#667085] hover:text-[#141B47] hover:bg-gray-50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="p-5 sm:p-6">
          {activeTab !== "danger" && (
            <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                <input
                  type="text"
                  placeholder={`Search ${activeTab} records...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-[#F7F9FC] focus:bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
                />
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <span className="text-xs text-[#667085] self-end sm:self-auto">
                Showing <strong>{filteredRecords.length}</strong> record(s)
              </span>
            </div>
          )}

          {/* ════════════ TAB 1: SHIPMENTS ════════════ */}
          {activeTab === "shipments" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Tracking Number", "Customer", "Batch", "Status", "Dependencies", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                        <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading shipments...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">No shipment records found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                          {s.trackingNumber}
                          <p className="text-[11px] font-sans font-normal text-[#667085] mt-0.5 truncate max-w-xs">
                            {s.description}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#172236]">
                          {s.customer}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#667085]">
                          {s.batch}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                            {s.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 text-[11px] text-[#667085]">
                            <span>{s.eventsCount} events</span>
                            <span>·</span>
                            <span>{s.photosCount} files</span>
                            {s.hasPaidPayments && (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold">
                                Paid
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails("Shipment", s.trackingNumber)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "Shipment", id: s.trackingNumber, name: s.trackingNumber })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════ TAB 2: BATCHES ════════════ */}
          {activeTab === "batches" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Batch Code", "Name", "Assigned Shipments", "Status", "Schedule", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                        <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading batches...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">No batch records found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                          {b.batchNumber}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-semibold text-[#172236]">
                          {b.name}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#667085]">
                          <span className={`font-bold ${b.shipmentsCount > 0 ? "text-[#141B47]" : "text-gray-400"}`}>
                            {b.shipmentsCount} shipment(s)
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            {b.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085]">
                          {b.departure || "TBD"} → {b.arrival || "TBD"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails("Batch", b.batchNumber)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "Batch", id: b.batchNumber, name: `${b.name} (${b.batchNumber})` })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════ TAB 3: CUSTOMERS ════════════ */}
          {activeTab === "customers" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Customer ID", "Name", "Contact", "History Summary", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                        <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading customer records...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">No customer records found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                          {c.customerIdentifier}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-bold text-[#172236]">
                          {c.name}
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085]">
                          {c.phone} {c.email !== "N/A" ? `· ${c.email}` : ""}
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085]">
                          <span>{c.shipmentsCount} shipments</span> · <span>{c.paymentsCount} payments</span> · <span>{c.credits} credits</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails("Customer", c.customerIdentifier)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            <button
                              onClick={() => handleToggleCustomerStatus(c.id)}
                              disabled={isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer ${
                                c.status === "ACTIVE"
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {c.status === "ACTIVE" ? <UserX size={13} /> : <UserCheck size={13} />}
                              {c.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                            {c.shipmentsCount === 0 && c.paymentsCount === 0 && (
                              <button
                                onClick={() => setRecordToDelete({ type: "Customer", id: c.customerIdentifier, name: `${c.name} (${c.customerIdentifier})` })}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════ TAB 4: TRACKING EVENTS ════════════ */}
          {activeTab === "events" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Shipment", "Checkpoint Status", "Location", "Remarks", "Timestamp", "Action"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                        <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading tracking events...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">No tracking events found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                          {e.shipmentTrackingNumber}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                            {e.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#172236]">
                          {e.location}
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085] max-w-xs truncate">
                          {e.note}
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085]">
                          {new Date(e.timestamp).toLocaleDateString()} {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setRecordToDelete({ type: "TrackingEvent", id: e.id, name: `Event for ${e.shipmentTrackingNumber}` })}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════ TAB 5: NOTIFICATIONS ════════════ */}
          {activeTab === "notifications" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Customer", "Title & Content", "Type", "Created", "Action"].map((h) => (
                      <th key={h} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-[#667085]">
                        <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading notifications...
                      </td>
                    </tr>
                  ) : filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-xs text-[#667085]">No notifications found.</td>
                    </tr>
                  ) : (
                    filteredRecords.map((n) => (
                      <tr key={n.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-xs text-[#141B47]">
                          {n.customerName} ({n.customerIdentifier})
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[#172236] max-w-sm">
                          <p className="font-semibold">{n.title}</p>
                          <p className="text-[11px] text-[#667085] truncate mt-0.5">{n.message}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-50 text-pink-800 border border-pink-200">
                            {n.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-[11px] text-[#667085]">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => setRecordToDelete({ type: "Notification", id: n.id, name: n.title })}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════ TAB 6: DANGER ZONE & TEST PURGE ════════════ */}
          {activeTab === "danger" && (
            <div className="space-y-6 max-w-2xl">
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#141B47]">
                  <Shield size={18} className="text-amber-600" />
                  Protected Production Architecture
                </div>
                <p className="leading-relaxed text-[#475569]">
                  LMX8 Ctrl Room prevents accidental database wipes. Financial transaction records, audit logs, and verified accounting events are immutable and cannot be destroyed through the web interface.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-red-200 shadow-xs space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#141B47]">Purge Test &amp; Staging Records</h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Cleans up only records explicitly marked as test data (e.g. tracking numbers starting with <code>TEST-</code> or descriptions containing <code>[TEST]</code>).
                    </p>
                  </div>
                </div>

                {testPurgeError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                    {testPurgeError}
                  </div>
                )}

                {testPurgeResult && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 space-y-1">
                    <p>✓ Test data purge completed successfully!</p>
                    <p className="text-[11px] font-normal">
                      Deleted {testPurgeResult.deletedShipmentsCount} test shipment(s) and {testPurgeResult.deletedBatchesCount} test batch(es).
                    </p>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236]">
                      Type <strong>DELETE TEST DATA</strong> to confirm:
                    </label>
                    <input
                      type="text"
                      value={testPurgeText}
                      onChange={(e) => setTestPurgeText(e.target.value)}
                      placeholder="DELETE TEST DATA"
                      className="w-full px-4 h-11 rounded-xl text-xs font-mono font-bold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#172236] flex items-center gap-1.5">
                      <Lock size={13} /> Administrator Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={testPurgePin}
                      onChange={(e) => setTestPurgePin(e.target.value)}
                      placeholder="Enter Admin PIN"
                      className="w-full px-4 h-11 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleRunTestPurge}
                    disabled={testPurgeText !== "DELETE TEST DATA" || !testPurgePin || isPurging}
                    className="w-full h-11 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {isPurging ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Purging Test Records...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Execute Test Data Purge</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RECORD DETAIL & RELATIONSHIP INSPECTION DRAWER ── */}
      <AdminDrawer
        isOpen={!!selectedEntity}
        onClose={() => setSelectedEntity(null)}
        title={`${selectedEntity?.type ?? "Record"} Inspection`}
        description={`Inspect relationships, dependencies, and audit status for ${selectedEntity?.id ?? ""}.`}
        icon={<Database size={20} />}
        widthClassName="sm:max-w-lg md:max-w-xl"
        footer={
          <div className="flex items-center justify-between w-full">
            {selectedEntity?.type === "Shipment" && (
              <Link href={`/admin/shipments/${selectedEntity.id}`}>
                <button className="px-4 py-2 text-xs font-bold text-[#355DAF] hover:text-[#141B47] flex items-center gap-1 cursor-pointer">
                  Open Shipment Page <ArrowRight size={13} />
                </button>
              </Link>
            )}
            <button
              onClick={() => setSelectedEntity(null)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors ml-auto cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {loadingDetails ? (
          <div className="py-20 text-center text-xs text-[#667085]">
            <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Inspecting real-time relationships...
          </div>
        ) : !entityDetails ? (
          <div className="py-12 text-center text-xs text-[#667085]">Unable to load entity dependencies.</div>
        ) : (
          <div className="space-y-6">
            {/* Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-bold text-[#141B47] uppercase tracking-wider">Entity Identity</p>
              <p className="font-mono font-bold text-base text-[#141B47]">
                {entityDetails.trackingNumber || entityDetails.batchNumber || entityDetails.customerIdentifier || entityDetails.id}
              </p>
              {entityDetails.description && (
                <p className="text-xs text-[#667085] leading-relaxed">{entityDetails.description}</p>
              )}
            </div>

            {/* Warnings if any */}
            {entityDetails.warnings?.map((w: string, idx: number) => (
              <div key={idx} className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span className="leading-relaxed">{w}</span>
              </div>
            ))}

            {/* Live Relationship Counts */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#141B47]">Discovered Relationships</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(entityDetails.relationships || {}).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-xl bg-white border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      {k.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="text-base font-bold font-mono text-[#141B47] mt-0.5">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions for this entity */}
            <div className="pt-4 border-t border-[#F1F5F9] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#141B47]">Available Actions</h4>
              <div className="flex flex-wrap gap-2">
                {selectedEntity?.type === "Customer" && (
                  <button
                    onClick={() => handleToggleCustomerStatus(entityDetails.id)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserX size={14} /> Toggle Active / Deactivate
                  </button>
                )}

                {entityDetails.canDelete ? (
                  <button
                    onClick={() => {
                      setRecordToDelete({
                        type: selectedEntity?.type || "",
                        id: entityDetails.trackingNumber || entityDetails.batchNumber || entityDetails.customerIdentifier || entityDetails.id,
                        name: entityDetails.trackingNumber || entityDetails.name || entityDetails.customerIdentifier || entityDetails.id,
                      });
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={14} /> Delete Record Safely...
                  </button>
                ) : (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-[#667085] w-full">
                    Direct deletion blocked because dependencies or accounting records exist.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AdminDrawer>

      {/* ── PRE-DELETION CONFIRMATION MODAL ── */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-[#E5E7EB] space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#141B47]">Delete {recordToDelete.type} Record</h3>
                  <p className="text-xs text-[#667085] font-mono mt-0.5">{recordToDelete.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRecordToDelete(null)}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#141B47] hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50/60 border border-red-100 text-xs text-red-800 leading-relaxed space-y-1">
              <p className="font-bold">Controlled Administrative Deletion</p>
              <p className="text-[11px]">
                This will delete the primary database record and safely clean up dependent child records (tracking events, private photos). Financial payment records will be preserved.
              </p>
            </div>

            {deleteError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {deleteError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236]">
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 h-11 rounded-xl text-xs font-mono font-bold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236] flex items-center gap-1.5">
                  <Lock size={13} /> Admin PIN (Optional / Extra Safeguard)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="Enter PIN if required"
                  className="w-full px-4 h-11 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecordToDelete(null);
                    setDeleteError(null);
                    setDeleteConfirmationText("");
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmationText.trim().toUpperCase() !== "DELETE" || isDeleting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
