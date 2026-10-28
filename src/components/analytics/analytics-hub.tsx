"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Activity,
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  History,
  Lock,
  PlusCircle,
  Receipt,
  RefreshCw,
  Truck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  getLiveAnalyticsDashboardAction,
  DashboardFilter,
  LiveDashboardMetrics,
} from "@/app/actions/analytics";
import { DateFilterBar } from "./date-filter-bar";
import { LiveSummaryCards } from "./live-summary-cards";
import { ChartsAndInsights } from "./charts-and-insights";
import { EodReportView } from "./eod-report-view";
import { EodHistoryView } from "./eod-history-view";
import { ExpensesManager } from "./expenses-manager";
import { AdminCustomerAnalytics } from "@/components/admin-customer-analytics";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

type TabId = "dashboard" | "charts" | "eod" | "history" | "expenses" | "engagement";

export function AnalyticsHub() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [filter, setFilter] = useState<DashboardFilter>("this_month");
  const [customRange, setCustomRange] = useState<{ start?: string; end?: string }>({});
  const [metrics, setMetrics] = useState<LiveDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [isPending, startTransition] = useTransition();

  // For navigating from history directly to an EOD report
  const [selectedEodDate, setSelectedEodDate] = useState<string | null>(null);

  // Load Dashboard metrics from server
  const loadMetrics = useCallback(
    async (
      f: DashboardFilter = filter,
      start?: string,
      end?: string,
      isBackground: boolean = false
    ) => {
      if (!isBackground) setLoading(true);
      try {
        const data = await getLiveAnalyticsDashboardAction(f, start, end);
        setMetrics(data);
        setIsLive(true);
      } catch (err) {
        console.error("[AnalyticsHub] Failed to fetch live metrics:", err);
        setIsLive(false);
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [filter]
  );

  // Initial load
  useEffect(() => {
    loadMetrics(filter, customRange.start, customRange.end);
  }, [filter, customRange.start, customRange.end, loadMetrics]);

  // Periodic Live Background Polling (every 15 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadMetrics(filter, customRange.start, customRange.end, true);
      }
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadMetrics(filter, customRange.start, customRange.end, true);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [filter, customRange, loadMetrics]);

  // Supabase Realtime Listener Setup (when configured)
  useEffect(() => {
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const channel = supabase
        .channel("analytics-live-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Invoice" },
          () => loadMetrics(filter, customRange.start, customRange.end, true)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "InvoicePayment" },
          () => loadMetrics(filter, customRange.start, customRange.end, true)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Payment" },
          () => loadMetrics(filter, customRange.start, customRange.end, true)
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "Expense" },
          () => loadMetrics(filter, customRange.start, customRange.end, true)
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsLive(true);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setIsLive(false);
          }
        });

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Fallback gracefully to background polling
    }
  }, [filter, customRange, loadMetrics]);

  const handleFilterChange = (f: DashboardFilter, start?: string, end?: string) => {
    setFilter(f);
    if (start && end) {
      setCustomRange({ start, end });
    } else {
      setCustomRange({});
    }
    loadMetrics(f, start, end);
  };

  const handleSelectHistoryReport = (date: string) => {
    setSelectedEodDate(date);
    setActiveTab("eod");
  };

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Live Dashboard", icon: Activity },
    { id: "charts", label: "Financial Trends & Charts", icon: BarChart3 },
    { id: "eod", label: "End-of-Day (EOD) Report", icon: FileText },
    { id: "history", label: "EOD Archives", icon: History },
    { id: "expenses", label: "Expenses Ledger", icon: Receipt },
    { id: "engagement", label: "Customer Activity", icon: Users },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── TOP HEADER (Branded & Real-time Status) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-[#141B47] flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-[#F2901F]" />
              Business Intelligence &amp; Reporting
            </h1>
            <span className="text-[11px] font-black px-2.5 py-0.5 bg-[#141B47] text-white rounded-md tracking-wider uppercase">
              LIVE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Real-time financial monitoring, operational ledgers, daily reconciliation, and end-of-day sign-off.
          </p>
        </div>

        {/* Real-time Connection Indicator */}
        <div className="flex items-center gap-2 p-1.5 px-3 bg-white border border-[#E5E7EB] rounded-xl shadow-2xs text-xs">
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
          <span className="font-semibold text-[#141B47]">
            {isLive ? "Live Sync Active" : "Polling Mode"}
          </span>
          <button
            onClick={() => loadMetrics(filter, customRange.start, customRange.end)}
            className="ml-1 p-1 text-[#64748B] hover:text-[#141B47] transition-colors cursor-pointer"
            title="Manual sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#355DAF]" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── NAVIGATION TABS ── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap min-h-[38px] ${
                active
                  ? "bg-[#141B47] text-white shadow-xs"
                  : "text-[#64748B] hover:text-[#141B47] hover:bg-[#F8FAFC]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT ── */}

      {/* 1. Live Dashboard Tab */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <DateFilterBar
            currentFilter={filter}
            onFilterChange={handleFilterChange}
            isLoading={loading}
            onRefresh={() => loadMetrics(filter, customRange.start, customRange.end)}
            lastSyncTime={metrics?.lastSyncTime}
            isLive={isLive}
          />

          <LiveSummaryCards metrics={metrics} isLoading={loading} />

          <ChartsAndInsights metrics={metrics} />
        </div>
      )}

      {/* 2. Charts and Financial Trends Tab */}
      {activeTab === "charts" && (
        <div className="space-y-6">
          <DateFilterBar
            currentFilter={filter}
            onFilterChange={handleFilterChange}
            isLoading={loading}
            onRefresh={() => loadMetrics(filter, customRange.start, customRange.end)}
            lastSyncTime={metrics?.lastSyncTime}
            isLive={isLive}
          />

          <ChartsAndInsights metrics={metrics} />
        </div>
      )}

      {/* 3. End-of-Day (EOD) Report Tab */}
      {activeTab === "eod" && (
        <div className="space-y-6">
          <EodReportView
            onRefreshParent={() => loadMetrics(filter, customRange.start, customRange.end, true)}
          />
        </div>
      )}

      {/* 4. Historical Reports Archives Tab */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <EodHistoryView onSelectReportDate={handleSelectHistoryReport} />
        </div>
      )}

      {/* 5. Operational Expenses Ledger Tab */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          <ExpensesManager
            onRefreshParent={() => loadMetrics(filter, customRange.start, customRange.end, true)}
          />
        </div>
      )}

      {/* 6. Customer Engagement Tab (Preserves existing analytics!) */}
      {activeTab === "engagement" && (
        <div className="space-y-6">
          <AdminCustomerAnalytics />
        </div>
      )}
    </div>
  );
}
