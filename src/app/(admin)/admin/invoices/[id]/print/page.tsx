"use client";

import React, { useState, useEffect, use } from "react";
import { getInvoiceByIdAction } from "@/app/actions/invoices";
import { getBrandSettingsAction } from "@/app/actions/branding";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { Printer, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [branding, setBranding] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getInvoiceByIdAction(resolvedParams.id),
      getBrandSettingsAction(),
    ]).then(([invRes, brandRes]) => {
      if (invRes.success && invRes.invoice) {
        setInvoice(invRes.invoice);
      }
      if (brandRes) {
        setBranding(brandRes);
      }
      setLoading(false);
    });
  }, [resolvedParams.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-500">
        <div className="text-center space-y-2">
          <RefreshCw size={24} className="animate-spin mx-auto text-[#141B47]" />
          <p className="text-xs font-bold">Preparing printable invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-white p-8 text-center text-slate-600">
        <p>Invoice not found.</p>
        <Link href="/admin/invoices" className="text-xs text-[#141B47] underline mt-2 inline-block">
          Return to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-4 sm:p-8">
      {/* Top action bar hidden in print */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between no-print bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <Link
          href={`/admin/invoices/${invoice.id}`}
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
        >
          <ArrowLeft size={14} /> Back to Invoice
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline">
            Print preview ready · Use browser dialog to save as PDF
          </span>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Render High-Fidelity Printable Document */}
      <InvoiceDocument
        invoice={invoice}
        branding={branding}
      />
    </div>
  );
}
