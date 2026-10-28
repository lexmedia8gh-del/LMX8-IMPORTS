"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  Lock,
  Clock,
  ArrowRight,
  Calendar,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { getEodReportsHistoryAction } from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

interface EodHistoryViewProps {
  onSelectReportDate: (date: string) => void;
}

export function EodHistoryView({ onSelectReportDate }: EodHistoryViewProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FINALIZED" | "DRAFT">("ALL");

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await getEodReportsHistoryAction();
      setHistory(data);
    } catch (err) {
      console.error("[EodHistoryView] Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filtered = history.filter((item) => {
    const matchesSearch =
      item.reportNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.businessDate.includes(searchQuery) ||
      (item.preparedByName || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ? true : item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Header & Search / Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
        <div>
          <h3 className="font-bold text-base text-[#141B47] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#355DAF]" />
            Historical End-of-Day Reports Archive
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Audit logs and frozen reconciliation records of past business days.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search date or ref..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-[#CBD5E1] rounded-xl focus:outline-hidden focus:border-[#355DAF]"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
            {(["ALL", "FINALIZED", "DRAFT"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === s
                    ? "bg-[#141B47] text-white"
                    : "text-[#64748B] hover:text-[#141B47]"
                }`}
              >
                {s === "ALL" ? "All" : s === "FINALIZED" ? "Finalized" : "Draft"}
              </button>
            ))}
          </div>

          <button
            onClick={loadHistory}
            className="p-2 text-[#64748B] hover:text-[#141B47] hover:bg-[#F1F5F9] rounded-xl cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] animate-pulse">
          Loading report history archives...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
          No archived End-of-Day reports found matching your criteria.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-3.5">Business Date</th>
                <th className="py-3 px-3.5">Report Number</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5 text-right">Invoiced</th>
                <th className="py-3 px-3.5 text-right">Collections</th>
                <th className="py-3 px-3.5 text-right">Expenses</th>
                <th className="py-3 px-3.5 text-right">Net Cash</th>
                <th className="py-3 px-3.5">Prepared By</th>
                <th className="py-3 px-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-3.5 font-bold text-[#141B47] flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#355DAF]" />
                    {item.businessDate}
                  </td>
                  <td className="py-3 px-3.5 font-mono text-[#64748B] font-semibold">
                    {item.reportNumber}
                  </td>
                  <td className="py-3 px-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.status === "FINALIZED"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {item.status === "FINALIZED" ? (
                        <>
                          <Lock className="w-3 h-3" /> Finalized
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3" /> Draft
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-[#141B47]">
                    {formatCurrency(item.totalInvoiced)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-black text-emerald-700">
                    {formatCurrency(item.totalCollections)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-rose-700">
                    {formatCurrency(item.totalExpenses)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-bold text-[#141B47]">
                    {formatCurrency(item.netCashMovement)}
                  </td>
                  <td className="py-3 px-3.5 text-[#64748B]">
                    {item.finalizedByName || item.preparedByName}
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <button
                      onClick={() => onSelectReportDate(item.businessDate)}
                      className="px-2.5 py-1 text-[11px] font-bold text-[#141B47] hover:bg-gray-100 rounded-md border border-[#CBD5E1] transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
