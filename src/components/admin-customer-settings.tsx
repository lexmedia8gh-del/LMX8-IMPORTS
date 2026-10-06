"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import {
  Users, Search, UserPlus, Edit3, Key, Shield, ShieldAlert, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Check, X, Phone, Mail, Lock, UserX, UserCheck
} from "lucide-react";
import { AdminDrawer } from "@/components/admin-drawer";
import { CreateCustomerDrawer } from "@/components/drawers/create-customer-drawer";
import {
  getAdminCustomersAction,
  updateCustomerAction,
  resetCustomerPinAction,
  toggleCustomerStatusAction,
} from "@/app/actions/customers";

interface CustomerRecord {
  id: string;
  customerIdentifier: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  credits: number;
  shipmentsCount: number;
  paymentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminCustomerSettings() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Create Customer Drawer State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Edit Customer Drawer State
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    phone: string;
    email: string;
    status: string;
  }>({
    name: "",
    phone: "",
    email: "",
    status: "ACTIVE",
  });

  // PIN Reset Subform State
  const [showPinReset, setShowPinReset] = useState<boolean>(false);
  const [pinForm, setPinForm] = useState<{ newPin: string; confirmPin: string }>({
    newPin: "",
    confirmPin: "",
  });
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinErrorSuccess] = useState<string | null>(null);
  const [isPinSubmitting, setIsPinSubmitting] = useState<boolean>(false);

  // Deactivation Confirmation Modal State
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<"ACTIVE" | "INACTIVE" | null>(null);

  // Form Submission Feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCustomersAction();
      setCustomers(data);
    } catch (e) {
      console.error("[AdminCustomerSettings] Error loading customers:", e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Filter Customers
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.customerIdentifier.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }, [customers, search]);

  // Open Edit Drawer
  const handleOpenEdit = (customer: CustomerRecord) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone === "N/A" ? "" : customer.phone,
      email: customer.email === "N/A" ? "" : customer.email,
      status: customer.status,
    });
    setFormError(null);
    setShowPinReset(false);
    setPinForm({ newPin: "", confirmPin: "" });
    setPinError(null);
    setPinErrorSuccess(null);
    setStatusConfirmTarget(null);
  };

  // Close Edit Drawer
  const handleCloseEdit = () => {
    setEditingCustomer(null);
    setFormError(null);
    setShowPinReset(false);
    setPinForm({ newPin: "", confirmPin: "" });
    setPinError(null);
    setPinErrorSuccess(null);
    setStatusConfirmTarget(null);
  };

  // Detect dirty form
  const isDirty = useMemo(() => {
    if (!editingCustomer) return false;
    const initialPhone = editingCustomer.phone === "N/A" ? "" : editingCustomer.phone;
    const initialEmail = editingCustomer.email === "N/A" ? "" : editingCustomer.email;
    return (
      editForm.name !== editingCustomer.name ||
      editForm.phone !== initialPhone ||
      editForm.email !== initialEmail ||
      editForm.status !== editingCustomer.status ||
      pinForm.newPin.length > 0 ||
      pinForm.confirmPin.length > 0
    );
  }, [editingCustomer, editForm, pinForm]);

  // Handle Main Form Save
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    // Check if status is changing to INACTIVE without prior confirmation
    if (editForm.status === "INACTIVE" && editingCustomer.status === "ACTIVE" && !statusConfirmTarget) {
      setStatusConfirmTarget("INACTIVE");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await updateCustomerAction({
        customerId: editingCustomer.id,
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email,
        status: editForm.status,
      });

      if (res?.error) {
        setFormError(res.error);
        setIsSubmitting(false);
      } else {
        showToast(res.message || "Customer updated successfully.");
        setIsSubmitting(false);
        handleCloseEdit();
        loadCustomers();
      }
    } catch (err: any) {
      setFormError(err?.message || "Unable to update customer.");
      setIsSubmitting(false);
    }
  };

  // Handle PIN Reset Submission
  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setPinError(null);
    setPinErrorSuccess(null);
    setIsPinSubmitting(true);

    try {
      const res = await resetCustomerPinAction({
        customerId: editingCustomer.id,
        newPin: pinForm.newPin,
        confirmPin: pinForm.confirmPin,
      });

      if (res?.error) {
        setPinError(res.error);
        setIsPinSubmitting(false);
      } else {
        setPinErrorSuccess("PIN changed successfully.");
        setPinForm({ newPin: "", confirmPin: "" });
        setIsPinSubmitting(false);
        setTimeout(() => {
          setShowPinReset(false);
          setPinErrorSuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      setPinError(err?.message || "Unable to reset PIN.");
      setIsPinSubmitting(false);
    }
  };

  // Handle Quick Toggle Status Action
  const handleQuickToggleStatus = async (customer: CustomerRecord) => {
    const targetStatus = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startTransition(async () => {
      const res = await toggleCustomerStatusAction(customer.id, targetStatus);
      if (res?.success) {
        showToast(res.message);
        loadCustomers();
        if (editingCustomer && editingCustomer.id === customer.id) {
          setEditForm((prev) => ({ ...prev, status: targetStatus }));
          setEditingCustomer((prev) => (prev ? { ...prev, status: targetStatus } : null));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#141B47] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-[#F2901F]" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-xl font-bold text-[#141B47]">Customers</h2>
          <p className="text-xs text-[#667085] mt-0.5">View and edit customer accounts.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadCustomers}
            className="px-3.5 h-10 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#141B47] flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
            title="Refresh customer list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 h-10 rounded-xl text-xs font-bold bg-[#F2901F] hover:bg-[#F2901F]/90 text-white flex items-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <UserPlus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-[#F7F9FC] focus:bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] transition-colors"
        />
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
      </div>

      {/* ── DESKTOP CUSTOMER TABLE (>= md) ── */}
      <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Customer ID</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Name</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Phone</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Email</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Status</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                  <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading customers...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[#667085]">
                  No customers found.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-4 font-mono font-bold text-xs text-[#141B47]">
                    <span className="px-2.5 py-1 rounded-md bg-[#F1F5F9] border border-[#E5E7EB]">
                      {c.customerIdentifier}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-[#172236]">
                    {c.name}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#667085]">
                    {c.phone}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#667085]">
                    {c.email}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {c.status === "ACTIVE" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-[#141B47] hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 size={13} /> Edit Customer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CUSTOMER CARDS (< md) ── */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#667085]">
            <RefreshCw className="animate-spin inline-block mr-2" size={16} /> Loading customers...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#667085] bg-gray-50 rounded-2xl border border-[#E5E7EB]">
            No customers found.
          </div>
        ) : (
          filteredCustomers.map((c) => (
            <div key={c.id} className="p-4 rounded-2xl border border-[#E5E7EB] bg-white space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono font-bold text-xs text-[#141B47] px-2 py-0.5 rounded bg-[#F1F5F9] border border-[#E5E7EB] inline-block">
                    {c.customerIdentifier}
                  </span>
                  <h3 className="font-bold text-sm text-[#172236] mt-2">{c.name}</h3>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                    c.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {c.status}
                </span>
              </div>

              <div className="space-y-1 text-xs text-[#667085] pt-2 border-t border-[#F1F5F9]">
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-[#94A3B8]" /> {c.phone}
                </p>
                <p className="flex items-center gap-2 truncate">
                  <Mail size={13} className="text-[#94A3B8]" /> <span className="truncate">{c.email}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#667085]">
                  {c.shipmentsCount} shipment(s) · {c.credits} credit(s)
                </span>
                <button
                  onClick={() => handleOpenEdit(c)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Edit3 size={13} /> Edit Customer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── CREATE CUSTOMER DRAWER ── */}
      <CreateCustomerDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          showToast("Customer created successfully.");
          loadCustomers();
        }}
      />

      {/* ── EDIT CUSTOMER DRAWER (REUSABLE AdminDrawer) ── */}
      {editingCustomer && (
        <AdminDrawer
          isOpen={!!editingCustomer}
          onClose={handleCloseEdit}
          title="Edit Customer"
          description="Update customer details, status, or security PIN."
          icon={<Users size={20} />}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-gray-100 text-gray-800 border border-gray-200">
              {editingCustomer.customerIdentifier}
            </span>
          }
          widthClassName="sm:max-w-lg md:max-w-xl"
          isDirty={isDirty}
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-customer-form"
                disabled={isSubmitting || !isDirty}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          }
        >
          <form id="edit-customer-form" onSubmit={handleSaveCustomer} className="space-y-6">
            {/* Error Banner */}
            {formError && (
              <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Read-Only Customer ID */}
            <div className="space-y-1.5 p-3.5 bg-[#F7F9FC] rounded-xl border border-[#E5E7EB]">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#667085] block">
                Customer ID (Read Only)
              </label>
              <p className="text-sm font-mono font-bold text-[#141B47]">
                {editingCustomer.customerIdentifier}
              </p>
              <p className="text-[11px] text-[#94A3B8]">
                Customer ID is permanent and referenced across shipments, payments, and audit logs.
              </p>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 024XXXXXXX"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full h-11 px-4 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
                Email Address
              </label>
              <input
                type="email"
                placeholder="customer@example.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full h-11 px-4 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
            </div>

            {/* Account Status Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
                Account Status
              </label>
              <select
                value={editForm.status}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditForm({ ...editForm, status: val });
                  if (val === "INACTIVE" && editingCustomer.status === "ACTIVE") {
                    setStatusConfirmTarget("INACTIVE");
                  } else {
                    setStatusConfirmTarget(null);
                  }
                }}
                className="w-full h-11 px-4 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] cursor-pointer"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Status Warning Banner if deactivating */}
            {statusConfirmTarget === "INACTIVE" && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <UserX size={16} className="text-amber-700 shrink-0" /> Deactivate Customer?
                </div>
                <p className="leading-relaxed text-[11px]">
                  {editingCustomer.name} will not be able to log in to the portal. Existing shipments, payments, and records remain intact.
                </p>
              </div>
            )}

            {/* ── SECURITY SECTION (PIN RESET) ── */}
            <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
                    <Shield size={14} className="text-[#F2901F]" /> Security &amp; PIN
                  </h3>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    Customer PINs are stored securely hashed with bcrypt and cannot be displayed in plaintext.
                  </p>
                </div>
                {!showPinReset && (
                  <button
                    type="button"
                    onClick={() => setShowPinReset(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-[#F7F9FC] text-[#141B47] hover:bg-gray-200 transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Key size={13} /> Reset PIN
                  </button>
                )}
              </div>

              {/* Inline PIN Reset Sub-form */}
              {showPinReset && (
                <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB] space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
                    <span className="text-xs font-bold text-[#141B47]">Reset Customer PIN</span>
                    <button
                      type="button"
                      onClick={() => setShowPinReset(false)}
                      className="text-[#667085] hover:text-[#141B47] cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {pinError && (
                    <div className="p-3 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                      {pinError}
                    </div>
                  )}

                  {pinSuccess && (
                    <div className="p-3 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>{pinSuccess}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#667085] block">
                        New PIN (6-8 digits)
                      </label>
                      <input
                        type="password"
                        placeholder="••••••"
                        maxLength={8}
                        value={pinForm.newPin}
                        onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#667085] block">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        placeholder="••••••"
                        maxLength={8}
                        value={pinForm.confirmPin}
                        onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl text-xs font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPinReset(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#667085] hover:text-[#172236] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleResetPinSubmit}
                      disabled={isPinSubmitting || !pinForm.newPin || !pinForm.confirmPin}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isPinSubmitting ? "Updating PIN..." : "Update PIN"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </AdminDrawer>
      )}
    </div>
  );
}
