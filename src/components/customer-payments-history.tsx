"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { CheckCircle2, Clock, XCircle, AlertCircle, Receipt } from "lucide-react";
import { PaymentReceiptModal, ReceiptData } from "@/components/payment-receipt-modal";

interface CustomerPaymentItem {
  id: string;
  reference: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  provider?: string | null;
  providerTransactionId?: string | null;
  paymentMethod?: string | null;
  paymentMethodLabel?: string | null;
  isOffline?: boolean;
  receiptNumber?: string | null;
  payerName?: string | null;
  notes?: string | null;
  receiptAttachmentUrl?: string | null;
  recordedBy?: string | null;
  paymentDate?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  shipment: {
    id?: string;
    trackingNumber?: string;
    description?: string;
    fee?: number;
    originalFee?: number;
    discountPercent?: number;
    discountAmount?: number;
  } | null;
}

interface CustomerPaymentsHistoryProps {
  payments: CustomerPaymentItem[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    SUCCESS:   { bg: "#D1FAE5", color: "#065F46", label: "Paid" },
    PENDING:   { bg: "#FEF9C3", color: "#854D0E", label: "Pending" },
    FAILED:    { bg: "#FEE2E2", color: "#991B1B", label: "Failed" },
    CANCELLED: { bg: "#F1F5F9", color: "#475569", label: "Cancelled" },
    REFUNDED:  { bg: "#EDE9FE", color: "#5B21B6", label: "Refunded" },
  };
  const s = map[status] ?? { bg: "#F1F5F9", color: "#475569", label: status };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function typeLabel(type: string) {
  return type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee";
}

export function CustomerPaymentsHistory({ payments }: CustomerPaymentsHistoryProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const handleOpenReceipt = (p: CustomerPaymentItem) => {
    setSelectedReceipt({
      reference: p.reference,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      type: p.type,
      provider: p.provider,
      paymentMethod: p.paymentMethod,
      paymentMethodLabel: p.paymentMethodLabel,
      isOffline: p.isOffline,
      receiptNumber: p.receiptNumber,
      payerName: p.payerName,
      notes: p.notes,
      recordedBy: p.recordedBy,
      paymentDate: p.paymentDate,
      createdAt: p.createdAt,
      customer: p.customer ? {
        customerIdentifier: p.customer.id,
        name: p.customer.name,
        phone: p.customer.phone,
        email: p.customer.email,
      } : null,
      shipment: p.shipment ? {
        trackingNumber: p.shipment.trackingNumber,
        description: p.shipment.description,
        fee: p.shipment.fee,
        originalFee: p.shipment.originalFee,
        discountPercent: p.shipment.discountPercent,
        discountAmount: p.shipment.discountAmount,
      } : null,
    });
    setIsReceiptOpen(true);
  };

  if (payments.length === 0) {
    return (
      <div className="py-12 text-center flex flex-col items-center">
        <Receipt size={40} className="mb-3 text-gray-300" />
        <p className="font-medium text-base" style={{ color: "#172236" }}>No payments yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-[#F1F5F9]">
        {payments.map((p) => (
          <div key={p.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-mono text-[#172236] font-semibold truncate">{p.reference}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.isOffline
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}>
                    {p.isOffline ? "Offline" : "Paystack"}
                  </span>
                  <span className="text-xs text-[#667085]">{p.paymentMethodLabel || typeLabel(p.type)}</span>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
              <div>
                <p className="font-bold text-base" style={{ color: "#172236" }}>{formatCurrency(p.amount)}</p>
                <p className="text-xs text-[#94A3B8]">
                  {new Date(p.paymentDate || p.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {p.shipment?.trackingNumber && (
                  <span className="text-xs font-mono font-medium text-[#141B47]">
                    {p.shipment.trackingNumber}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenReceipt(p)}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-[#141B47] hover:text-white transition-all inline-flex items-center gap-1 cursor-pointer"
                >
                  <Receipt size={12} /> Receipt
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
              {["Date", "Reference", "Channel / Method", "Type", "Shipment", "Amount", "Status", "Receipt"].map((h) => (
                <th key={h} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9]">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors text-xs">
                <td className="px-6 py-4 text-sm whitespace-nowrap text-[#667085]">
                  {new Date(p.paymentDate || p.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 font-mono text-xs font-semibold max-w-[160px] text-[#172236]">
                  <span className="truncate block">{p.reference}</span>
                  {p.receiptNumber && (
                    <span className="text-[10px] text-[#64748B] block">Slip: {p.receiptNumber}</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold mr-1.5 ${
                    p.isOffline
                      ? "bg-amber-100 text-amber-900 border border-amber-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}>
                    {p.isOffline ? "Offline" : "Paystack"}
                  </span>
                  <span className="text-xs text-[#475569]">{p.paymentMethodLabel}</span>
                </td>
                <td className="px-6 py-4 text-xs whitespace-nowrap text-[#667085]">{typeLabel(p.type)}</td>
                <td className="px-6 py-4 text-xs font-mono text-[#667085]">
                  {p.shipment?.trackingNumber ?? "—"}
                </td>
                <td className="px-6 py-4 font-bold text-sm whitespace-nowrap font-mono text-[#172236]">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleOpenReceipt(p)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] hover:bg-[#141B47] hover:text-white text-[#141B47] transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Receipt size={12} /> Receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaymentReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedReceipt(null);
        }}
        receipt={selectedReceipt}
      />
    </>
  );
}
