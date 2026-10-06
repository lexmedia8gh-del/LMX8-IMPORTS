import { MOCK_INVOICES, MOCK_CUSTOMERS, formatCurrency } from "@/lib/mock-data";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function AdminTransactionsPage() {
  const getCustomerName = (id: string) => MOCK_CUSTOMERS.find(c => c.id === id)?.name || id;

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Transactions</h1>
        <p className="text-sm mt-1 text-[#667085]">Full payment transaction ledger.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        {/* Mobile Cards View */}
        <div className="block md:hidden divide-y divide-[#F1F5F9]">
          {MOCK_INVOICES.map(inv => (
            <div key={inv.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'Paid' ? 'bg-[#D1FAE5]' : 'bg-[#FEF9C3]'}`}>
                    {inv.status === 'Paid' ? <ArrowDownLeft size={16} className="text-[#065F46]" /> : <ArrowUpRight size={16} className="text-[#854D0E]" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#172236]">{inv.id}</p>
                    <p className="text-[11px] text-[#667085]">{inv.shipmentId}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${inv.status === 'Paid' ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEF9C3] text-[#854D0E]'}`}>
                  {inv.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                <span className="text-[#667085]">{getCustomerName(inv.customerId)} · {inv.date}</span>
                <span className="font-bold text-sm text-[#172236]">{formatCurrency(inv.amount)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Transaction</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Customer</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Date</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right text-[#667085]">Amount</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {MOCK_INVOICES.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${inv.status === 'Paid' ? 'bg-[#D1FAE5]' : 'bg-[#FEF9C3]'}`}>
                        {inv.status === 'Paid' ? <ArrowDownLeft size={16} className="text-[#065F46]" /> : <ArrowUpRight size={16} className="text-[#854D0E]" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-[#172236]">{inv.id}</p>
                        <p className="text-[11px] text-[#667085]">{inv.shipmentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#667085]">{getCustomerName(inv.customerId)}</td>
                  <td className="px-6 py-4 text-sm text-[#667085]">{inv.date}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#172236]">{formatCurrency(inv.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${inv.status === 'Paid' ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEF9C3] text-[#854D0E]'}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
