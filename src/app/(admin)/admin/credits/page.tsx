"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatCredits } from "@/lib/currency";
import {
  getAdminCreditsOverviewAction,
  adminAdjustCustomerCreditsAction,
} from "@/app/actions/sourcing-credits";
import { Star, Plus, Minus, Search, Loader2, CheckCircle2, AlertCircle, Users, RefreshCw } from "lucide-react";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
}

interface CustomerCredit {
  id: string;
  customerIdentifier: string;
  name: string;
  phone: string;
  email: string;
  credits: number;
  creditsPurchased: number;
  creditsUsed: number;
  lastActivityAt: string | null;
}

export default function AdminCreditsPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [customers, setCustomers] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [creditAdjustment, setCreditAdjustment] = useState<number>(5);
  const [adjustmentNote, setAdjustmentNote] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAdminCreditsOverviewAction();
      setPackages(data.packages);
      setCustomers(data.customers);
    } catch (err: any) {
      console.error("Failed to load credits overview:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdjustCredits = async () => {
    if (!selectedCustomer) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await adminAdjustCustomerCreditsAction({
        customerId: selectedCustomer.id,
        amount: creditAdjustment,
        note: adjustmentNote.trim() || `Admin allocation: ${creditAdjustment > 0 ? "+" : ""}${creditAdjustment} credits`,
      });

      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else {
        setFeedback({ type: "success", text: `Successfully updated credits. New balance: ${res.balance}` });
        await loadData();
        setTimeout(() => {
          setSelectedCustomer(null);
          setAdjustmentNote("");
          setFeedback(null);
        }, 1200);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to adjust credits" });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.customerIdentifier.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Sourcing Credits</h1>
          <p className="text-sm mt-1 text-[#667085]">
            Manage verified credit packages and live customer balances from PostgreSQL.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#172236] transition-colors w-fit shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Real Packages */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
          <div className="px-6 py-5 border-b border-[#F1F5F9]">
            <h2 className="font-semibold text-base text-[#172236]">Authoritative Credit Packages</h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Configured platform rates for self-serve customer credit purchases.
            </p>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#FEF9C3]">
                    <Star size={18} className="text-[#854D0E]" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#172236]">{pkg.name} Package</p>
                    <p className="text-xs text-[#667085]">{formatCredits(pkg.credits)}</p>
                  </div>
                </div>
                <p className="font-bold text-[#172236]">{formatCurrency(pkg.price)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Customer Credit Allocations */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB] flex flex-col">
          <div className="px-6 py-4 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-base text-[#172236]">Customer Credit Ledger</h2>
              <p className="text-xs text-[#667085]">Live database balances ({customers.length} registered)</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </div>
          </div>

          <div className="divide-y divide-[#F1F5F9] max-h-[460px] overflow-y-auto flex-1">
            {loading ? (
              <div className="p-12 text-center text-[#667085] flex flex-col items-center gap-2">
                <Loader2 size={24} className="animate-spin text-brand-navy" />
                <span className="text-xs">Loading customer balances...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center text-[#667085] flex flex-col items-center gap-2">
                <Users size={32} className="opacity-20 text-brand-navy" />
                <p className="text-sm font-semibold text-[#172236]">No customers found</p>
                <p className="text-xs text-[#667085]">
                  {search ? "No matching records found for search." : "No customer accounts registered yet."}
                </p>
              </div>
            ) : (
              filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-[#F7F9FC] border border-[#E5E7EB] text-[#172236] shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-sm text-[#172236] truncate">{c.name}</p>
                      <p className="text-xs text-[#667085] font-mono">{c.customerIdentifier}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold text-[#172236] text-sm tabular-nums">
                      {formatCredits(c.credits)}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCreditAdjustment(5);
                        setAdjustmentNote("");
                        setFeedback(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F7F9FC] text-[#0B1F44] hover:bg-[#E5E7EB] transition-colors border border-[#E5E7EB] cursor-pointer"
                    >
                      Adjust
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Adjust Credits Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E5E7EB] space-y-4">
            <div>
              <h3 className="font-bold text-lg text-[#172236]">Adjust Sourcing Credits</h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Customer: <span className="font-semibold text-[#172236]">{selectedCustomer.name}</span> ({selectedCustomer.customerIdentifier})
              </p>
              <p className="text-xs text-[#667085]">
                Current Balance: <span className="font-bold text-brand-navy">{selectedCustomer.credits} Credits</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#172236] block mb-1">
                  Credit Change (Positive to add, Negative to deduct)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditAdjustment((prev) => prev - 1)}
                    className="p-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    value={creditAdjustment}
                    onChange={(e) => setCreditAdjustment(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border rounded-lg text-center font-bold text-base focus:outline-none focus:ring-1 focus:ring-brand-navy"
                  />
                  <button
                    type="button"
                    onClick={() => setCreditAdjustment((prev) => prev + 1)}
                    className="p-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-[11px] text-[#667085] mt-1">
                  New Resulting Balance: {Math.max(0, selectedCustomer.credits + creditAdjustment)} Credits
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#172236] block mb-1">
                  Reason / Audit Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Promotional allocation, correction"
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-navy"
                />
              </div>

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedback.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || creditAdjustment === 0}
                onClick={handleAdjustCredits}
                className="px-5 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-secondary rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Confirm Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
