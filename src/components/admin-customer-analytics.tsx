"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Users, UserCheck, Eye, LogIn, AlertTriangle, ShieldCheck,
  Calendar, RefreshCw, ChevronRight, Activity, ArrowUpRight,
  TrendingUp, Clock, Globe, ShieldAlert, CreditCard, DollarSign,
  Box, Truck, CheckCircle2, PackageCheck, FileText, Layers,
  ShoppingBag, Sparkles
} from "lucide-react";
import {
  getCustomerAnalyticsAction,
  AnalyticsPeriod,
  AnalyticsSummary,
} from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

export function AdminCustomerAnalytics() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(async (p: AnalyticsPeriod, start?: string, end?: string) => {
    setLoading(true);
    try {
      const data = await getCustomerAnalyticsAction(p, start, end);
      setSummary(data);
    } catch (err) {
      console.error("[AdminCustomerAnalytics] Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(period);
  }, [period, loadData]);

  const handlePeriodChange = (p: AnalyticsPeriod) => {
    setPeriod(p);
    setCustomStart("");
    setCustomEnd("");
  };

  const handleCustomFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStart) {
      startTransition(() => {
        loadData(period, customStart, customEnd || undefined);
      });
    }
  };

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  // Calculate highest daily activity for bar scaling
  const maxActivity = summary?.dailyActivity.reduce(
    (max, item) => Math.max(max, item.logins, item.pageViews),
    1
  ) || 1;

  // Calculate highest monthly revenue for chart scaling
  const maxMonthlyRevenue = summary?.monthlyRevenue.reduce(
    (max, item) => Math.max(max, item.revenue),
    100
  ) || 100;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── TOP BAR & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#141B47] flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-[#F2901F]" />
            Live Customer &amp; Business Analytics
          </h2>
          <p className="text-xs sm:text-sm text-[#667085] mt-1">
            Real-time financial revenue, shipment milestones, customer accounts, and portal activity.
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xs w-full sm:w-auto">
          {(
            [
              { id: "today", label: "Today" },
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "all", label: "All Time" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => handlePeriodChange(t.id)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[38px] ${
                period === t.id && !customStart
                  ? "bg-[#141B47] text-white shadow-xs"
                  : "text-[#667085] hover:text-[#141B47] hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => loadData(period, customStart || undefined, customEnd || undefined)}
            className="p-2 rounded-xl text-[#667085] hover:text-[#141B47] hover:bg-gray-50 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Refresh analytics data"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-[#F2901F]" : ""} />
          </button>
        </div>
      </div>

      {/* ── CUSTOM DATE RANGE FORM (OPTIONAL) ── */}
      <form onSubmit={handleCustomFilter} className="flex flex-wrap items-center gap-2 text-xs bg-white p-3.5 rounded-2xl border border-[#E5E7EB] shadow-2xs">
        <span className="font-bold text-[#667085] flex items-center gap-1">
          <Calendar size={14} className="text-[#F2901F]" /> Custom Range:
        </span>
        <input
          type="date"
          value={customStart}
          onChange={(e) => setCustomStart(e.target.value)}
          className="h-9 px-3 rounded-xl border border-[#E5E7EB] text-xs text-[#172236] bg-gray-50 focus:bg-white focus:outline-none focus:border-[#F2901F]"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={customEnd}
          onChange={(e) => setCustomEnd(e.target.value)}
          className="h-9 px-3 rounded-xl border border-[#E5E7EB] text-xs text-[#172236] bg-gray-50 focus:bg-white focus:outline-none focus:border-[#F2901F]"
        />
        <button
          type="submit"
          className="px-4 h-9 rounded-xl bg-[#141B47] text-white font-bold hover:bg-[#355DAF] transition-colors cursor-pointer"
        >
          Apply Filter
        </button>
        {customStart && (
          <button
            type="button"
            onClick={() => {
              setCustomStart("");
              setCustomEnd("");
              loadData(period);
            }}
            className="text-xs text-[#EF4444] hover:underline cursor-pointer ml-1"
          >
            Clear Filter
          </button>
        )}
      </form>

      {/* ── SECTION 1: FINANCIAL & REVENUE PERFORMANCE (VERIFIED ONLY) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-600" />
            Financial &amp; Revenue Metrics (Verified Transactions)
          </h3>
          <span className="text-xs text-[#667085]">Verified via Paystack</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Revenue */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#141B47] tabular-nums">
              {formatCurrency(summary?.totalRevenue ?? 0)}
            </p>
            <div className="text-[11px] text-[#667085] flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
              <span>Period: <strong className="text-emerald-700">{formatCurrency(summary?.periodRevenue ?? 0)}</strong></span>
              <span>{summary?.successfulPaymentsCount ?? 0} paid</span>
            </div>
          </div>

          {/* Shipping Fees Collected */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-xs font-bold uppercase tracking-wider">Shipping Fees</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Truck size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#141B47] tabular-nums">
              {formatCurrency(summary?.shippingFeeRevenue ?? 0)}
            </p>
            <div className="text-[11px] text-[#667085] pt-1 border-t border-[#F1F5F9]">
              <span>Direct cargo &amp; logistics freight settlements</span>
            </div>
          </div>

          {/* Sourcing Credits Purchased */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-xs font-bold uppercase tracking-wider">Credit Purchases</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-[#141B47] tabular-nums">
              {formatCurrency(summary?.creditPurchaseRevenue ?? 0)}
            </p>
            <div className="text-[11px] text-[#667085] pt-1 border-t border-[#F1F5F9]">
              <span>Packages sold for verified product sourcing</span>
            </div>
          </div>

          {/* Outstanding Balances */}
          <div className="p-5 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-xs font-bold uppercase tracking-wider">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <CreditCard size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 tabular-nums">
              {formatCurrency(summary?.outstandingBalances ?? 0)}
            </p>
            <div className="text-[11px] text-[#667085] flex items-center justify-between pt-1 border-t border-[#F1F5F9]">
              <span>Pending Invoices: <strong>{summary?.pendingPaymentsCount ?? 0}</strong></span>
              <span>{formatCurrency(summary?.pendingPaymentsAmount ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: LOGISTICS & SHIPMENTS OVERVIEW ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-2">
          <Box size={16} className="text-[#F2901F]" />
          Logistics, Consignments &amp; Sourcing Status
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Total Shipments */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Cargo</span>
              <Box size={15} className="text-[#355DAF]" />
            </div>
            <p className="text-2xl font-extrabold text-[#141B47] tabular-nums">
              {summary?.totalShipments ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block">
              {summary?.shipmentsInPeriod ?? 0} added in period
            </span>
          </div>

          {/* Active Shipments */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active</span>
              <Truck size={15} className="text-[#F2901F]" />
            </div>
            <p className="text-2xl font-extrabold text-[#F2901F] tabular-nums">
              {summary?.activeShipments ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block">
              In transit &amp; clearance
            </span>
          </div>

          {/* In Transit */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">In Transit</span>
              <Activity size={15} className="text-blue-600" />
            </div>
            <p className="text-2xl font-extrabold text-blue-600 tabular-nums">
              {summary?.inTransitShipments ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block">
              Air / Sea en route
            </span>
          </div>

          {/* Completed Shipments */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Delivered</span>
              <CheckCircle2 size={15} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-600 tabular-nums">
              {summary?.completedShipments ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block">
              Delivered to client
            </span>
          </div>

          {/* Sourcing Requests */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-1.5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sourcing</span>
              <ShoppingBag size={15} className="text-purple-600" />
            </div>
            <p className="text-2xl font-extrabold text-purple-700 tabular-nums">
              {summary?.totalSourcingRequests ?? 0}
            </p>
            <span className="text-[10px] text-amber-600 font-semibold block">
              {summary?.pendingSourcingRequests ?? 0} awaiting quote
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: MONTHLY REVENUE CHART (LAST 12 MONTHS) ── */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
          <div>
            <h3 className="text-base font-bold text-[#141B47]">Monthly Revenue Performance</h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Verified collections grouped by calendar month and payment type.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#141B47]">
              <span className="w-3 h-3 rounded-sm bg-[#141B47] inline-block" /> Shipping Fees
            </span>
            <span className="flex items-center gap-1.5 text-[#F2901F]">
              <span className="w-3 h-3 rounded-sm bg-[#F2901F] inline-block" /> Credit Purchases
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-14 text-center text-xs text-[#667085]">
            <RefreshCw size={18} className="animate-spin inline-block mr-2 text-[#F2901F]" /> Loading revenue history...
          </div>
        ) : !summary?.monthlyRevenue || summary.monthlyRevenue.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#667085]">
            No verified transactions recorded yet.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2.5 items-end min-h-[160px] pt-4">
              {summary.monthlyRevenue.map((m, idx) => {
                const totalH = Math.max(8, Math.round((m.revenue / maxMonthlyRevenue) * 120));
                const shippingH = Math.max(0, Math.round((m.shippingFeeRevenue / maxMonthlyRevenue) * 120));
                const creditH = Math.max(0, Math.round((m.creditPurchaseRevenue / maxMonthlyRevenue) * 120));

                return (
                  <div key={idx} className="flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-bold text-[#141B47] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatCurrency(m.revenue)}
                    </span>
                    <div className="flex items-end gap-1 h-[120px] w-full justify-center">
                      <div
                        style={{ height: `${shippingH}px` }}
                        className="w-2.5 sm:w-3 bg-[#141B47] rounded-t-sm transition-all group-hover:opacity-80"
                        title={`${m.displayMonth} Shipping: ${formatCurrency(m.shippingFeeRevenue)}`}
                      />
                      <div
                        style={{ height: `${creditH}px` }}
                        className="w-2.5 sm:w-3 bg-[#F2901F] rounded-t-sm transition-all group-hover:opacity-80"
                        title={`${m.displayMonth} Credits: ${formatCurrency(m.creditPurchaseRevenue)}`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[#667085] truncate max-w-full text-center">
                      {m.displayMonth}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 4: CUSTOMER ACTIVITY & PORTAL ENGAGEMENT ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-2">
          <Users size={16} className="text-[#355DAF]" />
          Customer Accounts, Access &amp; Portal Activity
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Registered Customers */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Registered</span>
              <Users size={16} className="text-[#355DAF]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#141B47] tabular-nums">
              {summary?.registeredCustomers ?? 0}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold block truncate">
              +{summary?.newCustomersInPeriod ?? 0} in selected period
            </span>
          </div>

          {/* Successful Logins */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Logins</span>
              <LogIn size={16} className="text-[#10B981]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#141B47] tabular-nums">
              {summary?.totalSuccessfulLogins ?? 0}
            </p>
            <span className="text-[10px] text-emerald-600 font-semibold block truncate">
              {summary?.uniqueCustomersLoggedIn ?? 0} unique users
            </span>
          </div>

          {/* Page Views */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Page Views</span>
              <Eye size={16} className="text-[#F2901F]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#141B47] tabular-nums">
              {summary?.totalPageViews ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block truncate">Authenticated views</span>
          </div>

          {/* Unique Active Customers */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Active</span>
              <UserCheck size={16} className="text-[#355DAF]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#141B47] tabular-nums">
              {summary?.uniqueActiveCustomers ?? 0}
            </p>
            <span className="text-[10px] text-[#667085] block truncate">Active in period</span>
          </div>

          {/* Failed Login Attempts */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Failed PINs</span>
              <ShieldAlert size={16} className="text-[#EF4444]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#141B47] tabular-nums">
              {summary?.failedLoginAttempts ?? 0}
            </p>
            <span className="text-[10px] text-red-600 font-semibold block truncate">
              Blocked &amp; recorded
            </span>
          </div>

          {/* Security / System Integrity */}
          <div className="p-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[#667085]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Security</span>
              <ShieldCheck size={16} className="text-[#10B981]" />
            </div>
            <p className="text-2xl font-bold font-heading text-[#10B981]">
              100%
            </p>
            <span className="text-[10px] text-[#667085] block truncate">bcrypt + rate-limited</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: DAILY ACTIVITY BREAKDOWN (CHART) ── */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E5E7EB] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
          <div>
            <h3 className="text-base font-bold text-[#141B47]">Daily Activity &amp; Traffic Trends</h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Daily customer logins, authenticated portal views, and revenue collections.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#141B47]">
              <span className="w-3 h-3 rounded-sm bg-[#141B47] inline-block" /> Logins
            </span>
            <span className="flex items-center gap-1.5 text-[#F2901F]">
              <span className="w-3 h-3 rounded-sm bg-[#F2901F] inline-block" /> Page Views
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-[#667085]">
            <RefreshCw size={18} className="animate-spin inline-block mr-2 text-[#F2901F]" /> Loading activity trends...
          </div>
        ) : !summary?.dailyActivity || summary.dailyActivity.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#667085]">No activity data recorded in this period.</div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end min-h-[140px] pt-4">
              {summary.dailyActivity.slice(-14).map((pt, idx) => {
                const loginHeight = Math.max(4, Math.round((pt.logins / maxActivity) * 110));
                const viewHeight = Math.max(4, Math.round((pt.pageViews / maxActivity) * 110));

                return (
                  <div key={idx} className="flex flex-col items-center gap-1 group">
                    <div className="flex items-end gap-1 h-[110px] w-full justify-center">
                      <div
                        style={{ height: `${loginHeight}px` }}
                        className="w-2.5 sm:w-3.5 bg-[#141B47] rounded-t-sm transition-all group-hover:opacity-80"
                        title={`${pt.displayDate}: ${pt.logins} login(s)`}
                      />
                      <div
                        style={{ height: `${viewHeight}px` }}
                        className="w-2.5 sm:w-3.5 bg-[#F2901F] rounded-t-sm transition-all group-hover:opacity-80"
                        title={`${pt.displayDate}: ${pt.pageViews} page view(s)`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[#667085] truncate max-w-full">
                      {pt.displayDate}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 6: MOST VISITED PAGES & RECENTLY ACTIVE CUSTOMERS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Visited Pages */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#141B47] flex items-center gap-2">
              <Globe size={16} className="text-[#355DAF]" /> Most Visited Pages
            </h3>
            <span className="text-[11px] text-[#667085] font-semibold">
              {summary?.totalPageViews ?? 0} views total
            </span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {loading ? (
              <div className="py-10 text-center text-xs text-[#667085]">Loading...</div>
            ) : !summary?.mostVisitedPages || summary.mostVisitedPages.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#667085]">No page visits yet.</div>
            ) : (
              summary.mostVisitedPages.map((item, idx) => {
                const total = summary?.totalPageViews || 1;
                const percentage = Math.round((item.count / total) * 100);

                return (
                  <div key={idx} className="p-3.5 sm:p-4 hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#172236] truncate">{item.label}</p>
                      <p className="text-[11px] font-mono text-[#667085] truncate">{item.path}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-[#141B47] tabular-nums">{item.count} views</span>
                      <span className="text-[10px] text-[#667085] block">{percentage}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recently Active Customers */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#141B47] flex items-center gap-2">
              <UserCheck size={16} className="text-[#10B981]" /> Recently Active Customers
            </h3>
            <span className="text-[11px] text-[#667085] font-semibold">Live portal activity</span>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {loading ? (
              <div className="py-10 text-center text-xs text-[#667085]">Loading...</div>
            ) : !summary?.recentActiveCustomers || summary.recentActiveCustomers.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#667085]">No customer sessions recorded yet.</div>
            ) : (
              summary.recentActiveCustomers.map((cust, idx) => (
                <div key={idx} className="p-3.5 sm:p-4 hover:bg-gray-50/60 transition-colors flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-[#172236] truncate">{cust.name}</p>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        {cust.customerIdentifier}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#667085] mt-0.5 truncate">
                      Viewing: <span className="font-semibold text-gray-700">{cust.lastPath}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-bold text-[#355DAF] block">{timeAgo(cust.lastActive)}</span>
                    <span className="text-[10px] text-[#667085]">{cust.pageViewsCount} action(s)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 7: RECENT LOGIN ATTEMPTS AUDIT LOG ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#141B47] flex items-center gap-2">
              <Clock size={16} className="text-[#F2901F]" /> Recent Customer Authentication Attempts
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Secure record of successful logins and blocked PIN attempts.
            </p>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#667085]">
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[11px]">Customer</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[11px]">Identifier</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[11px]">Method</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-5 py-3 font-bold uppercase tracking-wider text-[11px]">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#667085]">Loading logins...</td>
                </tr>
              ) : !summary?.recentLogins || summary.recentLogins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#667085]">No login records found.</td>
                </tr>
              ) : (
                summary.recentLogins.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-[#172236]">{item.name}</td>
                    <td className="px-5 py-3.5 font-mono text-[#141B47] font-semibold">{item.customerIdentifier}</td>
                    <td className="px-5 py-3.5 text-[#667085]">{item.authMethod}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#667085] tabular-nums">{timeAgo(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden divide-y divide-[#F1F5F9]">
          {loading ? (
            <div className="py-8 text-center text-xs text-[#667085]">Loading logins...</div>
          ) : !summary?.recentLogins || summary.recentLogins.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#667085]">No login records found.</div>
          ) : (
            summary.recentLogins.map((item) => (
              <div key={item.id} className="p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#172236]">{item.name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      item.status === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#667085]">
                  <span className="font-mono">{item.customerIdentifier}</span>
                  <span>{timeAgo(item.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
