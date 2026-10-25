"use client";

import React, { useState, useEffect } from "react";
import { updateFreightChargesAction } from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/currency";
import { 
  Truck, X, CheckCircle2, Clock, AlertCircle, Info, ShieldCheck, Loader2 
} from "lucide-react";

interface UpdateFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    currency: string;
    totalAmount: number;
    amountPaid: number;
    outstandingBalance: number;
    shippingCharges: number;
    freightStatus?: "CONFIRMED" | "PENDING" | "NOT_APPLICABLE" | string;
    freightNotes?: string | null;
    status: string;
  };
}

export function UpdateFreightModal({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}: UpdateFreightModalProps) {
  const [freightStatus, setFreightStatus] = useState<"CONFIRMED" | "PENDING" | "NOT_APPLICABLE">(
    (invoice.freightStatus as any) || (invoice.shippingCharges > 0 ? "CONFIRMED" : "PENDING")
  );
  const [freightAmount, setFreightAmount] = useState<number>(invoice.shippingCharges || 0);
  const [freightNotes, setFreightNotes] = useState<string>(invoice.freightNotes || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFreightStatus((invoice.freightStatus as any) || (invoice.shippingCharges > 0 ? "CONFIRMED" : "PENDING"));
      setFreightAmount(invoice.shippingCharges || 0);
      setFreightNotes(invoice.freightNotes || "");
      setError(null);
    }
  }, [isOpen, invoice]);

  if (!isOpen) return null;

  // Calculate live preview
  const baseWithoutPreviousShipping = Math.max(0, invoice.totalAmount - (invoice.shippingCharges || 0));
  const effectiveNewFreight = freightStatus === "CONFIRMED" ? Math.max(0, Number(freightAmount) || 0) : 0;
  const simulatedNewTotal = Math.round((baseWithoutPreviousShipping + effectiveNewFreight) * 100) / 100;
  const simulatedNewOutstanding = Math.max(0, Math.round((simulatedNewTotal - invoice.amountPaid) * 100) / 100);

  const wasPreviouslyPaid = invoice.status === "PAID" || (invoice.outstandingBalance <= 0 && invoice.amountPaid > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (freightStatus === "CONFIRMED" && (isNaN(freightAmount) || freightAmount < 0)) {
      setError("Please specify a valid freight amount (0 or greater).");
      return;
    }

    setLoading(true);
    try {
      const res = await updateFreightChargesAction({
        invoiceId: invoice.id,
        freightStatus,
        freightAmount: effectiveNewFreight,
        freightNotes: freightNotes.trim() || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || "Failed to update freight charges.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#141B47] text-white flex items-center justify-center shadow-xs shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#141B47]">Add / Update Freight Charge</h3>
              <p className="text-xs text-slate-500 font-mono">Invoice #{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[36px] min-w-[36px]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Status Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-500">Current Freight Status:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] uppercase ${
              invoice.freightStatus === "PENDING"
                ? "bg-amber-100 text-amber-800 border border-amber-200"
                : invoice.shippingCharges > 0
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : "bg-slate-100 text-slate-700 border border-slate-200"
            }`}>
              {invoice.freightStatus === "PENDING" ? "Pending Confirmation" : `${formatCurrency(invoice.shippingCharges, invoice.currency)}`}
            </span>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Freight Determination Status
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setFreightStatus("CONFIRMED")}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  freightStatus === "CONFIRMED"
                    ? "border-[#141B47] bg-[#141B47]/5 ring-2 ring-[#141B47]/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-[#141B47] mb-0.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Confirmed
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Charge known &amp; weighed
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFreightStatus("PENDING");
                  setFreightAmount(0);
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  freightStatus === "PENDING"
                    ? "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800 mb-0.5">
                  <Clock size={13} className="text-amber-600" />
                  Pending
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  To be weighed later
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFreightStatus("NOT_APPLICABLE");
                  setFreightAmount(0);
                }}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  freightStatus === "NOT_APPLICABLE"
                    ? "border-slate-600 bg-slate-100 ring-2 ring-slate-400/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700 mb-0.5">
                  <Info size={13} className="text-slate-500" />
                  N/A
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  No shipping needed
                </p>
              </button>
            </div>
          </div>

          {/* If Confirmed, input freight amount and notes */}
          {freightStatus === "CONFIRMED" && (
            <div className="space-y-3 pt-1 animate-in fade-in duration-150">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Freight Charge Amount ({invoice.currency})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-mono text-xs text-slate-400">
                    {invoice.currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={freightAmount === 0 ? "" : freightAmount}
                    onChange={(e) => setFreightAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full pl-14 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Freight Reference / Weight Notes (Optional)
                </label>
                <input
                  type="text"
                  value={freightNotes}
                  onChange={(e) => setFreightNotes(e.target.value)}
                  placeholder="e.g. 18.5 kg · 0.14 CBM · Sea Cargo Consolidation #GH-882"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#141B47]"
                />
              </div>
            </div>
          )}

          {/* Live Recalculation Breakdown Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 block">
              Financial Impact Preview
            </span>
            <div className="flex justify-between text-slate-600">
              <span>Goods Subtotal &amp; Other Fees:</span>
              <span className="font-mono">{formatCurrency(baseWithoutPreviousShipping, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-slate-800 font-medium">
              <span>New Freight Charge:</span>
              <span className="font-mono font-bold">
                {freightStatus === "PENDING"
                  ? "Pending Confirmation"
                  : formatCurrency(effectiveNewFreight, invoice.currency)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-slate-900 font-bold">
              <span>Updated Total Invoiced:</span>
              <span className="font-mono text-sm">{formatCurrency(simulatedNewTotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Payments Kept (Unbroken):</span>
              <span className="font-mono">-{formatCurrency(invoice.amountPaid, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-slate-900 font-black">
              <span>Updated Outstanding Balance:</span>
              <span className={`font-mono text-sm ${simulatedNewOutstanding > 0 ? "text-red-600" : "text-emerald-700"}`}>
                {formatCurrency(simulatedNewOutstanding, invoice.currency)}
              </span>
            </div>

            {wasPreviouslyPaid && effectiveNewFreight > 0 && (
              <div className="pt-2 text-[11px] text-blue-900 bg-blue-50/80 p-2.5 rounded-xl border border-blue-100 flex items-start gap-1.5">
                <ShieldCheck size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  The client previously paid for their goods ({formatCurrency(invoice.amountPaid, invoice.currency)}).
                  Their previous payment is preserved and the new balance due will be exactly {formatCurrency(simulatedNewOutstanding, invoice.currency)} for freight.
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving Freight...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> Confirm &amp; Update Freight
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
