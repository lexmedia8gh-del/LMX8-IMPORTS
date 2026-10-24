"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  getInvoicesAction, 
  cancelInvoiceAction, 
  duplicateInvoiceAction,
  issueInvoiceAction
} from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/currency";
import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";
import { SendInvoiceModal } from "@/components/invoices/send-invoice-modal";
import { 
  Plus, Search, Filter, RefreshCw, FileText, CheckCircle2, Clock, 
  AlertTriangle, XCircle, MoreVertical, Printer, Send, CreditCard, 
  Copy, Eye, Edit, Truck, User, ArrowUpDown, ChevronLeft, ChevronRight,
  TrendingUp, DollarSign, AlertCircle, X
} from "lucide-react";

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalInvoices: 0,
    paidInvoices: 0,
    unpaidInvoices: 0,
    partiallyPaidInvoices: 0,
    overdueInvoices: 0,
    totalInvoicedAmount: 0,
    totalOutstandingBalance: 0,
  });
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Action modals
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any | null>(null);
  const [selectedInvoiceForSend, setSelectedInvoiceForSend] = useState<any | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoicesAction({
        search: search.trim() || undefined,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (res.success) {
        setInvoices(res.invoices || []);
        if (res.metrics) setMetrics(res.metrics);
        if (res.pagination) setPagination(res.pagination);
      }
    } catch (err) {
      console.error("[AdminInvoicesPage] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, startDate, endDate, pagination.page, pagination.limit]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleCancelInvoice = async (invoice: any) => {
    if (!confirm(`Are you sure you want to cancel Invoice #${invoice.invoiceNumber}?`)) return;
    setActionLoadingId(invoice.id);
    try {
      const res = await cancelInvoiceAction(invoice.id);
      if (res.success) {
        showToast(`Invoice #${invoice.invoiceNumber} has been cancelled.`);
        loadInvoices();
      } else {
        alert(res.error || "Failed to cancel invoice.");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicateInvoice = async (invoice: any) => {
    setActionLoadingId(invoice.id);
    try {
      const res = await duplicateInvoiceAction(invoice.id);
      if (res.success) {
        showToast(`Invoice duplicated successfully!`);
        loadInvoices();
      } else {
        alert(res.error || "Failed to duplicate invoice.");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleIssueInvoice = async (invoice: any) => {
    setActionLoadingId(invoice.id);
    try {
      const res = await issueInvoiceAction(invoice.id);
      if (res.success) {
        showToast(`Invoice #${invoice.invoiceNumber} is now officially issued.`);
        loadInvoices();
      } else {
        alert(res.error || "Failed to issue invoice.");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 size={12} /> Paid
          </span>
        );
      case "PARTIALLY_PAID":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock size={12} /> Partial
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertTriangle size={12} /> Overdue
          </span>
        );
      case "ISSUED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock size={12} /> Issued
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">
            <XCircle size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <FileText size={12} /> Draft
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-[#141B47] text-white text-xs font-bold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#F2901F]/15 text-[#B45309]">
              FINANCIAL DESK
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#141B47] tracking-tight mt-1">
            Invoice Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create, track, and dispatch official client invoices and cargo settlements
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadInvoices()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Invoices"
          >
            <RefreshCw size={16} className={loading ? "animate-spin text-[#141B47]" : ""} />
          </button>
          <Link
            href="/admin/invoices/new"
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-[#141B47] text-white hover:bg-[#1E2968] transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus size={16} /> Create Invoice
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Invoiced */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Invoiced</span>
            <DollarSign size={16} className="text-[#141B47]" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-[#141B47] font-mono">
            {formatCurrency(metrics.totalInvoicedAmount)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {metrics.totalInvoices} created invoices
          </p>
        </div>

        {/* Outstanding Balance */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Outstanding Balance</span>
            <TrendingUp size={16} className="text-red-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-red-600 font-mono">
            {formatCurrency(metrics.totalOutstandingBalance)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            Receivables pending settlement
          </p>
        </div>

        {/* Settled / Paid */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Paid Invoices</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
            {metrics.paidInvoices}
          </p>
          <p className="text-[11px] text-emerald-800 font-medium">
            Fully settled accounts
          </p>
        </div>

        {/* Overdue / Attention */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Overdue Invoices</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 font-mono">
            {metrics.overdueInvoices}
          </p>
          <p className="text-[11px] text-amber-800 font-medium">
            Past due date requiring followup
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice #, Client Name, ID, Phone, or Tracking #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#141B47]"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              title="Filter from date"
            />
            <span className="text-slate-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
              title="Filter to date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="p-2 text-slate-400 hover:text-slate-700 text-xs"
                title="Clear date filter"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs font-bold">
          {[
            { id: "ALL", label: "All Invoices" },
            { id: "ISSUED", label: "Issued" },
            { id: "PARTIALLY_PAID", label: "Partially Paid" },
            { id: "PAID", label: "Paid" },
            { id: "OVERDUE", label: "Overdue" },
            { id: "DRAFT", label: "Drafts" },
            { id: "CANCELLED", label: "Cancelled" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? "bg-[#141B47] text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Client</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4">Shipment</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4 text-right">Paid</th>
                <th className="py-3.5 px-4 text-right">Balance</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Dispatch</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-[#141B47] mb-2" />
                    Loading client invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center space-y-3">
                    <FileText size={32} className="mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No invoices match your criteria</p>
                    <p className="text-xs text-slate-400">Create an invoice or adjust your filter query</p>
                    <Link
                      href="/admin/invoices/new"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141B47] text-white font-bold text-xs"
                    >
                      <Plus size={14} /> New Invoice
                    </Link>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Invoice # */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/invoices/${inv.id}`}
                        className="font-mono font-bold text-slate-900 hover:text-[#141B47] hover:underline"
                      >
                        #{inv.invoiceNumber}
                      </Link>
                      {inv.purchaseOrderRef && (
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                          PO: {inv.purchaseOrderRef}
                        </p>
                      )}
                    </td>

                    {/* Client */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800">{inv.customer?.name || "Client"}</p>
                      <p className="text-[10px] font-mono text-slate-500">
                        {inv.customer?.customerIdentifier || inv.customer?.phone || "—"}
                      </p>
                    </td>

                    {/* Dates */}
                    <td className="py-3.5 px-4 text-[11px] font-mono text-slate-600 space-y-0.5">
                      <p>Iss: {new Date(inv.issueDate).toLocaleDateString()}</p>
                      <p className={inv.status === "OVERDUE" ? "text-red-600 font-bold" : "text-slate-500"}>
                        Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </p>
                    </td>

                    {/* Linked Shipment */}
                    <td className="py-3.5 px-4">
                      {inv.shipment ? (
                        <Link
                          href={`/admin/shipments/${inv.shipment.id || inv.shipment.trackingNumber}`}
                          className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#141B47] hover:underline"
                        >
                          <Truck size={12} className="text-blue-600" />
                          {inv.shipment.trackingNumber}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unlinked</span>
                      )}
                    </td>

                    {/* Financial Figures */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(inv.totalAmount, inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      {formatCurrency(inv.amountPaid, inv.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black">
                      <span className={inv.outstandingBalance > 0 ? "text-red-600" : "text-emerald-700"}>
                        {formatCurrency(inv.outstandingBalance, inv.currency)}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(inv.status)}
                    </td>

                    {/* Dispatch Method */}
                    <td className="py-3.5 px-4 text-center">
                      {inv.lastDeliveryMethod === "EMAIL" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Email Sent
                        </span>
                      ) : inv.lastDeliveryMethod === "WHATSAPP" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          WhatsApp
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Not Sent</span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick View */}
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="View Invoice Details"
                        >
                          <Eye size={15} />
                        </Link>

                        {/* Record Payment */}
                        {inv.status !== "CANCELLED" && inv.outstandingBalance > 0 && (
                          <button
                            onClick={() => setSelectedInvoiceForPayment(inv)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="Record Payment"
                          >
                            <CreditCard size={15} />
                          </button>
                        )}

                        {/* Send Dispatch */}
                        {inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => setSelectedInvoiceForSend(inv)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Send via Email or WhatsApp"
                          >
                            <Send size={15} />
                          </button>
                        )}

                        {/* Print / PDF */}
                        <Link
                          href={`/admin/invoices/${inv.id}/print`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Print / Save PDF"
                        >
                          <Printer size={15} />
                        </Link>

                        {/* Edit Draft */}
                        {inv.status === "DRAFT" && (
                          <Link
                            href={`/admin/invoices/${inv.id}/edit`}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                            title="Edit Draft"
                          >
                            <Edit size={15} />
                          </Link>
                        )}

                        {/* Duplicate */}
                        <button
                          onClick={() => handleDuplicateInvoice(inv)}
                          disabled={actionLoadingId === inv.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                          title="Duplicate Invoice"
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {invoices.length} of {pagination.total} invoices
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span className="font-bold text-slate-800">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {selectedInvoiceForPayment && (
        <RecordPaymentModal
          isOpen={Boolean(selectedInvoiceForPayment)}
          onClose={() => setSelectedInvoiceForPayment(null)}
          onSuccess={() => {
            showToast("Payment recorded successfully!");
            loadInvoices();
          }}
          invoice={selectedInvoiceForPayment}
        />
      )}

      {/* Send Invoice Modal */}
      {selectedInvoiceForSend && (
        <SendInvoiceModal
          isOpen={Boolean(selectedInvoiceForSend)}
          onClose={() => setSelectedInvoiceForSend(null)}
          onSuccess={() => {
            loadInvoices();
          }}
          invoice={selectedInvoiceForSend}
        />
      )}
    </div>
  );
}
