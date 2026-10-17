"use client";

import React, { useState, useMemo, useTransition } from "react";
import { formatCurrency } from "@/lib/currency";
import { 
  CheckCircle2, AlertCircle, XCircle, Clock, Plus, Search, Filter, 
  Receipt, ArrowUpRight, DollarSign, CreditCard, RefreshCw, Layers
} from "lucide-react";
import { RecordPaymentDrawer } from "@/components/drawers/record-payment-drawer";
import { PaymentReceiptModal, ReceiptData } from "@/components/payment-receipt-modal";
import { getAllPaymentsAction } from "@/app/actions/admin-payments";

interface PaymentItem {
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
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    internalId: string;
    phone?: string | null;
    email?: string | null;
  };
  shipment: {
    id: string;
    trackingNumber: string;
    description?: string;
    fee?: number;
    originalFee?: number;
    discountPercent?: number;
    discountAmount?: number;
  } | null;
}

interface AdminPaymentsClientProps {
  initialPayments: PaymentItem[];
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; icon: any; label: string }> = {
    SUCCESS:   { bg: "#D1FAE5", color: "#065F46", icon: <CheckCircle2 size={11} />, label: "Paid" },
    PENDING:   { bg: "#FEF9C3", color: "#854D0E", icon: <Clock size={11} />,        label: "Pending" },
    FAILED:    { bg: "#FEE2E2", color: "#991B1B", icon: <XCircle size={11} />,      label: "Failed" },
    CANCELLED: { bg: "#F1F5F9", color: "#475569", icon: <XCircle size={11} />,      label: "Cancelled" },
    REFUNDED:  { bg: "#EDE9FE", color: "#5B21B6", icon: <AlertCircle size={11} />,  label: "Refunded" },
  };
  const s = map[status] ?? { bg: "#F1F5F9", color: "#475569", icon: null, label: status };
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {s.icon} {s.label}
    </span>
  );
}

function typeLabel(type: string) {
  return type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee";
}

export function AdminPaymentsClient({ initialPayments }: AdminPaymentsClientProps) {
  const [payments, setPayments] = useState<PaymentItem[]>(initialPayments);
  const [activeTab, setActiveTab] = useState<"ALL" | "OFFLINE" | "ONLINE">("ALL");
  const [search, setSearch] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Drawer & Modal States
  const [isRecordDrawerOpen, setIsRecordDrawerOpen] = useState<boolean>(false);
  const [receiptModalData, setReceiptModalData] = useState<ReceiptData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const refreshPayments = async () => {
    setIsRefreshing(true);
    try {
      const data = await getAllPaymentsAction();
      setPayments(data as any);
    } catch (err) {
      console.error("Failed to refresh payments:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Metrics
  const totalRevenue = useMemo(() => {
    return payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((a, p) => a + p.amount, 0);
  }, [payments]);

  const totalOfflineRevenue = useMemo(() => {
    return payments
      .filter((p) => p.status === "SUCCESS" && p.isOffline)
      .reduce((a, p) => a + p.amount, 0);
  }, [payments]);

  const totalOnlineRevenue = useMemo(() => {
    return payments
      .filter((p) => p.status === "SUCCESS" && !p.isOffline)
      .reduce((a, p) => a + p.amount, 0);
  }, [payments]);

  const offlineCount = useMemo(() => {
    return payments.filter((p) => p.isOffline).length;
  }, [payments]);

  const onlineCount = useMemo(() => {
    return payments.filter((p) => !p.isOffline).length;
  }, [payments]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    let result = payments;

    if (activeTab === "OFFLINE") {
      result = result.filter((p) => p.isOffline);
    } else if (activeTab === "ONLINE") {
      result = result.filter((p) => !p.isOffline);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.reference.toLowerCase().includes(term) ||
          p.customer.name.toLowerCase().includes(term) ||
          p.customer.id.toLowerCase().includes(term) ||
          (p.shipment?.trackingNumber && p.shipment.trackingNumber.toLowerCase().includes(term)) ||
          (p.receiptNumber && p.receiptNumber.toLowerCase().includes(term)) ||
          (p.paymentMethodLabel && p.paymentMethodLabel.toLowerCase().includes(term))
      );
    }

    return result;
  }, [payments, activeTab, search]);

  const handleOpenReceipt = (payment: PaymentItem) => {
    setReceiptModalData({
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      type: payment.type,
      provider: payment.provider,
      paymentMethod: payment.paymentMethod,
      paymentMethodLabel: payment.paymentMethodLabel,
      isOffline: payment.isOffline,
      receiptNumber: payment.receiptNumber,
      payerName: payment.payerName,
      notes: payment.notes,
      recordedBy: payment.recordedBy,
      paymentDate: payment.paymentDate,
      createdAt: payment.createdAt,
      customer: {
        id: payment.customer.id,
        name: payment.customer.name,
        phone: payment.customer.phone,
        email: payment.customer.email,
      },
      shipment: payment.shipment
        ? {
            trackingNumber: payment.shipment.trackingNumber,
            description: payment.shipment.description,
            fee: payment.shipment.fee,
            originalFee: payment.shipment.originalFee,
            discountPercent: payment.shipment.discountPercent,
            discountAmount: payment.shipment.discountAmount,
          }
        : null,
    });
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* Header with Title and "Record Payment" Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Payments &amp; Invoices</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Overview of verified Paystack online transactions and manual offline recordings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={refreshPayments}
            disabled={isRefreshing}
            className="px-3.5 h-11 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#141B47] flex items-center gap-2 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
            title="Refresh payment records"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-[#F2901F]" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRecordDrawerOpen(true)}
            className="px-5 h-11 rounded-xl text-xs sm:text-sm font-bold bg-[#141B47] hover:bg-[#202B6D] text-white flex items-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[
          { 
            label: "Total Confirmed Revenue", 
            value: formatCurrency(totalRevenue), 
            color: "#10B981", 
            icon: <CheckCircle2 size={18} />,
            subtitle: "All settled payments"
          },
          { 
            label: "Offline Collections", 
            value: formatCurrency(totalOfflineRevenue), 
            color: "#F59E0B", 
            icon: <CreditCard size={18} />,
            subtitle: `${offlineCount} manual recording(s)`
          },
          { 
            label: "Online Paystack", 
            value: formatCurrency(totalOnlineRevenue), 
            color: "#3B82F6", 
            icon: <ArrowUpRight size={18} />,
            subtitle: `${onlineCount} gateway transaction(s)`
          },
          { 
            label: "Total Records", 
            value: String(payments.length), 
            color: "#64748B", 
            icon: <Layers size={18} />,
            subtitle: "Lifetime transaction log"
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#667085]">{card.label}</p>
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ background: card.color }}
              >
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-[#172236] font-mono tabular-nums">{card.value}</p>
            <p className="text-[11px] text-[#94A3B8]">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Payments Table Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-[#E5E7EB] space-y-0">
        {/* Filter Bar */}
        <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Channel Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F5F9] rounded-xl self-start">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "ALL"
                  ? "bg-white text-[#141B47] shadow-2xs"
                  : "text-[#64748B] hover:text-[#172236]"
              }`}
            >
              All ({payments.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("OFFLINE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "OFFLINE"
                  ? "bg-white text-[#141B47] shadow-2xs"
                  : "text-[#64748B] hover:text-[#172236]"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Offline ({offlineCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ONLINE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ONLINE"
                  ? "bg-white text-[#141B47] shadow-2xs"
                  : "text-[#64748B] hover:text-[#172236]"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Paystack Online ({onlineCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search reference, customer, tracking #, slip #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          </div>
        </div>

        {/* Content */}
        {filteredPayments.length === 0 ? (
          <div className="py-16 text-center text-[#667085] text-xs">
            No payments match your filter criteria.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Date", "Reference", "Customer", "Channel / Method", "Type", "Shipment", "Amount", "Status", "Receipt"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-[#667085] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-xs text-[#667085] whitespace-nowrap">
                        {new Date(p.paymentDate || p.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-[#141B47]">{p.reference}</p>
                        {p.receiptNumber && (
                          <p className="font-mono text-[10px] text-[#64748B]">Slip: {p.receiptNumber}</p>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#172236]">{p.customer.name}</p>
                        <p className="text-xs text-[#667085] font-mono">{p.customer.id}</p>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider self-start ${
                            p.isOffline
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}>
                            {p.isOffline ? "Offline" : "Paystack"}
                          </span>
                          <span className="text-xs font-medium text-[#475569]">
                            {p.paymentMethodLabel}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs text-[#667085] whitespace-nowrap">
                        {typeLabel(p.type)}
                      </td>

                      <td className="px-5 py-4 text-xs font-mono text-[#667085]">
                        {p.shipment?.trackingNumber ?? "—"}
                      </td>

                      <td className="px-5 py-4 font-bold text-sm text-[#172236] whitespace-nowrap font-mono tabular-nums">
                        {formatCurrency(p.amount)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {statusBadge(p.status)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(p)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#F1F5F9] hover:bg-[#141B47] hover:text-white text-[#141B47] transition-all inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="View official payment receipt"
                        >
                          <Receipt size={12} /> Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-[#F1F5F9]">
              {filteredPayments.map((p) => (
                <div key={p.id} className="p-4 space-y-2.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#172236]">{p.customer.name}</p>
                      <p className="font-mono text-xs text-[#667085]">{p.customer.id}</p>
                    </div>
                    {statusBadge(p.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        p.isOffline
                          ? "bg-amber-100 text-amber-900 border border-amber-200"
                          : "bg-blue-50 text-blue-800 border border-blue-200"
                      }`}>
                        {p.isOffline ? "Offline" : "Paystack"}
                      </span>
                      <span className="text-[#64748B]">{p.paymentMethodLabel}</span>
                    </div>

                    <span className="font-bold text-sm text-[#172236] font-mono tabular-nums">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085] pt-2 border-t border-gray-100">
                    <div>
                      <span className="font-mono">{p.reference}</span>
                      {p.shipment?.trackingNumber && (
                        <span className="ml-2 font-mono font-medium text-[#141B47]">
                          · {p.shipment.trackingNumber}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenReceipt(p)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#F1F5F9] text-[#141B47] hover:bg-[#141B47] hover:text-white transition-all inline-flex items-center gap-1"
                    >
                      <Receipt size={11} /> Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Record Payment Drawer */}
      <RecordPaymentDrawer
        isOpen={isRecordDrawerOpen}
        onClose={() => setIsRecordDrawerOpen(false)}
        onSuccess={(newPayment) => {
          setIsRecordDrawerOpen(false);
          refreshPayments();
        }}
      />

      {/* Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptModalData(null);
        }}
        receipt={receiptModalData}
      />
    </div>
  );
}
