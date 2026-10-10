"use client";

import React, { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import {
  Users, Search, UserPlus, Edit3, Key, Shield, ShieldAlert, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, Check, X, Phone, Mail, Lock, UserX, UserCheck,
  Send, MessageSquare, ExternalLink, Copy
} from "lucide-react";
import { AdminDrawer } from "@/components/admin-drawer";
import { CreateCustomerDrawer } from "@/components/drawers/create-customer-drawer";
import {
  getAdminCustomersAction,
  updateCustomerAction,
  resetCustomerPinAction,
  toggleCustomerStatusAction,
  sendCustomerCredentialsEmailAction,
  prepareCustomerWhatsAppMessageAction,
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

  // Credential Delivery State & PIN inclusion
  const [credentialDeliveryPin, setCredentialDeliveryPin] = useState<string>("");
  const [notifyViaEmailOnReset, setNotifyViaEmailOnReset] = useState<boolean>(true);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const [emailModal, setEmailModal] = useState<{
    open: boolean;
    customer: CustomerRecord | null;
    email: string;
    pinInput: string;
    sending: boolean;
    error: string | null;
  }>({
    open: false,
    customer: null,
    email: "",
    pinInput: "",
    sending: false,
    error: null,
  });

  const [whatsAppModal, setWhatsAppModal] = useState<{
    open: boolean;
    customer: CustomerRecord | null;
    phone: string;
    whatsappUrl: string;
    messageText: string;
    loading: boolean;
    error: string | null;
    pinInput?: string;
  }>({
    open: false,
    customer: null,
    phone: "",
    whatsappUrl: "",
    messageText: "",
    loading: false,
    error: null,
    pinInput: "",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenEmailModal = (customer: CustomerRecord, specificPin?: string) => {
    if (!customer.email || customer.email === "N/A" || !customer.email.includes("@")) {
      showToast("Cannot send email: customer has no valid email address.");
      return;
    }
    const pin = specificPin || (credentialDeliveryPin.trim() || Math.floor(100000 + Math.random() * 900000).toString());
    setEmailModal({
      open: true,
      customer,
      email: customer.email,
      pinInput: pin,
      sending: false,
      error: null,
    });
  };

  const handleSendCredentialsEmailFromModal = async () => {
    if (!emailModal.customer) return;
    const customer = emailModal.customer;
    const pinToSend = emailModal.pinInput.trim() || Math.floor(100000 + Math.random() * 900000).toString();

    setEmailModal((prev) => ({ ...prev, sending: true, error: null }));
    setSendingEmailId(customer.id);
    try {
      const res = await sendCustomerCredentialsEmailAction(customer.id, pinToSend);
      if (res.error) {
        setEmailModal((prev) => ({ ...prev, sending: false, error: res.error || "Failed to send email." }));
        showToast(`Email delivery failed: ${res.error}`);
      } else {
        setEmailModal((prev) => ({ ...prev, sending: false, open: false }));
        setCredentialDeliveryPin(res.pin || pinToSend);
        showToast(res.message || `Credentials with Login PIN (${res.pin || pinToSend}) sent to ${customer.email}.`);
      }
    } catch (err: any) {
      setEmailModal((prev) => ({ ...prev, sending: false, error: err?.message || "Failed to send email." }));
      showToast(err?.message || "Failed to send credential email.");
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSendCredentialsEmail = (customer: CustomerRecord, specificPin?: string) => {
    handleOpenEmailModal(customer, specificPin);
  };

  const handleOpenWhatsAppReview = async (customer: CustomerRecord, specificPin?: string) => {
    if (!customer.phone || customer.phone === "N/A") {
      showToast("Cannot prepare WhatsApp: customer has no phone number.");
      return;
    }

    const pinToInclude = specificPin || (credentialDeliveryPin.trim() || Math.floor(100000 + Math.random() * 900000).toString());

    setWhatsAppModal({
      open: true,
      customer,
      phone: customer.phone,
      whatsappUrl: "",
      messageText: "",
      loading: true,
      error: null,
      pinInput: pinToInclude,
    });

    try {
      const res = await prepareCustomerWhatsAppMessageAction(customer.id, pinToInclude || undefined);
      if (res.error) {
        setWhatsAppModal((prev) => ({
          ...prev,
          loading: false,
          error: res.error || "Failed to prepare message.",
        }));
      } else {
        setWhatsAppModal({
          open: true,
          customer,
          phone: res.formattedPhone || customer.phone,
          whatsappUrl: res.whatsappUrl || "",
          messageText: res.messageText || "",
          loading: false,
          error: null,
          pinInput: res.pin || pinToInclude,
        });
      }
    } catch (err: any) {
      setWhatsAppModal((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to prepare WhatsApp message.",
      }));
    }
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
      const savedPin = pinForm.newPin;
      const res = await resetCustomerPinAction({
        customerId: editingCustomer.id,
        newPin: pinForm.newPin,
        confirmPin: pinForm.confirmPin,
        notifyCustomer: notifyViaEmailOnReset,
      });

      if (res?.error) {
        setPinError(res.error);
        setIsPinSubmitting(false);
      } else {
        setPinErrorSuccess(res.message || "PIN changed successfully.");
        setCredentialDeliveryPin(savedPin);
        setPinForm({ newPin: "", confirmPin: "" });
        setIsPinSubmitting(false);
        setTimeout(() => {
          setShowPinReset(false);
          setPinErrorSuccess(null);
        }, 2200);
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
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-[#141B47]">Customers</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#F1F5F9] text-[#141B47] border border-[#E2E8F0]">
              {customers.length}
            </span>
          </div>
          <p className="text-xs text-[#667085] mt-1">View, manage, and edit customer accounts and access credentials.</p>
        </div>

        {/* Action Buttons: Responsive 2-column grid on small mobile, flex on desktop */}
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto">
          <button
            onClick={loadCustomers}
            disabled={loading}
            className="flex-1 sm:flex-none justify-center px-4 h-11 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#141B47] flex items-center gap-2 cursor-pointer transition-colors shadow-xs disabled:opacity-60 min-h-[44px]"
            title="Refresh customer list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-[#F2901F]" : "text-[#141B47]"} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex-1 sm:flex-none justify-center px-4 h-11 sm:h-10 rounded-xl text-xs sm:text-sm font-bold bg-[#F2901F] hover:bg-[#F2901F]/90 text-white flex items-center gap-2 cursor-pointer transition-all shadow-xs min-h-[44px]"
          >
            <UserPlus size={16} /> <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Result Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Search by ID, name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] transition-colors shadow-2xs"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#172236] cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs font-semibold text-[#667085] flex items-center gap-1.5 self-start sm:self-center">
          <span>Showing <strong className="text-[#141B47]">{filteredCustomers.length}</strong> of {customers.length} customer{customers.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {/* ── DESKTOP & TABLET CUSTOMER TABLE (>= md) ── */}
      <div className="hidden md:block overflow-x-auto border border-[#E5E7EB] rounded-2xl bg-white shadow-xs">
        <table className="w-full text-left border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085] whitespace-nowrap">Customer ID</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Name</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Phone</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Email</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085] whitespace-nowrap">Status</th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085] text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-xs text-[#667085]">
                  <RefreshCw className="animate-spin inline-block mr-2 text-[#F2901F]" size={18} /> Loading customer accounts...
                </td>
              </tr>
            ) : filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-xs text-[#667085]">
                  {search ? `No customers matched "${search}".` : "No registered customers found."}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-5 py-4 font-mono font-bold text-xs text-[#141B47] whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-md bg-[#F1F5F9] border border-[#E5E7EB] inline-block tracking-wide">
                      {c.customerIdentifier}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs font-bold text-[#172236] max-w-[200px] break-words">
                    {c.name}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#475569] whitespace-nowrap">
                    {c.phone && c.phone !== "N/A" ? (
                      <a href={`tel:${c.phone}`} className="hover:underline hover:text-[#141B47] font-medium">
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#475569] max-w-[240px] break-all">
                    {c.email && c.email !== "N/A" ? (
                      <a href={`mailto:${c.email}`} className="hover:underline hover:text-[#141B47]">
                        {c.email}
                      </a>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        c.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {c.status === "ACTIVE" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.email && c.email !== "N/A" && (
                        <button
                          type="button"
                          onClick={() => handleSendCredentialsEmail(c)}
                          disabled={sendingEmailId === c.id}
                          title={`Send access email to ${c.email}`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Send size={12} className={sendingEmailId === c.id ? "animate-pulse" : ""} />
                          <span className="hidden xl:inline">{sendingEmailId === c.id ? "Sending..." : "Email"}</span>
                        </button>
                      )}

                      {c.phone && c.phone !== "N/A" && (
                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppReview(c)}
                          title={`Prepare WhatsApp access instructions for ${c.phone}`}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          <span className="hidden xl:inline">WhatsApp</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-[#141B47] hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CUSTOMER CARDS (< md) ── */}
      <div className="block md:hidden space-y-3.5">
        {loading ? (
          <div className="py-14 text-center text-xs text-[#667085] bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs">
            <RefreshCw className="animate-spin inline-block mr-2 text-[#F2901F]" size={18} /> Loading customer accounts...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-[#667085] bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs">
            <Users size={32} className="mx-auto text-gray-300 mb-2.5" />
            <p className="font-bold text-sm text-[#172236]">No customers found</p>
            <p className="text-xs text-[#667085] mt-1">
              {search ? `No customer matched your search "${search}".` : "No registered customers yet."}
            </p>
          </div>
        ) : (
          filteredCustomers.map((c) => (
            <div
              key={c.id}
              className="p-4 sm:p-5 rounded-2xl border border-[#E5E7EB] bg-white shadow-2xs space-y-3.5 transition-all hover:border-[#CBD5E1]"
            >
              {/* Card Header: Customer ID Badge & Status */}
              <div className="flex items-start justify-between gap-2.5">
                <span className="font-mono font-bold text-xs text-[#141B47] px-2.5 py-1 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] tracking-wide shrink-0 whitespace-nowrap">
                  {c.customerIdentifier}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                    c.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {c.status === "ACTIVE" ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                  {c.status}
                </span>
              </div>

              {/* Customer Name */}
              <div>
                <h3 className="font-bold text-base text-[#172236] leading-snug break-words">
                  {c.name}
                </h3>
              </div>

              {/* Complete Contact Details without clipping or truncation */}
              <div className="space-y-2 text-xs text-[#475569] pt-2 border-t border-[#F1F5F9]">
                <div className="flex items-start gap-2.5">
                  <Phone size={14} className="text-[#94A3B8] shrink-0 mt-0.5" />
                  {c.phone && c.phone !== "N/A" ? (
                    <a
                      href={`tel:${c.phone}`}
                      className="font-medium text-[#172236] hover:text-[#141B47] hover:underline break-all"
                    >
                      {c.phone}
                    </a>
                  ) : (
                    <span className="text-gray-400">No phone provided</span>
                  )}
                </div>
                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="text-[#94A3B8] shrink-0 mt-0.5" />
                  {c.email && c.email !== "N/A" ? (
                    <a
                      href={`mailto:${c.email}`}
                      className="font-medium text-[#172236] hover:text-[#141B47] hover:underline break-all"
                    >
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-gray-400">No email provided</span>
                  )}
                </div>
              </div>

              {/* Account Stats Summary */}
              <div className="pt-2 border-t border-[#F1F5F9] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#667085]">
                <span>{c.shipmentsCount} shipment{c.shipmentsCount === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{c.credits} credit{c.credits === 1 ? "" : "s"}</span>
                <span>•</span>
                <span>{c.paymentsCount} payment{c.paymentsCount === 1 ? "" : "s"}</span>
              </div>

              {/* Accessible Action Buttons: Touch-friendly min-h-[40px] without overflow */}
              <div className="pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2">
                {c.email && c.email !== "N/A" ? (
                  <button
                    type="button"
                    onClick={() => handleSendCredentialsEmail(c)}
                    disabled={sendingEmailId === c.id}
                    title="Send Access Email"
                    className="w-full justify-center px-2 py-2 rounded-xl text-xs font-semibold border border-blue-200 bg-blue-50/80 text-blue-700 hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[40px] disabled:opacity-50"
                  >
                    <Send size={13} className={sendingEmailId === c.id ? "animate-pulse" : ""} />
                    <span>Email</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full justify-center px-2 py-2 rounded-xl text-xs font-semibold border border-gray-100 bg-gray-50 text-gray-400 inline-flex items-center gap-1.5 min-h-[40px] cursor-not-allowed opacity-60"
                  >
                    <Mail size={13} />
                    <span>No Email</span>
                  </button>
                )}

                {c.phone && c.phone !== "N/A" ? (
                  <button
                    type="button"
                    onClick={() => handleOpenWhatsAppReview(c)}
                    title="Send WhatsApp Access"
                    className="w-full justify-center px-2 py-2 rounded-xl text-xs font-semibold border border-emerald-200 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full justify-center px-2 py-2 rounded-xl text-xs font-semibold border border-gray-100 bg-gray-50 text-gray-400 inline-flex items-center gap-1.5 min-h-[40px] cursor-not-allowed opacity-60"
                  >
                    <Phone size={13} />
                    <span>No Phone</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  className="w-full justify-center px-3 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors inline-flex items-center gap-1.5 cursor-pointer min-h-[40px] shadow-2xs"
                >
                  <Edit3 size={13} />
                  <span>Edit</span>
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

            {/* ── CREDENTIAL DELIVERY SECTION ── */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
                    <Send size={14} className="text-[#355DAF]" /> Account Credential Delivery
                  </h4>
                  <p className="text-[11px] text-[#667085] mt-0.5">
                    Deliver official portal login credentials and PIN to the customer via Email or WhatsApp.
                  </p>
                </div>
              </div>

              {/* Optional PIN inclusion input */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-[#141B47] flex items-center gap-1.5">
                    <Key size={13} className="text-[#F2901F]" /> Login PIN to Include in Outgoing Credentials
                  </label>
                  {credentialDeliveryPin ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 size={11} className="text-emerald-600" /> PIN Attached
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500">
                      Optional
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Enter 6-8 digit PIN to include (e.g. 123456)..."
                  maxLength={8}
                  value={credentialDeliveryPin}
                  onChange={(e) => setCredentialDeliveryPin(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-xs font-mono tracking-wider border border-[#E5E7EB] bg-slate-50/70 focus:bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                />
                <p className="text-[10px] text-[#667085]">
                  {credentialDeliveryPin
                    ? "✓ Both Email and WhatsApp delivery will include this specific Login PIN for the client."
                    : "Tip: If left blank, general sign-in instructions will be delivered."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Email Delivery */}
                <button
                  type="button"
                  onClick={() => handleSendCredentialsEmail(editingCustomer)}
                  disabled={sendingEmailId === editingCustomer.id || !editingCustomer.email || editingCustomer.email === "N/A"}
                  className="p-3 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-left transition-all flex flex-col justify-between gap-2 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Mail size={13} /> Email Credentials
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      Brevo
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate w-full">
                    {editingCustomer.email && editingCustomer.email !== "N/A"
                      ? editingCustomer.email
                      : "No verified email configured"}
                  </p>
                  <span className="text-[11px] font-bold text-blue-700">
                    {sendingEmailId === editingCustomer.id ? "Sending Email..." : "Send Email Now →"}
                  </span>
                </button>

                {/* WhatsApp Delivery */}
                <button
                  type="button"
                  onClick={() => handleOpenWhatsAppReview(editingCustomer)}
                  disabled={!editingCustomer.phone || editingCustomer.phone === "N/A"}
                  className="p-3 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-left transition-all flex flex-col justify-between gap-2 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <MessageSquare size={13} /> WhatsApp Message
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      wa.me
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate w-full">
                    {editingCustomer.phone && editingCustomer.phone !== "N/A"
                      ? editingCustomer.phone
                      : "No phone number configured"}
                  </p>
                  <span className="text-[11px] font-bold text-emerald-700">
                    Review &amp; Open WhatsApp →
                  </span>
                </button>
              </div>
            </div>

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

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-[#141B47] select-none pt-1">
                    <input
                      type="checkbox"
                      checked={notifyViaEmailOnReset}
                      onChange={(e) => setNotifyViaEmailOnReset(e.target.checked)}
                      className="rounded text-[#F2901F] focus:ring-[#F2901F] w-4 h-4 cursor-pointer"
                    />
                    <span>Automatically send credentials email with this new Login PIN to customer</span>
                  </label>

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

      {/* ── EMAIL CREDENTIALS REVIEW MODAL ── */}
      {emailModal.open && emailModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E5E7EB] relative animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#355DAF] flex items-center justify-center shrink-0 border border-blue-200">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#141B47]">Email Account Credentials</h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Send portal access details &amp; Login PIN to {emailModal.customer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {emailModal.error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200">
                {emailModal.error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Customer ID</span>
                  <span className="font-mono font-bold text-[#141B47] text-sm">{emailModal.customer.customerIdentifier}</span>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Recipient Email</span>
                  <span className="font-semibold text-[#141B47] text-xs truncate block" title={emailModal.email}>{emailModal.email}</span>
                </div>
              </div>

              {/* PIN Inclusion in Email */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/80 to-amber-50/50 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#141B47] flex items-center gap-1.5">
                    <Key size={14} className="text-[#F2901F]" /> Login PIN to Deliver to Customer
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(100000 + Math.random() * 900000).toString();
                      setEmailModal((prev) => ({ ...prev, pinInput: rand }));
                      setCredentialDeliveryPin(rand);
                    }}
                    className="text-[11px] font-bold text-[#355DAF] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ⚡ Generate New PIN
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={emailModal.pinInput}
                    onChange={(e) => setEmailModal((prev) => ({ ...prev, pinInput: e.target.value }))}
                    placeholder="Enter 6-digit PIN..."
                    className="w-full h-10 px-3 rounded-xl text-sm font-mono tracking-widest font-bold border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] text-center shadow-2xs"
                  />
                </div>

                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  ✓ The outgoing email will prominently display this <strong>Login PIN</strong> in a secure credentials badge, allowing the client to log in immediately.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-[#475569] space-y-1">
                <p className="font-semibold text-[#141B47]">What the client receives:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[#64748B]">
                  <li>Customer Identifier ({emailModal.customer.customerIdentifier})</li>
                  <li>Login PIN ({emailModal.pinInput || "6-digit PIN"})</li>
                  <li>Direct portal URL with step-by-step sign-in guide</li>
                </ul>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEmailModal((prev) => ({ ...prev, open: false }))}
                  disabled={emailModal.sending}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendCredentialsEmailFromModal}
                  disabled={emailModal.sending || !emailModal.pinInput.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] hover:bg-[#355DAF] text-white transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 text-center"
                >
                  {emailModal.sending ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Sending Email with PIN...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Send Credentials Email Now
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP ACCESS REVIEW MODAL ── */}
      {whatsAppModal.open && whatsAppModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#E5E7EB] relative animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#141B47]">WhatsApp Access Delivery</h3>
                  <p className="text-xs text-[#667085] mt-0.5">
                    Review account access instructions for {whatsAppModal.customer.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {whatsAppModal.loading ? (
              <div className="py-10 text-center text-xs text-[#667085]">
                <RefreshCw size={18} className="animate-spin inline-block mr-2" />
                Preparing WhatsApp access message...
              </div>
            ) : whatsAppModal.error ? (
              <div className="p-4 rounded-xl bg-red-50 text-red-800 text-xs border border-red-200">
                {whatsAppModal.error}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Customer ID</span>
                    <span className="font-mono font-bold text-[#141B47] text-sm">{whatsAppModal.customer.customerIdentifier}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <span className="text-[10px] uppercase font-bold text-gray-500 block">Verified Phone</span>
                    <span className="font-semibold text-[#141B47] text-xs">{whatsAppModal.phone}</span>
                  </div>
                </div>

                {/* PIN Inclusion in WhatsApp message */}
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                      <Key size={12} className="text-[#F2901F]" /> PIN to Include in WhatsApp Message
                    </label>
                    {whatsAppModal.pinInput ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                        PIN Included
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500">Optional</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter 6-8 digit PIN..."
                      maxLength={8}
                      value={whatsAppModal.pinInput || ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setWhatsAppModal((prev) => ({ ...prev, pinInput: val }));
                        setCredentialDeliveryPin(val);
                        if (whatsAppModal.customer) {
                          const res = await prepareCustomerWhatsAppMessageAction(whatsAppModal.customer.id, val || undefined);
                          if (res.success && res.messageText && res.whatsappUrl) {
                            setWhatsAppModal((prev) => ({
                              ...prev,
                              messageText: res.messageText!,
                              whatsappUrl: res.whatsappUrl!,
                            }));
                          }
                        }
                      }}
                      className="w-full h-9 px-3 rounded-lg text-xs font-mono tracking-wider border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-[#172236]">Message Preview</label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(whatsAppModal.messageText);
                        showToast("Message copied to clipboard!");
                      }}
                      className="text-[#355DAF] hover:underline flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                    >
                      <Copy size={12} /> Copy Text
                    </button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] font-sans text-xs text-[#1E293B] whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto">
                    {whatsAppModal.messageText}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                  <strong>Access Security:</strong> When the PIN is included, the client can sign in right away. Clients can change their PIN anytime in the portal under My Profile &gt; Change PIN.
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setWhatsAppModal((prev) => ({ ...prev, open: false }))}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <a
                    href={whatsAppModal.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      showToast("Opening WhatsApp with credentials message...");
                      setWhatsAppModal((prev) => ({ ...prev, open: false }));
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#10B981] hover:bg-[#059669] text-white transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs text-center"
                  >
                    <MessageSquare size={14} /> Open in WhatsApp
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
