"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { 
  Database, Truck, Layers, Users, Clock, Bell, Shield, 
  AlertTriangle, Trash2, Eye, RefreshCw, Search, CheckCircle2, 
  X, Lock, ShieldAlert, ArrowRight, UserX, UserCheck, ChevronDown,
  CheckSquare, Square, Pencil
} from "lucide-react";
import { AdminDrawer } from "@/components/admin-drawer";
import { 
  getDatabaseOverviewAction,
  getDataRecordsAction,
  getRecordRelationshipsAction,
  updateDataRecordAction,
  deleteShipmentSafeAction,
  deleteBatchSafeAction,
  deleteCustomerSafeAction,
  deactivateCustomerSafeAction,
  bulkDeactivateCustomersAction,
  deleteTrackingEventSafeAction,
  deleteNotificationSafeAction,
  deletePaymentSafeAction,
  cleanupTestDataAction,
  deleteSelectedDataRecordsAction,
  getOperationalResetPreviewAction,
  executeOperationalResetAction,
  getResetAuditHistoryAction,
} from "@/app/actions/data-management";
import {
  SUPPORTED_RESET_CATEGORIES,
  ResetCategoryId,
  DatabaseOverviewResult,
  DataRecordsResult,
  OperationalResetPreviewResult,
} from "@/lib/data-management-types";
import Link from "next/link";

type TabType = "shipments" | "batches" | "customers" | "events" | "payments" | "notifications" | "danger";

export default function AdminDataManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>("shipments");
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [records, setRecords] = useState<any[]>([]);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Record Editing State
  const [recordToEdit, setRecordToEdit] = useState<{ type: string; id: string; data: any } | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Detail Drawer State
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);
  const [entityDetails, setEntityDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // Single Deletion Modal State
  const [recordToDelete, setRecordToDelete] = useState<{ type: string; id: string; name: string } | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>("");
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [bulkConfirmationText, setBulkConfirmationText] = useState<string>("");
  const [bulkAdminPin, setBulkAdminPin] = useState<string>("");
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [isBulkDeactivating, setIsBulkDeactivating] = useState<boolean>(false);

  // Blocked Customer Deactivation State
  const [deleteBlockedCustomerInfo, setDeleteBlockedCustomerInfo] = useState<{
    canDeactivate: boolean;
    customerId?: string;
    customerIdentifier?: string;
    blockedCustomerIds?: string[];
    blockedCustomerIdentifiers?: string[];
  } | null>(null);
  const [isDeactivatingBlocked, setIsDeactivatingBlocked] = useState<boolean>(false);

  // Operational Data Reset System State
  const [resetMode, setResetMode] = useState<"ALL_OPERATIONAL" | "SELECTED_CATEGORIES">("SELECTED_CATEGORIES");
  const [selectedResetCategories, setSelectedResetCategories] = useState<Set<string>>(
    new Set(["SHIPMENTS", "SOURCING_REQUESTS", "BATCHES"])
  );
  const [resetPreview, setResetPreview] = useState<OperationalResetPreviewResult | null>(null);
  const [loadingResetPreview, setLoadingResetPreview] = useState(false);
  const [resetPreviewError, setResetPreviewError] = useState<string | null>(null);
  const [resetConfirmationPhrase, setResetConfirmationPhrase] = useState("");
  const [resetAdminPin, setResetAdminPin] = useState("");
  const [isExecutingReset, setIsExecutingReset] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetHistory, setResetHistory] = useState<any[]>([]);
  const [loadingResetHistory, setLoadingResetHistory] = useState(false);

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

  const loadResetPreview = useCallback(async () => {
    setLoadingResetPreview(true);
    setResetPreviewError(null);
    try {
      const data = await getOperationalResetPreviewAction();
      if (data.success) {
        setResetPreview(data);
        setResetPreviewError(null);
      } else {
        setResetPreview(null);
        setResetPreviewError(data.error || "Failed to load reset preview");
      }
    } catch (err: any) {
      console.error("Failed to load reset preview:", err);
      setResetPreview(null);
      setResetPreviewError(err?.message || "Failed to load reset preview");
    } finally {
      setLoadingResetPreview(false);
    }
  }, []);

  const loadResetHistory = useCallback(async () => {
    setLoadingResetHistory(true);
    try {
      const data = await getResetAuditHistoryAction();
      setResetHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load reset history:", err);
      setResetHistory([]);
    } finally {
      setLoadingResetHistory(false);
    }
  }, []);

  // Load Overview & Records
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await getDatabaseOverviewAction();
      if (res.success && res.counts) {
        setOverview(res.counts);
        setOverviewError(res.error || null);
      } else {
        setOverview(res.counts || null);
        setOverviewError(res.error || "Failed to load database overview");
      }
    } catch (e: any) {
      console.error("Failed to load DB overview:", e);
      setOverviewError(e?.message || "Failed to load database overview");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async (tab: TabType) => {
    if (tab === "danger") return;
    setLoading(true);
    setRecordsError(null);
    setSelectedIds(new Set());
    try {
      const res = await getDataRecordsAction(tab);
      if (res.success) {
        setRecords(Array.isArray(res.records) ? res.records : []);
        setRecordsError(null);
      } else {
        setRecords([]);
        setRecordsError(res.error || `Failed to load ${tab} records`);
      }
    } catch (e: any) {
      console.error(`Failed to load ${tab} records:`, e);
      setRecords([]);
      setRecordsError(e?.message || `Failed to load ${tab} records`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setSearch("");
    setSelectedIds(new Set());
    if (activeTab === "danger") {
      loadResetPreview();
      loadResetHistory();
    } else {
      loadRecords(activeTab);
    }
  }, [activeTab, loadRecords, loadResetPreview, loadResetHistory]);

  // Filter Records
  const filteredRecords = useMemo(() => {
    const list = Array.isArray(records) ? records : [];
    return list.filter((r) => {
      if (!r || typeof r !== "object") return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return Object.values(r).some((v) => 
        typeof v === "string" && v.toLowerCase().includes(term)
      );
    });
  }, [records, search]);

  // Helper to get record key for selection
  const getRecordKey = useCallback((record: any): string => {
    if (activeTab === "shipments") return record.trackingNumber || record.id;
    if (activeTab === "batches") return record.batchNumber || record.id;
    if (activeTab === "customers") return record.customerIdentifier || record.id;
    if (activeTab === "payments") return record.reference || record.id;
    return record.id;
  }, [activeTab]);

  // Checkbox Selection Logic
  const handleToggleSelectRecord = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    if (filteredRecords.length === 0) return false;
    return filteredRecords.every((r) => selectedIds.has(getRecordKey(r)));
  }, [filteredRecords, selectedIds, getRecordKey]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const allKeys = new Set(filteredRecords.map((r) => getRecordKey(r)));
      setSelectedIds(allKeys);
    }
  };

  // Start editing a record
  const handleStartEdit = (type: string, record: any) => {
    setRecordToEdit({ type, id: record.id, data: record });
    setEditError(null);

    const ent = type.toLowerCase();
    if (ent === "shipment" || ent === "shipments") {
      setEditFormData({
        description: record.description || "",
        trackingNumber: record.trackingNumber || "",
        status: record.status || "SHIPMENT_CREATED",
        fee: record.fee ?? 0,
        weight: record.weight ?? "",
        quantity: record.quantity ?? "",
        batchId: record.batchId || "",
      });
    } else if (ent === "batch" || ent === "batches") {
      setEditFormData({
        batchNumber: record.batchNumber || "",
        name: record.name || "",
        description: record.description || "",
        status: record.status || "OPEN",
        departure: record.departure || "",
        arrival: record.arrival || "",
      });
    } else if (ent === "customer" || ent === "customers") {
      setEditFormData({
        name: record.name || "",
        phone: record.phone !== "N/A" ? record.phone || "" : "",
        email: record.email !== "N/A" ? record.email || "" : "",
        status: record.status || "ACTIVE",
      });
    } else if (ent === "trackingevent" || ent === "events") {
      setEditFormData({
        status: record.status || "SHIPMENT_CREATED",
        location: record.location !== "N/A" ? record.location || "" : "",
        note: record.note !== "N/A" ? record.note || "" : "",
      });
    } else if (ent === "notification" || ent === "notifications") {
      setEditFormData({
        title: record.title || "",
        message: record.message || "",
        read: Boolean(record.read),
      });
    } else if (ent === "payment" || ent === "payments") {
      setEditFormData({
        amount: record.amount ?? 0,
        status: record.status || "PENDING",
        currency: record.currency || "GHS",
        provider: record.provider || "PAYSTACK",
      });
    }
  };

  // Save record changes
  const handleSaveEdit = async () => {
    if (!recordToEdit) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const res = await updateDataRecordAction(recordToEdit.type, recordToEdit.id, editFormData);
      if (res?.error) {
        setEditError(res.error);
      } else {
        showToast(`✓ ${recordToEdit.type} record updated successfully.`);
        setRecordToEdit(null);
        setEditFormData({});
        loadOverview();
        if (activeTab !== "danger") loadRecords(activeTab);
        if (selectedEntity) handleOpenDetails(selectedEntity.type, selectedEntity.id);
      }
    } catch (err: any) {
      setEditError(err?.message || "Failed to update record.");
    } finally {
      setIsSavingEdit(false);
    }
  };

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

  // Execute Single Deletion
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
      } else if (recordToDelete.type === "Payment") {
        res = await deletePaymentSafeAction(recordToDelete.id, deleteConfirmationText, adminPinInput || undefined);
      }

      if (res?.error) {
        setDeleteError(res.error);
        if (res.canDeactivate) {
          setDeleteBlockedCustomerInfo({
            canDeactivate: true,
            customerId: res.customerId || recordToDelete.id,
            customerIdentifier: res.customerIdentifier || recordToDelete.name,
          });
        } else {
          setDeleteBlockedCustomerInfo(null);
        }
        setIsDeleting(false);
      } else {
        showToast(`✓ ${recordToDelete.type} record (${recordToDelete.name}) safely deleted.`);
        setRecordToDelete(null);
        setDeleteConfirmationText("");
        setAdminPinInput("");
        setDeleteError(null);
        setDeleteBlockedCustomerInfo(null);
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

  // Execute Bulk Reset / Delete Selected
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0 || activeTab === "danger") return;
    setBulkDeleteError(null);
    setIsBulkDeleting(true);

    try {
      const recordIdsArray = Array.from(selectedIds);
      const res = await deleteSelectedDataRecordsAction(
        activeTab as "shipments" | "batches" | "customers" | "events" | "notifications" | "payments",
        recordIdsArray,
        bulkConfirmationText,
        bulkAdminPin || undefined
      );

      if (res?.error) {
        setBulkDeleteError(res.error);
        if (res.canDeactivate) {
          setDeleteBlockedCustomerInfo({
            canDeactivate: true,
            blockedCustomerIds: res.blockedCustomerIds,
            blockedCustomerIdentifiers: res.blockedCustomerIdentifiers,
          });
        } else {
          setDeleteBlockedCustomerInfo(null);
        }
        setIsBulkDeleting(false);
      } else {
        showToast(`✓ Safely reset/deleted ${res.deletedCount} selected ${activeTab} record(s).`);
        setShowBulkDeleteModal(false);
        setBulkConfirmationText("");
        setBulkAdminPin("");
        setBulkDeleteError(null);
        setDeleteBlockedCustomerInfo(null);
        setSelectedIds(new Set());
        setIsBulkDeleting(false);
        loadOverview();
        loadRecords(activeTab);
      }
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Bulk deletion execution failed.");
      setIsBulkDeleting(false);
    }
  };

  // Deactivate blocked customer(s) offered when hard delete is rejected
  const handleDeactivateBlockedCustomer = async () => {
    if (!deleteBlockedCustomerInfo) return;
    setIsDeactivatingBlocked(true);
    try {
      if (deleteBlockedCustomerInfo.customerId) {
        const res = await deactivateCustomerSafeAction(deleteBlockedCustomerInfo.customerId);
        if (res?.success) {
          showToast(`✓ Customer ${res.customerIdentifier || deleteBlockedCustomerInfo.customerId} successfully deactivated (status: ${res.status}). Financial records preserved.`);
          setRecordToDelete(null);
          setDeleteConfirmationText("");
          setAdminPinInput("");
          setDeleteError(null);
          setDeleteBlockedCustomerInfo(null);
          setSelectedEntity(null);
          loadOverview();
          loadRecords("customers");
        } else {
          setDeleteError(res?.error || "Failed to deactivate customer.");
        }
      } else if (
        deleteBlockedCustomerInfo.blockedCustomerIds &&
        deleteBlockedCustomerInfo.blockedCustomerIds.length > 0
      ) {
        const res = await bulkDeactivateCustomersAction(
          deleteBlockedCustomerInfo.blockedCustomerIds,
          "INACTIVE"
        );
        if (res?.success) {
          showToast(`✓ Successfully deactivated ${res.deactivatedCount} customer account(s). Financial records preserved.`);
          setShowBulkDeleteModal(false);
          setBulkConfirmationText("");
          setBulkAdminPin("");
          setBulkDeleteError(null);
          setDeleteBlockedCustomerInfo(null);
          setSelectedIds(new Set());
          loadOverview();
          loadRecords("customers");
        } else {
          setBulkDeleteError(res?.error || "Failed to deactivate customer accounts.");
        }
      }
    } catch (err: any) {
      showToast(err?.message || "Deactivation failed.");
    } finally {
      setIsDeactivatingBlocked(false);
    }
  };

  // Dedicated Bulk Deactivate Customers action
  const handleBulkDeactivateCustomers = async () => {
    if (selectedIds.size === 0 || activeTab !== "customers") return;
    setIsBulkDeactivating(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await bulkDeactivateCustomersAction(ids, "INACTIVE");
      if (res?.success) {
        showToast(`✓ Successfully deactivated ${res.deactivatedCount} customer(s). Financial and shipment records are preserved.`);
        setSelectedIds(new Set());
        loadOverview();
        loadRecords("customers");
      } else {
        showToast(res?.error || "Bulk customer deactivation failed.");
      }
    } catch (err: any) {
      showToast(err?.message || "Bulk customer deactivation failed.");
    } finally {
      setIsBulkDeactivating(false);
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

  // Execute Operational Data Reset
  const handleExecuteReset = async () => {
    if (resetConfirmationPhrase.trim() !== "RESET LMX8 OPERATIONAL DATA") {
      setResetError("Confirmation phrase must exactly match 'RESET LMX8 OPERATIONAL DATA'.");
      return;
    }
    if (!resetAdminPin.trim()) {
      setResetError("Administrator Security PIN is required.");
      return;
    }

    setIsExecutingReset(true);
    setResetError(null);
    setResetResult(null);

    try {
      const res = await executeOperationalResetAction({
        mode: resetMode,
        categories: resetMode === "ALL_OPERATIONAL"
          ? ["SHIPMENTS", "SOURCING_REQUESTS", "BATCHES", "CREDIT_LEDGER", "LOCAL_PAYMENTS", "EMAIL_LOGS_NOTIFICATIONS", "OPERATIONAL_AUDIT_LOGS"]
          : Array.from(selectedResetCategories),
        confirmationPhrase: resetConfirmationPhrase.trim(),
        adminPin: resetAdminPin.trim(),
      });

      if (res?.error) {
        setResetError(res.error);
      } else {
        setResetResult(res);
        showToast("Operational data reset executed successfully.");
        setResetConfirmationPhrase("");
        setResetAdminPin("");
        await Promise.all([loadOverview(), loadResetPreview(), loadResetHistory()]);
      }
    } catch (err: any) {
      setResetError(err?.message || "Operational reset execution failed.");
    } finally {
      setIsExecutingReset(false);
    }
  };

  // Execute Test Data Purge (legacy helper)
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

  const navTabs = [
    { id: "shipments" as TabType, label: "Shipments", count: overview?.shipments, icon: <Truck size={15} /> },
    { id: "batches" as TabType, label: "Batches", count: overview?.batches, icon: <Layers size={15} /> },
    { id: "customers" as TabType, label: "Customers", count: overview?.customers, icon: <Users size={15} /> },
    { id: "events" as TabType, label: "Tracking Events", count: overview?.trackingEvents, icon: <Clock size={15} /> },
    { id: "payments" as TabType, label: "Payments", count: overview?.payments, icon: <Shield size={15} /> },
    { id: "notifications" as TabType, label: "Notifications", count: overview?.notifications, icon: <Bell size={15} /> },
    { id: "danger" as TabType, label: "Operational Reset", count: null, icon: <ShieldAlert size={15} /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141B47] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-[#F2901F]" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              Admin Protected
            </span>
            <span className="text-xs text-[#667085]">Audit Logged</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#141B47]">Data Management &amp; Reset System</h1>
          <p className="text-xs sm:text-sm mt-1 text-[#667085]">
            Inspect data dependencies, search records, and execute administrator-controlled record reset.
          </p>
        </div>

        <button
          onClick={() => {
            loadOverview();
            if (activeTab !== "danger") loadRecords(activeTab);
          }}
          className="px-4 h-10 text-xs font-bold rounded-xl border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#141B47] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Data
        </button>
      </div>

      {/* Database Overview Error Alert */}
      {overviewError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Database Connectivity Notice</p>
              <p className="text-amber-800 mt-0.5">{overviewError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            className="px-3.5 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── KPI STATISTIC CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Shipments", count: overview?.shipments ?? "—", tab: "shipments" as TabType, icon: <Truck size={15} />, color: "#355DAF" },
          { label: "Batches", count: overview?.batches ?? "—", tab: "batches" as TabType, icon: <Layers size={15} />, color: "#F2901F" },
          { label: "Customers", count: overview?.customers ?? "—", tab: "customers" as TabType, icon: <Users size={15} />, color: "#10B981" },
          { label: "Events", count: overview?.trackingEvents ?? "—", tab: "events" as TabType, icon: <Clock size={15} />, color: "#8B5CF6" },
          { label: "Notifs", count: overview?.notifications ?? "—", tab: "notifications" as TabType, icon: <Bell size={15} />, color: "#EC4899" },
          { label: "Payments", count: overview?.payments ?? "—", tab: "payments" as TabType, icon: <Shield size={15} />, color: "#059669" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            onClick={() => kpi.tab && setActiveTab(kpi.tab)}
            className={`p-3.5 rounded-2xl border transition-all ${
              kpi.tab
                ? "bg-white hover:shadow-md cursor-pointer border-[#E5E7EB]"
                : "bg-[#F7F9FC] border-gray-200 cursor-default"
            } ${activeTab === kpi.tab ? "ring-2 ring-[#F2901F] bg-amber-50/20" : ""}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#667085] truncate">
                {kpi.label}
              </span>
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: kpi.color }}
              >
                {kpi.icon}
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold font-mono text-[#141B47] tabular-nums">{kpi.count}</p>
          </div>
        ))}
      </div>

      {/* ── RESPONSIVE DATA MANAGEMENT NAVIGATION (TASK 1) ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
        {/* Mobile View (< md): Mobile Category Selector & 2-Col Button Grid */}
        <div className="block md:hidden p-3 bg-[#F7F9FC] border-b border-[#E5E7EB] space-y-2.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
            Category Navigator
          </label>
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabType)}
              className="w-full h-11 pl-4 pr-10 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-[#141B47] appearance-none focus:outline-none focus:border-[#F2901F] shadow-xs cursor-pointer"
            >
              {navTabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} {t.count !== null && t.count !== undefined ? `(${t.count})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" />
          </div>

          {/* Quick Category Buttons 2-Col Grid */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {navTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center justify-between gap-1.5 border transition-all cursor-pointer ${
                  activeTab === t.id
                    ? t.id === "danger"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-[#141B47] text-white border-[#141B47]"
                    : "bg-white text-[#475569] border-[#E5E7EB] hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {t.icon} <span className="truncate">{t.label}</span>
                </span>
                {t.count !== null && t.count !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                    activeTab === t.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop/Tablet View (>= md): Segmented Tabs */}
        <div className="hidden md:flex flex-wrap border-b border-[#F1F5F9] bg-[#F7F9FC]">
          {navTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === t.id
                  ? t.id === "danger"
                    ? "border-red-600 text-red-600 bg-red-50/50"
                    : "border-[#F2901F] text-[#141B47] bg-white"
                  : "border-transparent text-[#667085] hover:text-[#141B47] hover:bg-gray-50"
              }`}
            >
              {t.icon} <span>{t.label}</span>
              {t.count !== null && t.count !== undefined && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  activeTab === t.id ? "bg-[#141B47] text-white" : "bg-gray-200 text-gray-700"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TOOLBAR & BULK RESET ACTION BAR (TASK 2) ── */}
        <div className="p-4 sm:p-6">
          {recordsError && activeTab !== "danger" && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} className="text-red-600 shrink-0" />
                <div>
                  <p className="font-bold">Database Error Loading {activeTab.toUpperCase()} Records</p>
                  <p className="text-red-700 mt-0.5">{recordsError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadRecords(activeTab)}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shrink-0"
              >
                Retry Query
              </button>
            </div>
          )}

          {activeTab !== "danger" && (
            <div className="space-y-4 mb-6">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder={`Search ${activeTab} by ID, name, status...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-[#F7F9FC] focus:bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] transition-colors"
                  />
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                </div>

                {/* Bulk Action Controls */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F1F5F9]">
                  <button
                    onClick={handleToggleSelectAll}
                    disabled={filteredRecords.length === 0}
                    className="flex items-center gap-2 px-3 h-10 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-[#141B47] hover:bg-gray-50 cursor-pointer disabled:opacity-40"
                  >
                    {isAllSelected ? (
                      <CheckSquare size={16} className="text-[#F2901F]" />
                    ) : (
                      <Square size={16} className="text-[#94A3B8]" />
                    )}
                    <span>Select All ({filteredRecords.length})</span>
                  </button>

                  {activeTab === "customers" && selectedIds.size > 0 && (
                    <button
                      onClick={handleBulkDeactivateCustomers}
                      disabled={isBulkDeactivating}
                      className="h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      title="Safely deactivate selected customers to block login while preserving historical records"
                    >
                      <UserX size={14} />
                      <span>
                        {isBulkDeactivating ? "Deactivating..." : `Deactivate Selected (${selectedIds.size})`}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    disabled={selectedIds.size === 0}
                    className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer ${
                      selectedIds.size > 0
                        ? "bg-red-600 hover:bg-red-700 text-white animate-in fade-in"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                    }`}
                  >
                    <Trash2 size={14} />
                    <span>
                      {selectedIds.size > 0 ? `Delete Selected (${selectedIds.size})` : "Delete Selected"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Selection Summary Pill */}
              {selectedIds.size > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center justify-between gap-2">
                  <span>
                    Selected <strong>{selectedIds.size}</strong> of {filteredRecords.length} displayed record(s)
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[11px] underline font-bold hover:text-red-950 cursor-pointer"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ════════════ TAB 1: SHIPMENTS ════════════ */}
          {activeTab === "shipments" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading shipments...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className={`py-12 text-center text-xs rounded-xl ${recordsError ? "text-red-700 bg-red-50 border border-red-200" : "text-[#667085] bg-gray-50"}`}>
                    {recordsError ? `Database error: ${recordsError}` : "No shipment records found."}
                  </div>
                ) : (
                  filteredRecords.map((s) => {
                    const key = getRecordKey(s);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={s.id}
                        className={`p-4 rounded-xl border bg-white space-y-3 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button
                              onClick={() => handleToggleSelectRecord(key)}
                              className="mt-0.5 text-[#141B47] cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-xs text-[#141B47]">{s.trackingNumber}</p>
                              <p className="text-xs text-[#667085] mt-0.5">{s.description}</p>
                            </div>
                          </div>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                            {s.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#F1F5F9] text-[#667085]">
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Customer</span>{s.customer}</div>
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Batch</span>{s.batch}</div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#667085]">
                            <span>{s.eventsCount} events</span> · <span>{s.photosCount} files</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails("Shipment", s.trackingNumber)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            <button
                              onClick={() => handleStartEdit("Shipment", s)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "Shipment", id: s.trackingNumber, name: s.trackingNumber })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Tracking Number", "Customer", "Batch", "Status", "Dependencies", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading shipments...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`py-12 text-center text-xs ${recordsError ? "text-red-700 bg-red-50/50 font-semibold" : "text-[#667085]"}`}>
                          {recordsError ? `Database error: ${recordsError}` : "No shipment records found."}
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((s) => {
                        const key = getRecordKey(s);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={s.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                              {s.trackingNumber}
                              <p className="text-[11px] font-sans font-normal text-[#667085] mt-0.5 truncate max-w-xs">
                                {s.description}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#172236]">
                              {s.customer}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#667085]">
                              {s.batch}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
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
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDetails("Shipment", s.trackingNumber)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={13} /> Inspect
                                </button>
                                <button
                                  onClick={() => handleStartEdit("Shipment", s)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB 2: BATCHES ════════════ */}
          {activeTab === "batches" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading batches...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-xl">No batch records found.</div>
                ) : (
                  filteredRecords.map((b) => {
                    const key = getRecordKey(b);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={b.id}
                        className={`p-4 rounded-xl border bg-white space-y-3 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => handleToggleSelectRecord(key)} className="mt-0.5 cursor-pointer">
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-xs text-[#141B47]">{b.batchNumber}</p>
                              <p className="text-xs font-semibold text-[#172236] mt-0.5">{b.name}</p>
                            </div>
                          </div>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                            {b.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#F1F5F9] text-[#667085]">
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Assigned Shipments</span>{b.shipmentsCount} shipment(s)</div>
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Schedule</span>{b.departure || "TBD"} → {b.arrival || "TBD"}</div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                          <button
                            onClick={() => handleOpenDetails("Batch", b.batchNumber)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={13} /> Inspect
                          </button>
                          <button
                            onClick={() => handleStartEdit("Batch", b)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            onClick={() => setRecordToDelete({ type: "Batch", id: b.batchNumber, name: `${b.name} (${b.batchNumber})` })}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Batch Code", "Name", "Assigned Shipments", "Status", "Schedule", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading batches...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">No batch records found.</td>
                      </tr>
                    ) : (
                      filteredRecords.map((b) => {
                        const key = getRecordKey(b);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={b.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                              {b.batchNumber}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-[#172236]">
                              {b.name}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#667085]">
                              <span className={`font-bold ${b.shipmentsCount > 0 ? "text-[#141B47]" : "text-gray-400"}`}>
                                {b.shipmentsCount} shipment(s)
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                {b.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085]">
                              {b.departure || "TBD"} → {b.arrival || "TBD"}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDetails("Batch", b.batchNumber)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={13} /> Inspect
                                </button>
                                <button
                                  onClick={() => handleStartEdit("Batch", b)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB 3: CUSTOMERS ════════════ */}
          {activeTab === "customers" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading customer records...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-xl">No customer records found.</div>
                ) : (
                  filteredRecords.map((c) => {
                    const key = getRecordKey(c);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-xl border bg-white space-y-3 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => handleToggleSelectRecord(key)} className="mt-0.5 cursor-pointer">
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-xs text-[#141B47]">{c.customerIdentifier}</p>
                              <p className="text-xs font-bold text-[#172236] mt-0.5">{c.name}</p>
                              <p className="text-[11px] text-[#667085]">{c.phone} {c.email !== "N/A" ? `· ${c.email}` : ""}</p>
                            </div>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#667085] pt-2 border-t border-[#F1F5F9]">
                          <span>{c.shipmentsCount} shipments</span> · <span>{c.paymentsCount} payments</span> · <span>{c.credits} credits</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1F5F9] flex-wrap">
                          <button
                            onClick={() => handleOpenDetails("Customer", c.customerIdentifier)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Eye size={13} /> Inspect
                          </button>
                          <button
                            onClick={() => handleStartEdit("Customer", c)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil size={13} /> Edit
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
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Customer ID", "Name", "Contact", "History Summary", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading customer records...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">No customer records found.</td>
                      </tr>
                    ) : (
                      filteredRecords.map((c) => {
                        const key = getRecordKey(c);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={c.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                              {c.customerIdentifier}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-bold text-[#172236]">
                              {c.name}
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085]">
                              {c.phone} {c.email !== "N/A" ? `· ${c.email}` : ""}
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085]">
                              <span>{c.shipmentsCount} shipments</span> · <span>{c.paymentsCount} payments</span> · <span>{c.credits} credits</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDetails("Customer", c.customerIdentifier)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={13} /> Inspect
                                </button>
                                <button
                                  onClick={() => handleStartEdit("Customer", c)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB 4: TRACKING EVENTS ════════════ */}
          {activeTab === "events" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading tracking events...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-xl">No tracking events found.</div>
                ) : (
                  filteredRecords.map((e) => {
                    const key = getRecordKey(e);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={e.id}
                        className={`p-4 rounded-xl border bg-white space-y-2.5 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => handleToggleSelectRecord(key)} className="mt-0.5 cursor-pointer">
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-xs text-[#141B47]">{e.shipmentTrackingNumber}</p>
                              <p className="text-xs text-[#172236]">{e.location}</p>
                            </div>
                          </div>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-800 border border-purple-200 shrink-0">
                            {e.status}
                          </span>
                        </div>
                        {e.note && <p className="text-[11px] text-[#667085] bg-gray-50 p-2 rounded-lg">{e.note}</p>}
                        <div className="flex items-center justify-between text-[11px] text-[#667085] pt-2 border-t border-[#F1F5F9]">
                          <span>{new Date(e.timestamp).toLocaleDateString()} {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEdit("TrackingEvent", e)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "TrackingEvent", id: e.id, name: `Event for ${e.shipmentTrackingNumber}` })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Shipment", "Checkpoint Status", "Location", "Remarks", "Timestamp", "Action"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading tracking events...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs text-[#667085]">No tracking events found.</td>
                      </tr>
                    ) : (
                      filteredRecords.map((e) => {
                        const key = getRecordKey(e);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={e.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                              {e.shipmentTrackingNumber}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-50 text-purple-800 border border-purple-200">
                                {e.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#172236]">
                              {e.location}
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085] max-w-xs truncate">
                              {e.note}
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085]">
                              {new Date(e.timestamp).toLocaleDateString()} {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleStartEdit("TrackingEvent", e)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => setRecordToDelete({ type: "TrackingEvent", id: e.id, name: `Event for ${e.shipmentTrackingNumber}` })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB 5: NOTIFICATIONS ════════════ */}
          {activeTab === "notifications" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading notifications...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-xl">No notifications found.</div>
                ) : (
                  filteredRecords.map((n) => {
                    const key = getRecordKey(n);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border bg-white space-y-2.5 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => handleToggleSelectRecord(key)} className="mt-0.5 cursor-pointer">
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-bold text-xs text-[#141B47]">{n.customerName} ({n.customerIdentifier})</p>
                              <p className="text-xs font-semibold text-[#172236] mt-0.5">{n.title}</p>
                            </div>
                          </div>
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-50 text-pink-800 border border-pink-200 shrink-0">
                            {n.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#667085] bg-gray-50 p-2 rounded-lg">{n.message}</p>
                        <div className="flex items-center justify-between text-[11px] text-[#667085] pt-2 border-t border-[#F1F5F9]">
                          <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEdit("Notification", n)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "Notification", id: n.id, name: n.title })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Customer", "Title & Content", "Type", "Created", "Action"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading notifications...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">No notifications found.</td>
                      </tr>
                    ) : (
                      filteredRecords.map((n) => {
                        const key = getRecordKey(n);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={n.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-xs text-[#141B47]">
                              {n.customerName} ({n.customerIdentifier})
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#172236] max-w-sm">
                              <p className="font-semibold">{n.title}</p>
                              <p className="text-[11px] text-[#667085] truncate mt-0.5">{n.message}</p>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-50 text-pink-800 border border-pink-200">
                                {n.type}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-[#667085]">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleStartEdit("Notification", n)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => setRecordToDelete({ type: "Notification", id: n.id, name: n.title })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB: PAYMENTS ════════════ */}
          {activeTab === "payments" && (
            <div>
              {/* Mobile Cards */}
              <div className="block md:hidden space-y-3">
                {loading ? (
                  <div className="py-12 text-center text-xs text-[#667085]">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading payments...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-xl">No payment records found.</div>
                ) : (
                  filteredRecords.map((p) => {
                    const key = getRecordKey(p);
                    const isSelected = selectedIds.has(key);
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-xl border bg-white space-y-3 shadow-xs transition-all ${
                          isSelected ? "border-red-500 ring-1 ring-red-500 bg-red-50/10" : "border-[#E5E7EB]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <button onClick={() => handleToggleSelectRecord(key)} className="mt-0.5 text-[#141B47] cursor-pointer">
                              {isSelected ? (
                                <CheckSquare size={18} className="text-red-600" />
                              ) : (
                                <Square size={18} className="text-gray-300 hover:text-gray-500" />
                              )}
                            </button>
                            <div>
                              <p className="font-mono font-bold text-xs text-[#141B47]">{p.reference}</p>
                              <p className="text-xs font-bold text-[#172236] mt-0.5">{p.customerName} ({p.customerIdentifier})</p>
                            </div>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            p.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#F1F5F9] text-[#667085]">
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Amount</span>{p.currency} {p.amount}</div>
                          <div><span className="text-[10px] uppercase font-bold text-gray-400 block">Provider / Type</span>{p.provider} · {p.type}</div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F9]">
                          <div className="text-[11px] text-[#667085]">
                            {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenDetails("Payment", p.reference)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={13} /> Inspect
                            </button>
                            <button
                              onClick={() => handleStartEdit("Payment", p)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              onClick={() => setRecordToDelete({ type: "Payment", id: p.reference, name: `${p.reference} (${p.currency} ${p.amount})` })}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 size={13} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 w-10">
                        <button onClick={handleToggleSelectAll} className="cursor-pointer">
                          {isAllSelected ? (
                            <CheckSquare size={16} className="text-red-600" />
                          ) : (
                            <Square size={16} className="text-gray-400" />
                          )}
                        </button>
                      </th>
                      {["Payment Reference", "Customer", "Amount", "Status", "Provider / Type", "Date", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs text-[#667085]">
                          <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading payments...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs text-[#667085]">No payment records found.</td>
                      </tr>
                    ) : (
                      filteredRecords.map((p) => {
                        const key = getRecordKey(p);
                        const isSelected = selectedIds.has(key);
                        return (
                          <tr key={p.id} className={`transition-colors ${isSelected ? "bg-red-50/20" : "hover:bg-gray-50/50"}`}>
                            <td className="px-4 py-3.5">
                              <button onClick={() => handleToggleSelectRecord(key)} className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={16} className="text-red-600" />
                                ) : (
                                  <Square size={16} className="text-gray-300 hover:text-gray-500" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3.5 font-mono font-bold text-xs text-[#141B47]">
                              {p.reference}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#172236]">
                              {p.customerName} ({p.customerIdentifier})
                            </td>
                            <td className="px-4 py-3.5 text-xs font-mono font-bold text-[#141B47]">
                              {p.currency} {p.amount}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                p.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#667085]">
                              {p.provider} · {p.type}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-[#667085]">
                              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "N/A"}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenDetails("Payment", p.reference)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye size={13} /> Inspect
                                </button>
                                <button
                                  onClick={() => handleStartEdit("Payment", p)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Pencil size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => setRecordToDelete({ type: "Payment", id: p.reference, name: `${p.reference} (${p.currency} ${p.amount})` })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ════════════ TAB 6: OPERATIONAL DATA RESET SYSTEM ════════════ */}
          {activeTab === "danger" && (
            <div className="space-y-7 max-w-4xl">
              {/* Architecture Protection Banner */}
              <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#141B47]">
                  <Shield size={18} className="text-amber-600" />
                  Protected Operational Infrastructure
                </div>
                <p className="leading-relaxed text-[#475569]">
                  This tool safely clears eligible operational data when transitioning between operational cycles.
                  Critical infrastructure records are <strong>strictly preserved</strong> and cannot be deleted:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-semibold text-[#141B47]">
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">✓ Admin Accounts &amp; PINs</div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">✓ Customer Accounts &amp; PINs</div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">✓ Branding &amp; Logo Assets</div>
                  <div className="bg-white/80 p-2 rounded-lg border border-amber-200/60">✓ System Settings &amp; Schema</div>
                </div>
              </div>

              {/* Mode Selection & Live Preview */}
              <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
                  <div>
                    <h3 className="font-bold text-base text-[#141B47]">Operational Reset Controls</h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Select operational scope and preview live database counts before execution.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadResetPreview}
                    disabled={loadingResetPreview}
                    className="px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-[#141B47] flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
                  >
                    <RefreshCw size={12} className={loadingResetPreview ? "animate-spin" : ""} />
                    Refresh Counts
                  </button>
                </div>

                {resetPreviewError && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">Reset Preview Notice</p>
                        <p className="text-amber-800">{resetPreviewError}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={loadResetPreview}
                      className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold rounded-lg text-xs transition-colors cursor-pointer shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Reset Mode Selector */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResetMode("SELECTED_CATEGORIES")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      resetMode === "SELECTED_CATEGORIES"
                        ? "border-brand-navy bg-blue-50/40 ring-1 ring-brand-navy"
                        : "border-[#E5E7EB] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#141B47]">Reset Selected Categories</span>
                      {resetMode === "SELECTED_CATEGORIES" && (
                        <span className="w-2 h-2 rounded-full bg-brand-navy" />
                      )}
                    </div>
                    <p className="text-xs text-[#667085]">
                      Choose specific operational models to purge (e.g. shipments or sourcing requests).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetMode("ALL_OPERATIONAL")}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      resetMode === "ALL_OPERATIONAL"
                        ? "border-red-600 bg-red-50/40 ring-1 ring-red-600"
                        : "border-[#E5E7EB] hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-red-700">Reset All Operational Data</span>
                      {resetMode === "ALL_OPERATIONAL" && (
                        <span className="w-2 h-2 rounded-full bg-red-600" />
                      )}
                    </div>
                    <p className="text-xs text-[#667085]">
                      Clear all 7 operational categories while keeping customer accounts and infrastructure intact.
                    </p>
                  </button>
                </div>

                {/* Categories Checkbox List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-[#141B47]">
                    <span>Eligible Operational Categories</span>
                    {resetMode === "SELECTED_CATEGORIES" && (
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSelectedResetCategories(new Set((Array.isArray(SUPPORTED_RESET_CATEGORIES) ? SUPPORTED_RESET_CATEGORIES : []).map((c) => c.id)))}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() => setSelectedResetCategories(new Set())}
                          className="text-gray-500 hover:underline cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {(Array.isArray(SUPPORTED_RESET_CATEGORIES) ? SUPPORTED_RESET_CATEGORIES : []).map((cat) => {
                      const isSelected = resetMode === "ALL_OPERATIONAL" || selectedResetCategories.has(cat.id);
                      const catPreview = resetPreview?.categories?.[cat.id];

                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            if (resetMode === "ALL_OPERATIONAL") return;
                            const next = new Set(selectedResetCategories);
                            if (next.has(cat.id)) next.delete(cat.id);
                            else next.add(cat.id);
                            setSelectedResetCategories(next);
                          }}
                          className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
                            resetMode === "ALL_OPERATIONAL"
                              ? "bg-red-50/20 border-red-200 opacity-90 cursor-default"
                              : isSelected
                              ? "bg-blue-50/30 border-blue-200 cursor-pointer"
                              : "bg-white border-[#E5E7EB] hover:bg-gray-50 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={resetMode === "ALL_OPERATIONAL"}
                            onChange={() => {}}
                            className="mt-0.5 rounded text-brand-navy"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-[#172236] truncate">{cat.label}</p>
                              {catPreview && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-800 font-mono">
                                  {catPreview.count}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#667085] leading-tight mt-0.5">{cat.desc}</p>
                            {catPreview?.details && (
                              <p className="text-[10px] text-brand-navy mt-1 truncate font-medium">
                                {catPreview.details}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Confirmation Box */}
                <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-700">
                    <AlertTriangle size={15} />
                    <span>Operational Deletion Authorization</span>
                  </div>

                  {resetError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                      {resetError}
                    </div>
                  )}

                  {resetResult && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                      <p className="font-bold flex items-center gap-1.5 text-sm">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        Operational Data Reset Completed Successfully!
                      </p>
                      <p className="font-mono text-[11px] text-emerald-800">
                        Operation ID: {resetResult.operationId}
                      </p>
                      {resetResult.deletedCounts && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                          {Object.entries(resetResult.deletedCounts).map(([k, v]: any) => (
                            <div key={k} className="bg-white/70 p-1.5 rounded border border-emerald-200">
                              <span className="capitalize">{k}: </span>
                              <strong className="tabular-nums">{v}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172236]">
                        Type <strong>RESET LMX8 OPERATIONAL DATA</strong> to confirm:
                      </label>
                      <input
                        type="text"
                        value={resetConfirmationPhrase}
                        onChange={(e) => setResetConfirmationPhrase(e.target.value)}
                        placeholder="RESET LMX8 OPERATIONAL DATA"
                        className="w-full px-3.5 h-10 rounded-xl text-xs font-mono font-bold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#172236] flex items-center gap-1.5">
                        <Lock size={13} /> Administrator Security PIN
                      </label>
                      <input
                        type="password"
                        maxLength={8}
                        value={resetAdminPin}
                        onChange={(e) => setResetAdminPin(e.target.value)}
                        placeholder="Enter 6-8 digit Admin PIN"
                        className="w-full px-3.5 h-10 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={
                      resetConfirmationPhrase.trim() !== "RESET LMX8 OPERATIONAL DATA" ||
                      !resetAdminPin.trim() ||
                      isExecutingReset ||
                      (resetMode === "SELECTED_CATEGORIES" && selectedResetCategories.size === 0)
                    }
                    className="w-full h-11 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {isExecutingReset ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Executing Operational Data Reset...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Execute Operational Reset ({resetMode === "ALL_OPERATIONAL" ? "All Operational Data" : `${selectedResetCategories.size} Categories`})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Permanent Reset Audit History Table */}
              <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-xs">
                <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#141B47]">Permanent Reset Audit History</h3>
                    <p className="text-xs text-[#667085]">
                      Immutable forensic log of all past operational data reset executions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadResetHistory}
                    disabled={loadingResetHistory}
                    className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} className={loadingResetHistory ? "animate-spin" : ""} /> Refresh Log
                  </button>
                </div>

                <div className="divide-y divide-[#F1F5F9] max-h-72 overflow-y-auto">
                  {(!Array.isArray(resetHistory) || resetHistory.length === 0) ? (
                    <div className="p-8 text-center text-[#667085] text-xs">
                      No operational data resets have been executed yet.
                    </div>
                  ) : (
                    resetHistory.map((audit) => {
                      const selectedCats = Array.isArray(audit?.selectedCategories) ? audit.selectedCategories : [];
                      return (
                        <div key={audit.id} className="p-4 hover:bg-gray-50/50 transition-colors space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-[#141B47]">{audit.operationId}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                audit.status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {audit.status}
                            </span>
                          </div>
                          <div className="text-[#64748B] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            <span>Admin: <strong>{audit.adminName}</strong> ({audit.adminEmail})</span>
                            <span>·</span>
                            <span>Mode: <strong className="font-mono">{audit.resetMode}</strong></span>
                            <span>·</span>
                            <span>Timestamp: <strong className="font-mono">{new Date(audit.startedAt).toLocaleString()}</strong></span>
                          </div>
                          <div className="text-[11px] text-[#475569] flex flex-wrap gap-1 pt-1">
                            {selectedCats.map((c: string) => (
                              <span key={c} className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[10px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
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
            {Array.isArray(entityDetails.warnings) && entityDetails.warnings.map((w: string, idx: number) => (
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
                <button
                  onClick={() => handleStartEdit(selectedEntity?.type || "", entityDetails)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil size={14} /> Edit Record...
                </button>

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

      {/* ── SINGLE DELETION CONFIRMATION MODAL ── */}
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
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2.5">
                <div className="font-semibold">{deleteError}</div>
                {(deleteBlockedCustomerInfo?.canDeactivate || deleteError.includes("Deactivate Customer")) && (
                  <div className="pt-2 border-t border-red-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white/60 p-2 rounded-lg">
                    <span className="text-[11px] text-red-800 font-medium">
                      Preserve historical records by safely deactivating this account.
                    </span>
                    <button
                      type="button"
                      onClick={handleDeactivateBlockedCustomer}
                      disabled={isDeactivatingBlocked}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <UserX size={13} />
                      <span>{isDeactivatingBlocked ? "Deactivating..." : "Deactivate Customer Instead"}</span>
                    </button>
                  </div>
                )}
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
                  <Lock size={13} /> Admin PIN (Optional Safeguard)
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

      {/* ── BULK RESET / DELETE SELECTED CONFIRMATION MODAL ── */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#E5E7EB] space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#141B47]">Delete Selected {activeTab} Records</h3>
                  <p className="text-xs text-red-600 font-bold mt-0.5">
                    {selectedIds.size} record(s) selected for deletion
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkDeleteError(null);
                  setBulkConfirmationText("");
                  setBulkAdminPin("");
                }}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#141B47] hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed space-y-1.5">
              <p className="font-bold">⚠️ Destructive Administrative Action</p>
              <p className="text-[11px]">
                You are about to permanently remove <strong>{selectedIds.size}</strong> selected {activeTab} record(s). Dependent items (events, photos) will be cleaned up. Financial accounting records will be preserved.
              </p>
            </div>

            {/* List of Selected Record Identifiers */}
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-[#141B47] uppercase tracking-wider">Target Records ({selectedIds.size})</p>
              <div className="max-h-32 overflow-y-auto p-3 bg-[#F7F9FC] rounded-xl border border-[#E5E7EB] space-y-1 text-xs font-mono text-[#172236]">
                {Array.from(selectedIds).map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                    <span>{id}</span>
                  </div>
                ))}
              </div>
            </div>

            {bulkDeleteError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2.5">
                <div className="font-semibold">{bulkDeleteError}</div>
                {(deleteBlockedCustomerInfo?.canDeactivate || bulkDeleteError.includes("Deactivate Customer")) && (
                  <div className="pt-2 border-t border-red-200/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white/60 p-2 rounded-lg">
                    <span className="text-[11px] text-red-800 font-medium">
                      Preserve historical records by safely deactivating these customer accounts.
                    </span>
                    <button
                      type="button"
                      onClick={handleDeactivateBlockedCustomer}
                      disabled={isDeactivatingBlocked}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <UserX size={13} />
                      <span>{isDeactivatingBlocked ? "Deactivating..." : "Deactivate Affected Accounts"}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236]">
                  Type <strong>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  value={bulkConfirmationText}
                  onChange={(e) => setBulkConfirmationText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-4 h-11 rounded-xl text-xs font-mono font-bold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#172236] flex items-center gap-1.5">
                  <Lock size={13} /> Admin PIN (Optional Safeguard)
                </label>
                <input
                  type="password"
                  maxLength={8}
                  value={bulkAdminPin}
                  onChange={(e) => setBulkAdminPin(e.target.value)}
                  placeholder="Enter PIN if required"
                  className="w-full px-4 h-11 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkDeleteModal(false);
                    setBulkDeleteError(null);
                    setBulkConfirmationText("");
                    setBulkAdminPin("");
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkDelete}
                  disabled={bulkConfirmationText.trim().toUpperCase() !== "DELETE" || isBulkDeleting}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {isBulkDeleting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={13} />
                      <span>Delete ({selectedIds.size})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD EDITING MODAL ── */}
      {recordToEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#E5E7EB] space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#141B47]">Edit {recordToEdit.type} Record</h3>
                  <p className="text-xs text-[#667085] font-mono mt-0.5">{recordToEdit.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRecordToEdit(null);
                  setEditError(null);
                }}
                className="p-1.5 rounded-lg text-[#667085] hover:text-[#141B47] hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form Fields according to entity type */}
            <div className="space-y-4">
              {(recordToEdit.type.toLowerCase() === "shipment" || recordToEdit.type.toLowerCase() === "shipments") && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Tracking Number</label>
                    <input
                      type="text"
                      value={editFormData.trackingNumber || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, trackingNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-mono font-bold focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Description</label>
                    <input
                      type="text"
                      value={editFormData.description || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Status</label>
                      <select
                        value={editFormData.status || "SHIPMENT_CREATED"}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 bg-white"
                      >
                        <option value="SHIPMENT_CREATED">Shipment Created</option>
                        <option value="PREPARING_SHIPMENT">Preparing Shipment</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="IN_TRANSIT">In Transit</option>
                        <option value="ARRIVED_AT_DESTINATION">Arrived at Destination</option>
                        <option value="CUSTOMS_CLEARANCE">Customs Clearance</option>
                        <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="ON_HOLD">On Hold</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Fee (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.fee ?? 0}
                        onChange={(e) => setEditFormData({ ...editFormData, fee: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.weight ?? ""}
                        onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Quantity</label>
                      <input
                        type="number"
                        value={editFormData.quantity ?? ""}
                        onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {(recordToEdit.type.toLowerCase() === "batch" || recordToEdit.type.toLowerCase() === "batches") && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Batch Code</label>
                    <input
                      type="text"
                      value={editFormData.batchNumber || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, batchNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-mono font-bold focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Batch Name</label>
                    <input
                      type="text"
                      value={editFormData.name || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Description</label>
                    <input
                      type="text"
                      value={editFormData.description || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Status</label>
                    <select
                      value={editFormData.status || "OPEN"}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 bg-white"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="ARRIVED">Arrived</option>
                      <option value="CLOSED">Closed</option>
                      <option value="ARCHIVED">Archived</option>
                    </select>
                  </div>
                </>
              )}

              {(recordToEdit.type.toLowerCase() === "customer" || recordToEdit.type.toLowerCase() === "customers") && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Name</label>
                    <input
                      type="text"
                      value={editFormData.name || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-bold focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editFormData.phone || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Email Address</label>
                    <input
                      type="email"
                      value={editFormData.email || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Status</label>
                    <select
                      value={editFormData.status || "ACTIVE"}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 bg-white"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                </>
              )}

              {(recordToEdit.type.toLowerCase() === "trackingevent" || recordToEdit.type.toLowerCase() === "events") && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Checkpoint Status</label>
                    <select
                      value={editFormData.status || "SHIPMENT_CREATED"}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 bg-white"
                    >
                      <option value="SHIPMENT_CREATED">Shipment Created</option>
                      <option value="PREPARING_SHIPMENT">Preparing Shipment</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="IN_TRANSIT">In Transit</option>
                      <option value="ARRIVED_AT_DESTINATION">Arrived at Destination</option>
                      <option value="CUSTOMS_CLEARANCE">Customs Clearance</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="ON_HOLD">On Hold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Location</label>
                    <input
                      type="text"
                      value={editFormData.location || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Note / Remarks</label>
                    <textarea
                      value={editFormData.note || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 h-20"
                    />
                  </div>
                </>
              )}

              {(recordToEdit.type.toLowerCase() === "notification" || recordToEdit.type.toLowerCase() === "notifications") && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Title</label>
                    <input
                      type="text"
                      value={editFormData.title || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-bold focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Message</label>
                    <textarea
                      value={editFormData.message || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, message: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 h-24"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="edit-read"
                      checked={Boolean(editFormData.read)}
                      onChange={(e) => setEditFormData({ ...editFormData, read: e.target.checked })}
                      className="rounded border-[#E5E7EB] text-amber-600 focus:ring-amber-500"
                    />
                    <label htmlFor="edit-read" className="text-xs font-medium text-[#141B47] cursor-pointer">
                      Mark as Read
                    </label>
                  </div>
                </>
              )}

              {(recordToEdit.type.toLowerCase() === "payment" || recordToEdit.type.toLowerCase() === "payments") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.amount ?? 0}
                        onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#141B47] mb-1">Currency</label>
                      <input
                        type="text"
                        value={editFormData.currency || "GHS"}
                        onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-mono focus:outline-hidden focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Payment Status</label>
                    <select
                      value={editFormData.status || "PENDING"}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500 bg-white"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="SUCCESS">Success</option>
                      <option value="FAILED">Failed</option>
                      <option value="REFUNDED">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#141B47] mb-1">Provider</label>
                    <input
                      type="text"
                      value={editFormData.provider || "PAYSTACK"}
                      onChange={(e) => setEditFormData({ ...editFormData, provider: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  setRecordToEdit(null);
                  setEditError(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Pencil size={13} />
                    <span>Save Record</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
