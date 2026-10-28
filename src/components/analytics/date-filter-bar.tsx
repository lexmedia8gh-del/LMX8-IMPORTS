"use client";

import React, { useState } from "react";
import { Calendar, RefreshCw, Filter, ArrowRight } from "lucide-react";
import { DashboardFilter } from "@/app/actions/analytics";

interface DateFilterBarProps {
  currentFilter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter, start?: string, end?: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  lastSyncTime?: string;
  isLive?: boolean;
}

export function DateFilterBar({
  currentFilter,
  onFilterChange,
  isLoading,
  onRefresh,
  lastSyncTime,
  isLive = true,
}: DateFilterBarProps) {
  const [showCustom, setShowCustom] = useState(currentFilter === "custom");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const filters: { id: DashboardFilter; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "this_week", label: "This Week" },
    { id: "this_month", label: "This Month" },
    { id: "this_quarter", label: "This Quarter" },
    { id: "this_year", label: "This Year" },
    { id: "custom", label: "Custom Range" },
  ];

  const handleSelect = (filterId: DashboardFilter) => {
    if (filterId === "custom") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onFilterChange(filterId);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart && customEnd) {
      onFilterChange("custom", customStart, customEnd);
    }
  };

  const formattedSync = lastSyncTime
    ? new Date(lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "Just now";

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        {/* Preset Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl w-full lg:w-auto overflow-x-auto">
          {filters.map((f) => {
            const active = currentFilter === f.id && (!showCustom || f.id === "custom");
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleSelect(f.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
                  active
                    ? "bg-[#141B47] text-white shadow-xs"
                    : "text-[#64748B] hover:text-[#141B47] hover:bg-white"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Live Status and Refresh Action */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-2 lg:pt-0 border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isLive ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <span className="text-xs font-semibold text-[#141B47]">
              {isLive ? "Live Connected" : "Sync Paused"}
            </span>
            <span className="text-[11px] text-[#94A3B8] hidden sm:inline">
              • Updated {formattedSync}
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#141B47] bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg transition-colors cursor-pointer min-h-[34px]"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#355DAF] ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Custom Range Drawer/Inputs */}
      {showCustom && (
        <form
          onSubmit={handleApplyCustom}
          className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-[#F1F5F9] text-xs text-[#141B47]"
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F2901F]" />
            <span className="font-semibold text-[#64748B]">Date Range:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg bg-white text-xs font-medium focus:outline-hidden focus:border-[#355DAF]"
              required
            />
            <span className="text-[#94A3B8]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1.5 border border-[#CBD5E1] rounded-lg bg-white text-xs font-medium focus:outline-hidden focus:border-[#355DAF]"
              required
            />
            <button
              type="submit"
              disabled={isLoading || !customStart || !customEnd}
              className="px-3.5 py-1.5 bg-[#141B47] hover:bg-[#1C255E] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              <span>Apply</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
