import { MOCK_SOURCING_REQUESTS, MOCK_CUSTOMERS } from "@/lib/mock-data";
import { PackageSearch, Clock, CheckCircle2, AlertCircle } from "lucide-react";

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Awaiting Review":      { bg: "#FEF3C7", text: "#92400E" },
  "Quotation Provided":   { bg: "#DBEAFE", text: "#1E40AF" },
  "Approved":             { bg: "#D1FAE5", text: "#065F46" },
  "Rejected":             { bg: "#FEE2E2", text: "#991B1B" },
};

export default function AdminSourcingPage() {
  const getCustomerName = (customerId: string) => MOCK_CUSTOMERS.find(c => c.id === customerId)?.name || customerId;

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Sourcing Requests</h1>
        <p className="text-sm mt-1 text-[#667085]">Review and process customer sourcing applications.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
          <h2 className="font-semibold text-base text-[#172236]">All Requests</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FEF9C3] text-[#854D0E]">
            {MOCK_SOURCING_REQUESTS.filter(r => r.status === "Awaiting Review").length} Awaiting Review
          </span>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {MOCK_SOURCING_REQUESTS.map(req => {
            const style = STATUS_STYLE[req.status] || { bg: "#F1F5F9", text: "#475569" };
            return (
              <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#F7F9FC] flex items-center justify-center shrink-0 border border-[#E5E7EB]">
                    <PackageSearch size={18} className="text-[#0B1F44]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm text-[#172236]">{req.id}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: style.bg, color: style.text }}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-[#172236]">{req.product}</p>
                    <p className="text-xs text-[#667085] mt-0.5">
                      {getCustomerName(req.customerId)} · Qty: {req.qty} · {req.specs}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:shrink-0">
                  <span className="text-xs text-[#94A3B8] flex items-center gap-1">
                    <Clock size={12} /> {req.date}
                  </span>
                  {req.status === "Awaiting Review" && (
                    <button className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#FFB800] text-[#07182F] hover:opacity-90 transition-opacity">
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
