import { formatCurrency } from "@/lib/mock-data";
import { CheckCircle2, History, ArrowRightLeft } from "lucide-react";
import { getCustomerCreditAccountAction } from "@/app/actions/sourcing-credits";
import { CreditPurchaseButton } from "@/components/credit-purchase-button";
import { CREDIT_PACKAGES, type CreditPackageId } from "@/lib/credit-packages";

export default async function AdminCreditsPortalPage() {
  const { balance, transactions } = await getCustomerCreditAccountAction();

  const packagesList = [
    { id: "starter",  ...CREDIT_PACKAGES.starter,  popular: false },
    { id: "standard", ...CREDIT_PACKAGES.standard, popular: true  },
    { id: "premium",  ...CREDIT_PACKAGES.premium,  popular: false },
  ] as const;

  return (
    <div className="space-y-7">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Buy Sourcing Credits</h1>
          <p className="text-sm mt-1 text-[#667085]">Purchase credits to source products from China.</p>
        </div>
        <div className="bg-white px-5 py-3 rounded-xl border border-[#E5E7EB] shadow-sm">
          <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider mb-0.5">Current Balance</p>
          <p className="text-xl font-bold text-[#10B981]">{balance} Credits</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {packagesList.map(pkg => (
          <div
            key={pkg.name}
            className={`bg-white rounded-2xl p-6 border transition-all ${pkg.popular ? "border-[#FFB800] shadow-lg ring-2 ring-[#FFB800]/20 scale-[1.02]" : "border-[#E5E7EB] hover:shadow-md"}`}
          >
            {pkg.popular && (
              <span className="inline-flex mb-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0B1F44] text-[#FFB800]">Most Popular</span>
            )}
            <h3 className="text-lg font-bold text-[#172236]">{pkg.name}</h3>
            <p className="text-4xl font-black text-[#172236] my-4">{pkg.credits}<span className="text-lg font-semibold text-[#667085] ml-1">credit{pkg.credits > 1 ? "s" : ""}</span></p>
            <p className="text-2xl font-bold text-[#0B1F44] mb-6">{formatCurrency(pkg.price)}</p>

            <div className="space-y-2.5 mb-6">
              {[
                `${pkg.credits} product sourcing request${pkg.credits > 1 ? "s" : ""}`,
                "Full quotation service",
                "China supplier search",
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-[#667085]">
                  <CheckCircle2 size={14} className="text-[#10B981] shrink-0" /> {f}
                </div>
              ))}
            </div>

            <CreditPurchaseButton 
              packageId={pkg.id as CreditPackageId} 
              packageName={pkg.name} 
              popular={pkg.popular} 
            />
          </div>
        ))}
      </div>

      {/* Transaction History Ledger */}
      <div className="mt-8 bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center gap-2">
          <History size={18} className="text-[#667085]" />
          <h2 className="font-semibold text-base text-[#172236]">Transaction History</h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-[#667085] text-sm">
            <ArrowRightLeft className="mx-auto mb-3 opacity-20" size={32} />
            <p>No credit transactions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-xs font-semibold text-[#667085]">
                  <th className="px-6 py-4 whitespace-nowrap">Date</th>
                  <th className="px-6 py-4 whitespace-nowrap">Type</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Amount</th>
                  <th className="px-6 py-4 whitespace-nowrap text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors text-sm text-[#172236]">
                    <td className="px-6 py-4 whitespace-nowrap">{tx.createdAt}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                        {tx.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#667085] max-w-[250px] truncate" title={tx.description || ""}>
                      {tx.description || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold">
                      <span className={tx.amount > 0 ? "text-[#10B981]" : "text-[#EF4444]"}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-semibold">
                      {tx.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
