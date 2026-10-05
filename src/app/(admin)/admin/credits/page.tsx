import { MOCK_CREDIT_PACKAGES, MOCK_CUSTOMERS, formatCurrency } from "@/lib/mock-data";
import { Star, Plus } from "lucide-react";

export default function AdminCreditsPage() {
  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Sourcing Credits</h1>
          <p className="text-sm mt-1 text-[#667085]">Manage credit packages and customer allocations.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Packages */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
          <div className="px-6 py-5 border-b border-[#F1F5F9]">
            <h2 className="font-semibold text-base text-[#172236]">Credit Packages</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {MOCK_CREDIT_PACKAGES.map(pkg => (
              <div key={pkg.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FEF9C3]">
                    <Star size={18} className="text-[#854D0E]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#172236]">{pkg.name}</p>
                    <p className="text-xs text-[#667085]">{pkg.credits} Credits</p>
                  </div>
                </div>
                <p className="font-bold text-[#172236]">{formatCurrency(pkg.price)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Credit Allocations */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
          <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <h2 className="font-semibold text-base text-[#172236]">Customer Credits</h2>
            <button className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F44] hover:text-[#FFB800] transition-colors">
              <Plus size={14} /> Add Credits
            </button>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {MOCK_CUSTOMERS.map(c => (
              <div key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-[#F7F9FC] border border-[#E5E7EB] text-[#172236]">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#172236]">{c.name}</p>
                    <p className="text-xs text-[#667085]">{c.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-[#172236]">{c.credits} Credits</span>
                  <button className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#F7F9FC] text-[#0B1F44] hover:bg-[#E5E7EB] transition-colors border border-[#E5E7EB]">
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
