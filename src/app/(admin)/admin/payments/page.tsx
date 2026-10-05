import { getAllPaymentsAction } from "@/app/actions/admin-payments";
import { formatCurrency } from "@/lib/mock-data";
import { CheckCircle2, AlertCircle, XCircle, Clock } from "lucide-react";

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
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.icon} {s.label}
    </span>
  );
}

function typeLabel(type: string) {
  return type === "CREDIT_PURCHASE" ? "Credit Purchase" : "Shipping Fee";
}

export default async function AdminPaymentsPage() {
  const payments = await getAllPaymentsAction();

  const totalRevenue = payments
    .filter((p) => p.status === "SUCCESS")
    .reduce((a, p) => a + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((a, p) => a + p.amount, 0);

  const totalFailed = payments.filter((p) => p.status === "FAILED").length;

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Payments & Invoices</h1>
        <p className="text-sm mt-1 text-[#667085]">Overview of all payment transactions.</p>
      </div>

      {/* Summary cards: 1 col on mobile, 2 cols on tablet, 4 cols on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[
          { label: "Total Revenue", value: formatCurrency(totalRevenue), color: "#10B981", icon: <CheckCircle2 size={18} /> },
          { label: "Pending",       value: formatCurrency(totalPending),  color: "#F59E0B", icon: <Clock size={18} /> },
          { label: "Failed",        value: String(totalFailed) + " txns", color: "#EF4444", icon: <XCircle size={18} /> },
          { label: "Total Records", value: String(payments.length),        color: "#3B82F6", icon: <AlertCircle size={18} /> },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[#667085]">{card.label}</p>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                style={{ background: card.color }}
              >
                {card.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-[#172236] font-mono tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Payments table & mobile cards */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#F1F5F9]">
          <h2 className="font-semibold text-base text-[#172236]">All Transactions</h2>
          <p className="text-xs mt-0.5 text-[#667085]">Payment status is verified server-side with Paystack.</p>
        </div>

        {payments.length === 0 ? (
          <div className="py-16 text-center text-[#667085]">No payments recorded yet.</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Date", "Reference", "Customer", "Type", "Shipment", "Amount", "Status", "Provider Txn ID"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085] whitespace-nowrap"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 text-sm text-[#667085] whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-[#172236] whitespace-nowrap">
                        {p.reference}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#172236]">{p.customer.name}</p>
                        <p className="text-xs text-[#667085]">{p.customer.id}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-[#667085] whitespace-nowrap">
                        {typeLabel(p.type)}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-[#667085]">
                        {p.shipment?.trackingNumber ?? "—"}
                      </td>
                      <td className="px-5 py-4 font-bold text-sm text-[#172236] whitespace-nowrap font-mono tabular-nums">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-5 py-4">{statusBadge(p.status)}</td>
                      <td className="px-5 py-4 text-xs font-mono text-[#667085]">
                        {p.providerTransactionId ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-[#F1F5F9]">
              {payments.map((p) => (
                <div key={p.id} className="p-4 space-y-2.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-[#172236]">{p.customer.name}</p>
                      <p className="font-mono text-xs text-[#667085]">{p.reference}</p>
                    </div>
                    {statusBadge(p.status)}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#667085]">{typeLabel(p.type)}</span>
                    <span className="font-bold text-sm text-[#172236] font-mono tabular-nums">
                      {formatCurrency(p.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#667085] pt-1 border-t border-gray-100">
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    {p.shipment?.trackingNumber ? (
                      <span className="font-mono font-medium text-[#141B47]">
                        Track: {p.shipment.trackingNumber}
                      </span>
                    ) : (
                      <span>Direct Sourcing Payment</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
