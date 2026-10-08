import Link from "next/link";
import { getOutstandingShipmentsAction, getCustomerPaymentsAction } from "@/app/actions/customer-payments";
import { CheckCircle2, AlertCircle, ArrowRight, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export const dynamic = "force-dynamic";

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

export default async function PaymentsPage() {
  const [shipments, payments] = await Promise.all([
    getOutstandingShipmentsAction(),
    getCustomerPaymentsAction(),
  ]);

  const outstanding = shipments.filter((s) => !s.isPaid);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>
          Shipping Payments
        </h1>
        <p className="text-sm mt-1" style={{ color: "#667085" }}>
          Manage your shipping fees and payment history.
        </p>
      </div>

      {/* Outstanding shipping fees */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-semibold text-base" style={{ color: "#172236" }}>
            Outstanding Shipping Fees
          </h2>
        </div>

        {outstanding.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center px-6">
            <CheckCircle2 size={40} className="mb-3 text-gray-300" />
            <p className="font-medium text-base" style={{ color: "#172236" }}>No pending payments</p>
            <p className="text-sm mt-1 max-w-xs" style={{ color: "#667085" }}>
              All your shipping fees are fully paid. Outstanding fees will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {outstanding.map((s) => (
              <div key={s.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF9C3" }}>
                    <AlertCircle size={20} style={{ color: "#854D0E" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm" style={{ color: "#172236" }}>{s.trackingNumber}</h3>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#667085" }}>{s.description}</p>
                    <p className="text-xs mt-1 font-medium" style={{ color: "#667085" }}>
                      Fee: <span style={{ color: "#172236" }}>{formatCurrency(s.fee)}</span>
                      {s.paidAmount > 0 && (
                        <> · Paid: <span className="text-green-600">{formatCurrency(s.paidAmount)}</span></>
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#667085" }}>Outstanding</p>
                    <p className="font-black text-xl" style={{ color: "#141B47" }}>{formatCurrency(s.outstanding)}</p>
                  </div>
                  <Link href={`/portal/payments/${s.id}`}>
                    <button
                      className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl transition-all hover:opacity-90 shadow-sm text-white cursor-pointer"
                      style={{ background: "#F2901F" }}
                    >
                      Pay Now <ArrowRight size={16} />
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E5E7EB" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <h2 className="font-semibold text-base" style={{ color: "#172236" }}>Payment History</h2>
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <Receipt size={40} className="mb-3 text-gray-300" />
            <p className="font-medium text-base" style={{ color: "#172236" }}>No payments yet</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#F1F5F9]">
              {payments.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-[#172236] font-semibold truncate">{p.reference}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#667085" }}>{typeLabel(p.type)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="font-bold text-base" style={{ color: "#172236" }}>{formatCurrency(p.amount)}</p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {p.shipment?.trackingNumber && (
                    <p className="text-xs mt-1 font-mono" style={{ color: "#94A3B8" }}>
                      Shipment: {p.shipment.trackingNumber}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    {["Date", "Reference", "Type", "Amount", "Status", "Shipment"].map((h) => (
                      <th key={h} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#667085" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm whitespace-nowrap" style={{ color: "#667085" }}>
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold max-w-[160px]" style={{ color: "#172236" }}>
                        <span className="truncate block">{p.reference}</span>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap" style={{ color: "#667085" }}>{typeLabel(p.type)}</td>
                      <td className="px-6 py-4 font-bold text-sm whitespace-nowrap" style={{ color: "#172236" }}>{formatCurrency(p.amount)}</td>
                      <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: "#667085" }}>
                        {p.shipment?.trackingNumber ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
