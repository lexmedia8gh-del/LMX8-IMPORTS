import { getAllPaymentsAction } from "@/app/actions/admin-payments";
import { formatCurrency } from "@/lib/currency";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, XCircle, AlertCircle, Receipt } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  const payments = await getAllPaymentsAction().catch(() => []);

  const totalSuccessful = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((acc, p) => acc + p.amount, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return {
          bg: "#D1FAE5",
          text: "#065F46",
          label: "Paid",
          icon: <CheckCircle2 size={12} />,
        };
      case "PENDING":
        return {
          bg: "#FEF9C3",
          text: "#854D0E",
          label: "Pending",
          icon: <Clock size={12} />,
        };
      case "FAILED":
        return {
          bg: "#FEE2E2",
          text: "#991B1B",
          label: "Failed",
          icon: <XCircle size={12} />,
        };
      default:
        return {
          bg: "#F1F5F9",
          text: "#475569",
          label: status,
          icon: <AlertCircle size={12} />,
        };
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Transaction Ledger</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Verified payments, invoices, and credit purchases recorded in PostgreSQL.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs text-[#667085] uppercase font-bold tracking-wider">Total Verified Volume</p>
          <p className="text-xl sm:text-2xl font-black text-brand-navy tabular-nums">{formatCurrency(totalSuccessful)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#F1F5F9] flex items-center justify-between">
          <h2 className="font-semibold text-base text-[#172236]">All Transactions</h2>
          <span className="text-xs font-bold text-[#667085]">{payments.length} Records</span>
        </div>

        {payments.length === 0 ? (
          <div className="py-20 text-center text-[#667085] flex flex-col items-center gap-3">
            <Receipt size={40} className="opacity-20 text-brand-navy" />
            <p className="font-bold text-base text-[#172236]">No transaction records found</p>
            <p className="text-xs max-w-sm">
              When customers complete credit purchases or pay shipping fees through Paystack, transactions will be catalogued here.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-[#F1F5F9]">
              {payments.map((tx) => {
                const badge = getStatusBadge(tx.status);
                const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-GH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div key={tx.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: badge.bg, color: badge.text }}
                        >
                          {tx.status === "SUCCESS" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#172236] font-mono">{tx.reference}</p>
                          <p className="text-[11px] text-[#667085]">
                            {tx.type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee"}
                            {tx.shipment ? ` · ${tx.shipment.trackingNumber}` : ""}
                          </p>
                        </div>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <span className="text-[#667085]">
                        {tx.customer.name} ({tx.customer.id}) · {formattedDate}
                      </span>
                      <span className="font-bold text-sm text-[#172236]">{formatCurrency(tx.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Reference
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Type
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Date
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right text-[#667085]">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {payments.map((tx) => {
                    const badge = getStatusBadge(tx.status);
                    const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-GH", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              {tx.status === "SUCCESS" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-[#172236] font-mono">{tx.reference}</p>
                              {tx.shipment && (
                                <p className="text-[11px] text-[#667085] font-mono">{tx.shipment.trackingNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-[#172236]">
                          <p className="font-semibold text-sm">{tx.customer.name}</p>
                          <p className="text-xs text-[#667085] font-mono">{tx.customer.id}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-[#475569]">
                          {tx.type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee"}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#667085]">{formattedDate}</td>
                        <td className="px-6 py-4 text-right font-bold text-sm text-[#172236] tabular-nums">
                          {formatCurrency(tx.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={{ background: badge.bg, color: badge.text }}
                          >
                            {badge.icon} {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
