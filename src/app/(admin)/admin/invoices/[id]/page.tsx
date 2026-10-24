"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  getInvoiceByIdAction, 
  issueInvoiceAction, 
  cancelInvoiceAction, 
  duplicateInvoiceAction 
} from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/currency";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";
import { SendInvoiceModal } from "@/components/invoices/send-invoice-modal";
import { UpdateFreightModal } from "@/components/invoices/update-freight-modal";
import { 
  ArrowLeft, Printer, Send, CreditCard, Copy, Edit, XCircle, 
  CheckCircle2, Clock, AlertTriangle, Truck, User, FileText, 
  ShieldCheck, Share2, ExternalLink, Calendar, RefreshCw, Mail, MessageSquare
} from "lucide-react";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<any | null>(null);
  const [branding, setBranding] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [paymentModalOpen, setPaymentModalOpen] = useState<boolean>(false);
  const [sendModalOpen, setSendModalOpen] = useState<boolean>(false);
  const [freightModalOpen, setFreightModalOpen] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getInvoiceByIdAction(resolvedParams.id);
      if (res.success && res.invoice) {
        setInvoice(res.invoice);
        if (res.branding) {
          setBranding(res.branding);
        }
      } else {
        setError(res.error || "Invoice not found.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleIssueInvoice = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const res = await issueInvoiceAction(invoice.id);
      if (res.success) {
        loadInvoice();
      } else {
        alert(res.error || "Failed to issue invoice.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    const reason = prompt("Enter a reason for cancelling this invoice:");
    if (reason === null) return;

    setActionLoading(true);
    try {
      const res = await cancelInvoiceAction(invoice.id, reason || undefined);
      if (res.success) {
        loadInvoice();
      } else {
        alert(res.error || "Failed to cancel invoice.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicateInvoice = async () => {
    if (!invoice) return;
    setActionLoading(true);
    try {
      const res = await duplicateInvoiceAction(invoice.id);
      if (res.success && res.invoiceId) {
        router.push(`/admin/invoices/${res.invoiceId}`);
      } else {
        alert(res.error || "Failed to duplicate invoice.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const copyPublicLink = () => {
    if (invoice?.publicUrl) {
      navigator.clipboard.writeText(invoice.publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto py-24 text-center text-slate-400">
        <RefreshCw size={28} className="animate-spin mx-auto text-[#141B47] mb-3" />
        <p className="text-sm font-bold text-slate-600">Loading invoice document...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error || "Invoice not found."}
        </div>
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141B47] text-white font-bold text-xs"
        >
          <ArrowLeft size={14} /> Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/invoices"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
            title="Back to Invoices list"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-slate-500">
                INVOICE #{invoice.invoiceNumber}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {invoice.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#141B47] tracking-tight">
              {invoice.customer?.name || "Client Invoice"}
            </h1>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Issue button if draft */}
          {invoice.status === "DRAFT" && (
            <button
              onClick={handleIssueInvoice}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F2901F] text-slate-900 hover:bg-[#E08010] shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} /> Issue Officially
            </button>
          )}

          {/* Record payment button if balance > 0 */}
          {invoice.status !== "CANCELLED" && invoice.outstandingBalance > 0 && (
            <button
              onClick={() => setPaymentModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
            >
              <CreditCard size={14} /> Record Payment
            </button>
          )}

          {/* Add / Update Freight Charge Button */}
          {invoice.status !== "CANCELLED" && (
            <button
              onClick={() => setFreightModalOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Add or update international freight charges"
            >
              <Truck size={14} className="text-[#355DAF]" />
              <span>Freight Charge</span>
              {invoice.freightStatus === "PENDING" && (
                <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Pending
                </span>
              )}
            </button>
          )}

          {/* Send via Brevo or WhatsApp */}
          {invoice.status !== "CANCELLED" && (
            <button
              onClick={() => setSendModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#141B47] hover:bg-[#1E2968] text-white shadow-xs flex items-center gap-1.5"
            >
              <Send size={14} /> Send to Client
            </button>
          )}

          {/* Print / Save PDF */}
          <Link
            href={`/admin/invoices/${invoice.id}/print`}
            target="_blank"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs flex items-center gap-1.5"
            title="Print or Save PDF"
          >
            <Printer size={14} /> Print / PDF
          </Link>

          {/* Copy client link */}
          <button
            onClick={copyPublicLink}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs flex items-center gap-1.5"
            title="Copy unguessable client view link"
          >
            <Share2 size={14} /> {copiedLink ? "Link Copied!" : "Client Link"}
          </button>

          {/* Edit Draft */}
          {invoice.status === "DRAFT" && (
            <Link
              href={`/admin/invoices/${invoice.id}/edit`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs flex items-center gap-1.5"
            >
              <Edit size={14} /> Edit
            </Link>
          )}

          {/* Duplicate */}
          <button
            onClick={handleDuplicateInvoice}
            disabled={actionLoading}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Duplicate Invoice"
          >
            <Copy size={15} />
          </button>

          {/* Cancel */}
          {invoice.status !== "CANCELLED" && (
            <button
              onClick={handleCancelInvoice}
              disabled={actionLoading}
              className="p-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50"
              title="Cancel Invoice"
            >
              <XCircle size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Internal Admin Confidential Notes Box */}
      {invoice.internalNotes && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
          <span className="font-extrabold text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-amber-600" /> Internal Administrative Notes (Strictly Confidential)
          </span>
          <p className="leading-relaxed whitespace-pre-wrap font-medium">{invoice.internalNotes}</p>
        </div>
      )}

      {/* Main Grid: Document & Sidebar Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Column: Full Invoice Document (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <InvoiceDocument
            invoice={invoice}
            branding={branding}
            showPrintActions={true}
          />
        </div>

        {/* Right Column: Communications & Audit Trail (1 Col) */}
        <div className="space-y-6">
          {/* Summary Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText size={16} className="text-[#141B47]" /> Financial Summary
            </h3>

            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(invoice.totalAmount, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Amount Paid:</span>
                <span className="font-mono font-bold">
                  {formatCurrency(invoice.amountPaid, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-extrabold pt-1 border-t border-slate-100">
                <span>Remaining Balance:</span>
                <span className={`font-mono ${invoice.outstandingBalance > 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {formatCurrency(invoice.outstandingBalance, invoice.currency)}
                </span>
              </div>

              {/* Freight Status Row */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Truck size={12} className="text-slate-400" /> Freight Status:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      invoice.freightStatus === "PENDING"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : invoice.shippingCharges > 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}>
                      {invoice.freightStatus === "PENDING" ? "Pending Confirmation" : formatCurrency(invoice.shippingCharges || 0, invoice.currency)}
                    </span>
                    {invoice.status !== "CANCELLED" && (
                      <button
                        onClick={() => setFreightModalOpen(true)}
                        className="text-[10px] font-bold text-[#355DAF] hover:underline cursor-pointer"
                      >
                        Update
                      </button>
                    )}
                  </div>
                </div>
                {invoice.freightStatus === "PENDING" && (
                  <p className="text-[10px] text-amber-700 mt-1 italic">
                    * Freight charge not finalized yet. Click &quot;Update&quot; once weighed.
                  </p>
                )}
              </div>
            </div>

            {/* Client Links */}
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Client Profile</span>
              <Link
                href={`/admin/customers`}
                className="text-xs font-bold text-[#141B47] hover:underline flex items-center gap-1"
              >
                <User size={12} /> {invoice.customer?.name} ({invoice.customer?.customerIdentifier})
              </Link>
            </div>

            {/* Shipment Link if any */}
            {invoice.shipment && (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Linked Shipment</span>
                <Link
                  href={`/admin/shipments/${invoice.shipment.id || invoice.shipment.trackingNumber}`}
                  className="text-xs font-mono font-bold text-[#141B47] hover:underline flex items-center gap-1"
                >
                  <Truck size={12} className="text-blue-600" /> {invoice.shipment.trackingNumber}
                </Link>
              </div>
            )}
          </div>

          {/* Payments History Box */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CreditCard size={16} className="text-emerald-600" /> Payment Records ({invoice.payments.length})
              </h3>
              {invoice.outstandingBalance > 0 && invoice.status !== "CANCELLED" && (
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  + Add Payment
                </button>
              )}
            </div>

            {invoice.payments.length === 0 ? (
              <p className="text-slate-400 italic py-2 text-center">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2 pt-1 border-t border-slate-100 divide-y divide-slate-100">
                {invoice.payments.map((p: any) => (
                  <div key={p.id} className="pt-2 first:pt-0 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800">{p.paymentMethod}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        +{formatCurrency(p.amount, invoice.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>{new Date(p.paymentDate).toLocaleDateString()}</span>
                      <span>Ref: {p.reference || "N/A"}</span>
                    </div>
                    {p.notes && <p className="text-[10px] text-slate-500 italic">{p.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Communications History (Brevo Emails & WhatsApp) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Send size={16} className="text-[#141B47]" /> Dispatch History ({invoice.communicationLogs?.length || 0})
            </h3>

            {(!invoice.communicationLogs || invoice.communicationLogs.length === 0) ? (
              <div className="text-center py-4 space-y-1">
                <p className="text-slate-400 italic">No dispatches sent yet.</p>
                <button
                  onClick={() => setSendModalOpen(true)}
                  className="text-[11px] font-bold text-[#141B47] hover:underline"
                >
                  Send invoice now →
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-slate-100 divide-y divide-slate-100">
                {invoice.communicationLogs.map((log: any) => (
                  <div key={log.id} className="pt-2 first:pt-0 space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        {log.channel === "EMAIL" ? (
                          <Mail size={12} className="text-blue-600" />
                        ) : (
                          <MessageSquare size={12} className="text-emerald-600" />
                        )}
                        {log.channel === "EMAIL" ? "Brevo Email" : "WhatsApp"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          log.status === "SENT"
                            ? "bg-emerald-100 text-emerald-800"
                            : log.status === "PREPARED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">{log.recipient}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                    {log.errorMessage && (
                      <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-0.5">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {paymentModalOpen && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSuccess={() => loadInvoice()}
          invoice={invoice}
        />
      )}

      {/* Send Invoice Modal */}
      {sendModalOpen && (
        <SendInvoiceModal
          isOpen={sendModalOpen}
          onClose={() => setSendModalOpen(false)}
          onSuccess={() => loadInvoice()}
          invoice={invoice}
        />
      )}

      {/* Add / Update Freight Charge Modal */}
      {freightModalOpen && (
        <UpdateFreightModal
          isOpen={freightModalOpen}
          onClose={() => setFreightModalOpen(false)}
          onSuccess={() => loadInvoice()}
          invoice={invoice}
        />
      )}
    </div>
  );
}
