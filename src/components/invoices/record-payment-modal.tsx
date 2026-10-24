"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { recordInvoicePaymentAction } from "@/app/actions/invoices";
import { X, CheckCircle2, AlertCircle, DollarSign, Calendar, CreditCard, FileText } from "lucide-react";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
    outstandingBalance: number;
    currency: string;
    customer?: {
      name?: string;
    } | null;
  };
}

export function RecordPaymentModal({ isOpen, onClose, onSuccess, invoice }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<string>(invoice.outstandingBalance > 0 ? invoice.outstandingBalance.toFixed(2) : "0.00");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (numAmount > invoice.outstandingBalance + 0.01) {
      setError(`Payment cannot exceed outstanding balance of ${formatCurrency(invoice.outstandingBalance, invoice.currency)}.`);
      return;
    }

    setLoading(true);
    try {
      const result = await recordInvoicePaymentAction(invoice.id, {
        amount: numAmount,
        paymentDate,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error || "Failed to record payment.");
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-[#141B47] text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#F2901F]">
                INVOICE SETTLEMENT
              </span>
            </div>
            <h3 className="text-xl font-black mt-1">Record Payment</h3>
            <p className="text-xs text-white/70 font-mono mt-0.5">
              Invoice #{invoice.invoiceNumber} · {invoice.customer?.name || "Client"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Balance overview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold">Total Invoiced</span>
              <p className="font-mono font-bold text-slate-800 text-sm">
                {formatCurrency(invoice.totalAmount, invoice.currency)}
              </p>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase font-bold">Outstanding Balance</span>
              <p className="font-mono font-black text-red-600 text-sm">
                {formatCurrency(invoice.outstandingBalance, invoice.currency)}
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Amount ({invoice.currency}) *
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.outstandingBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full pl-4 pr-16 py-2.5 rounded-xl border border-slate-300 focus:border-[#141B47] focus:ring-1 focus:ring-[#141B47] font-mono font-bold text-base text-slate-900"
              />
              <button
                type="button"
                onClick={() => setAmount(invoice.outstandingBalance.toFixed(2))}
                className="absolute right-2 top-2 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
              >
                Pay Full
              </button>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#141B47] text-xs font-medium text-slate-800"
            >
              <option value="BANK_TRANSFER">Bank Wire / Transfer</option>
              <option value="MTN_MOMO">MTN Mobile Money</option>
              <option value="TELECEL_CASH">Telecel Cash</option>
              <option value="AT_MONEY">AT Money</option>
              <option value="CASH">Cash (In-person)</option>
              <option value="PAYSTACK">Paystack Online Payment</option>
              <option value="OTHER">Other Offline Settlement</option>
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Date Received
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800"
            />
          </div>

          {/* Transaction Reference */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Transaction Reference / Slip # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-998231 or Bank Slip ID"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Internal Settlement Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Received via Stanbic Bank Accra branch"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? "Recording..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
