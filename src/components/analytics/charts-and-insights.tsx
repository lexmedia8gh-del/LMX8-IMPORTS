"use client";

import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  CreditCard,
  Receipt,
  Truck,
  AlertTriangle,
  CheckCircle,
  Info,
  ArrowRight,
  PieChart,
  BarChart3,
} from "lucide-react";
import { LiveDashboardMetrics } from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

interface ChartsAndInsightsProps {
  metrics: LiveDashboardMetrics | null;
}

export function ChartsAndInsights({ metrics }: ChartsAndInsightsProps) {
  if (!metrics) return null;

  // Max value for scaling financial trend bars
  const maxTrendVal = Math.max(
    100,
    ...metrics.dailyFinancialTrends.flatMap((d) => [d.invoiced, d.collections, d.expenses])
  );

  return (
    <div className="space-y-6">
      {/* ── ACTIONABLE VERIFIED BUSINESS INSIGHTS ── */}
      {metrics.insights && metrics.insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.insights.map((ins, i) => {
            const isPos = ins.type === "positive";
            const isWarn = ins.type === "warning";
            const Icon = isPos ? CheckCircle : isWarn ? AlertTriangle : Info;
            const borderCol = isPos
              ? "border-emerald-200 bg-emerald-50/70"
              : isWarn
              ? "border-amber-200 bg-amber-50/70"
              : "border-blue-200 bg-blue-50/70";
            const iconCol = isPos
              ? "text-emerald-700"
              : isWarn
              ? "text-amber-700"
              : "text-blue-700";

            return (
              <div
                key={i}
                className={`p-3.5 rounded-2xl border ${borderCol} flex items-start gap-3`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconCol}`} />
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-[#141B47]">{ins.title}</h4>
                  <p className="text-[#475569] leading-relaxed">{ins.message}</p>
                  {ins.actionHref && (
                    <Link
                      href={ins.actionHref}
                      className="inline-flex items-center gap-1 font-bold text-[#141B47] hover:underline pt-1 text-[11px]"
                    >
                      <span>{ins.actionLabel || "Review Details"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CHARTS ROW: FINANCIAL TRENDS & BREAKDOWNS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Financial Movements Trend (Invoiced vs Collections vs Expenses) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#141B47] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#355DAF]" />
                Daily Financial Flow ({metrics.dateRange.displayLabel})
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Comparison of invoiced billings, collections received, and operational expenses.
              </p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#141B47]"></span> Invoiced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span> Collections
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span> Expenses
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          {metrics.dailyFinancialTrends.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              No transactions recorded in this period.
            </div>
          ) : (
            <div className="pt-4 overflow-x-auto">
              <div className="flex items-end justify-between gap-2 sm:gap-3 min-w-[500px] h-52 pb-6 border-b border-[#E2E8F0]">
                {metrics.dailyFinancialTrends.map((d, idx) => {
                  const invHeight = Math.max(4, Math.round((d.invoiced / maxTrendVal) * 160));
                  const colHeight = Math.max(4, Math.round((d.collections / maxTrendVal) * 160));
                  const expHeight = Math.max(4, Math.round((d.expenses / maxTrendVal) * 160));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      {/* Hover Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-[#141B47] text-white text-[10px] p-2 rounded-lg shadow-lg pointer-events-none z-10 whitespace-nowrap">
                        <div className="font-bold">{d.displayDate}</div>
                        <div>Invoiced: {formatCurrency(d.invoiced)}</div>
                        <div className="text-emerald-300">Collections: {formatCurrency(d.collections)}</div>
                        <div className="text-rose-300">Expenses: {formatCurrency(d.expenses)}</div>
                      </div>

                      {/* Triple Bars */}
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-44">
                        <div
                          style={{ height: `${invHeight}px` }}
                          className="w-1.5 sm:w-2.5 bg-[#141B47] rounded-t-xs transition-all group-hover:opacity-80"
                        />
                        <div
                          style={{ height: `${colHeight}px` }}
                          className="w-1.5 sm:w-2.5 bg-emerald-500 rounded-t-xs transition-all group-hover:opacity-80"
                        />
                        <div
                          style={{ height: `${expHeight}px` }}
                          className="w-1.5 sm:w-2.5 bg-rose-500 rounded-t-xs transition-all group-hover:opacity-80"
                        />
                      </div>

                      {/* Date label */}
                      <span className="text-[10px] font-semibold text-[#64748B] mt-2 truncate w-full text-center">
                        {d.displayDate.split(",")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Collections by Payment Method Breakdown */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-[#F1F5F9]">
            <h3 className="font-bold text-sm sm:text-base text-[#141B47] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Collections by Method
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Breakdown of funds collected across channels.
            </p>
          </div>

          {metrics.collectionsByMethod.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#94A3B8]">
              No payments collected during this period.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {metrics.collectionsByMethod.map((item) => (
                <div key={item.method} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#141B47] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#141B47]"></span>
                      {item.label}
                    </span>
                    <div className="text-right">
                      <span className="font-bold text-[#141B47]">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] text-[#64748B] ml-1.5 font-medium">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, item.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SECOND ROW: EXPENSES BY CATEGORY & SHIPMENT STATUS BREAKDOWN ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses by Category Breakdown */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-[#F1F5F9] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#141B47] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                Operational Expenses by Category
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Breakdown of operational outflows for the selected period.
              </p>
            </div>
            <span className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
              {formatCurrency(metrics.totalExpenses.current)} Total
            </span>
          </div>

          {metrics.expensesByCategory.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#94A3B8]">
              No expenses recorded for this date range.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {metrics.expensesByCategory.map((exp) => (
                <div key={exp.category} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-[#141B47]">{exp.label}</span>
                    <span className="font-bold text-[#141B47]">
                      {formatCurrency(exp.amount)}{" "}
                      <span className="text-[10px] text-[#64748B] font-normal">
                        ({exp.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(3, exp.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Shipments Status Distribution */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-[#F1F5F9] flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#141B47] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#355DAF]" />
                Cargo &amp; Logistics Milestones
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Current cargo tracking distribution across all consignments.
              </p>
            </div>
            <Link
              href="/admin/shipments"
              className="text-xs font-bold text-[#355DAF] hover:underline"
            >
              All Shipments
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {metrics.shipmentsStatusBreakdown.map((s) => (
              <div
                key={s.status}
                className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-center space-y-1"
              >
                <div className="text-lg font-black text-[#141B47]">
                  {s.count}
                </div>
                <div className="text-[11px] font-semibold text-[#64748B] line-clamp-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
