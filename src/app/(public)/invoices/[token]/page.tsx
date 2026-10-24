"use client";

import React, { useState, useEffect, use } from "react";
import { getPublicInvoiceByTokenAction } from "@/app/actions/invoices";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Printer, RefreshCw, AlertCircle, ShieldCheck } from "lucide-react";

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [branding, setBranding] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPublicInvoiceByTokenAction(resolvedParams.token).then((res) => {
      if (res.success && res.invoice) {
        setInvoiceData(res.invoice);
        setBranding(res.branding);
      } else {
        setError(res.error || "Invoice not found or link has expired.");
      }
      setLoading(false);
    });
  }, [resolvedParams.token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw size={28} className="animate-spin mx-auto text-[#141B47]" />
          <p className="text-xs font-bold text-slate-700">Loading your official invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-lg border border-slate-200 text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-amber-500" />
          <h2 className="text-lg font-bold text-slate-900">Invoice Link Unavailable</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || "This invoice link is invalid, expired, or has been revoked. Please contact LMX8 Imports customer desk for assistance."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-3 sm:p-8">
      {/* Top Banner with Print Action */}
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#F2901F]">
            CLIENT PORTAL
          </span>
          <p className="text-xs font-bold text-slate-800">
            Official Invoice #{invoiceData.invoiceNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer size={15} /> Print / Download PDF
          </button>
        </div>
      </div>

      {/* Render Invoice Document (Internal notes are stripped on server) */}
      <InvoiceDocument
        invoice={invoiceData}
        branding={branding}
      />

      {/* Client Security Notice Footer */}
      <div className="max-w-4xl mx-auto mt-6 text-center text-[11px] text-slate-400 no-print flex items-center justify-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>Secure client document issued by {branding?.businessName || "LMX8 IMPORTS"}. Encrypted access.</span>
      </div>
    </div>
  );
}
