"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  CreditCard,
  AlertCircle,
  Clock,
  Truck,
  Receipt,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Package,
  CheckSquare,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { LiveDashboardMetrics, MetricCardValue } from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

interface LiveSummaryCardsProps {
  metrics: LiveDashboardMetrics | null;
  isLoading: boolean;
}

interface CardConfig {
  id: string;
  title: string;
  isCurrency?: boolean;
  value: number;
  prevValue: number;
  deltaPercent: number | null;
  isPositiveGood?: boolean;
  countSubtitle?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  href: string;
  routeLabel: string;
}

export function LiveSummaryCards({ metrics, isLoading }: LiveSummaryCardsProps) {
  if (isLoading && !metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 13 }).map((_, i) => (
          <div
            key={i}
            className="p-4 sm:p-5 bg-white border border-[#E5E7EB] rounded-2xl animate-pulse space-y-3"
          >
            <div className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded-md w-28" />
              <div className="w-9 h-9 bg-gray-200 rounded-xl" />
            </div>
            <div className="h-7 bg-gray-200 rounded-md w-36" />
            <div className="h-3.5 bg-gray-100 rounded-md w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-8 text-center bg-white border border-[#E5E7EB] rounded-2xl text-gray-500">
        No live metric data available for this date range.
      </div>
    );
  }

  const cards: CardConfig[] = [
    {
      id: "invoiced",
      title: "Total Invoiced",
      isCurrency: true,
      value: metrics.totalInvoiced.current,
      prevValue: metrics.totalInvoiced.previous,
      deltaPercent: metrics.totalInvoiced.deltaPercent,
      isPositiveGood: true,
      icon: FileText,
      iconColor: "text-[#141B47]",
      iconBg: "bg-blue-50",
      href: "/admin/invoices",
      routeLabel: "View Invoices",
    },
    {
      id: "collections",
      title: "Payments Received",
      isCurrency: true,
      value: metrics.totalCollections.current,
      prevValue: metrics.totalCollections.previous,
      deltaPercent: metrics.totalCollections.deltaPercent,
      isPositiveGood: true,
      icon: CreditCard,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      href: "/admin/invoices",
      routeLabel: "View Collections",
    },
    {
      id: "outstanding",
      title: "Outstanding Balances",
      isCurrency: true,
      value: metrics.outstandingBalances.current,
      prevValue: metrics.outstandingBalances.previous,
      deltaPercent: metrics.outstandingBalances.deltaPercent,
      isPositiveGood: false,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
      href: "/admin/invoices",
      routeLabel: "View Unpaid",
    },
    {
      id: "overdue",
      title: "Overdue Invoices",
      isCurrency: true,
      value: metrics.overdueInvoices.current,
      prevValue: metrics.overdueInvoices.previous,
      deltaPercent: metrics.overdueInvoices.deltaPercent,
      isPositiveGood: false,
      countSubtitle: `${metrics.overdueInvoices.count} overdue invoice(s)`,
      icon: AlertCircle,
      iconColor: "text-red-600",
      iconBg: "bg-red-50",
      href: "/admin/invoices",
      routeLabel: "Review Overdue",
    },
    {
      id: "shipping_revenue",
      title: "Shipping & Freight",
      isCurrency: true,
      value: metrics.shippingFreightRevenue.current,
      prevValue: metrics.shippingFreightRevenue.previous,
      deltaPercent: metrics.shippingFreightRevenue.deltaPercent,
      isPositiveGood: true,
      icon: Truck,
      iconColor: "text-[#355DAF]",
      iconBg: "bg-sky-50",
      href: "/admin/shipments",
      routeLabel: "View Shipments",
    },
    {
      id: "expenses",
      title: "Recorded Expenses",
      isCurrency: true,
      value: metrics.totalExpenses.current,
      prevValue: metrics.totalExpenses.previous,
      deltaPercent: metrics.totalExpenses.deltaPercent,
      isPositiveGood: false,
      icon: Receipt,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50",
      href: "/admin/analytics",
      routeLabel: "View Expenses",
    },
    {
      id: "net_cash",
      title: "Net Cash Movement",
      isCurrency: true,
      value: metrics.netCashMovement.current,
      prevValue: metrics.netCashMovement.previous,
      deltaPercent: metrics.netCashMovement.deltaPercent,
      isPositiveGood: true,
      icon: metrics.netCashMovement.current >= 0 ? TrendingUp : TrendingDown,
      iconColor: metrics.netCashMovement.current >= 0 ? "text-emerald-700" : "text-rose-700",
      iconBg: metrics.netCashMovement.current >= 0 ? "bg-emerald-50" : "bg-rose-50",
      href: "/admin/invoices",
      routeLabel: "Cash Movements",
    },
    {
      id: "invoices_created",
      title: "Invoices Created",
      value: metrics.invoicesCreatedCount.current,
      prevValue: metrics.invoicesCreatedCount.previous,
      deltaPercent: metrics.invoicesCreatedCount.deltaPercent,
      isPositiveGood: true,
      icon: FileText,
      iconColor: "text-[#141B47]",
      iconBg: "bg-slate-100",
      href: "/admin/invoices",
      routeLabel: "Manage Invoices",
    },
    {
      id: "invoices_settled",
      title: "Invoices Settled",
      value: metrics.invoicesSettledCount.current,
      prevValue: metrics.invoicesSettledCount.previous,
      deltaPercent: metrics.invoicesSettledCount.deltaPercent,
      isPositiveGood: true,
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
      href: "/admin/invoices",
      routeLabel: "Settled Invoices",
    },
    {
      id: "active_shipments",
      title: "Active Shipments",
      value: metrics.activeShipmentsCount.current,
      prevValue: metrics.activeShipmentsCount.previous,
      deltaPercent: null,
      icon: Package,
      iconColor: "text-[#F2901F]",
      iconBg: "bg-amber-50",
      href: "/admin/shipments",
      routeLabel: "Active Cargo",
    },
    {
      id: "completed_shipments",
      title: "Completed Deliveries",
      value: metrics.completedShipmentsCount.current,
      prevValue: metrics.completedShipmentsCount.previous,
      deltaPercent: metrics.completedShipmentsCount.deltaPercent,
      isPositiveGood: true,
      icon: CheckSquare,
      iconColor: "text-teal-600",
      iconBg: "bg-teal-50",
      href: "/admin/shipments",
      routeLabel: "Delivered Cargo",
    },
    {
      id: "new_clients",
      title: "New Clients",
      value: metrics.newClientsCount.current,
      prevValue: metrics.newClientsCount.previous,
      deltaPercent: metrics.newClientsCount.deltaPercent,
      isPositiveGood: true,
      icon: Users,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50",
      href: "/admin/customers",
      routeLabel: "Customer Base",
    },
    {
      id: "today_transactions",
      title: "Today's Transactions",
      value: metrics.todayTransactionsCount.current,
      prevValue: metrics.todayTransactionsCount.previous,
      deltaPercent: null,
      icon: Activity,
      iconColor: "text-[#141B47]",
      iconBg: "bg-blue-50",
      href: "/admin/analytics",
      routeLabel: "Daily Operations",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const hasDelta = card.deltaPercent !== null;
        const delta = card.deltaPercent ?? 0;
        const isUp = delta > 0;
        const isDown = delta < 0;

        // Determine green or red indicator based on positive / negative sentiment
        let deltaColor = "text-[#64748B] bg-[#F1F5F9]";
        if (hasDelta && delta !== 0) {
          if (card.isPositiveGood !== false) {
            deltaColor = isUp
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
              : "text-rose-700 bg-rose-50 border border-rose-200";
          } else {
            // For expenses / overdue, increase is alert, decrease is good
            deltaColor = isUp
              ? "text-rose-700 bg-rose-50 border border-rose-200"
              : "text-emerald-700 bg-emerald-50 border border-emerald-200";
          }
        }

        return (
          <div
            key={card.id}
            className="group p-4 sm:p-5 bg-white border border-[#E5E7EB] hover:border-[#CBD5E1] rounded-2xl shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
          >
            <div>
              {/* Header: Title and Icon */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-xl ${card.iconBg} ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              {/* Metric Value */}
              <div className="mt-2 text-xl sm:text-2xl font-black text-[#141B47] tracking-tight">
                {card.isCurrency ? formatCurrency(card.value) : card.value.toLocaleString()}
              </div>

              {/* Count Subtitle if applicable */}
              {card.countSubtitle && (
                <div className="text-[11px] font-semibold text-red-600 mt-0.5">
                  {card.countSubtitle}
                </div>
              )}
            </div>

            {/* Footer: Comparison with Previous Period & Clickable Route */}
            <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
              {/* Prior Period Delta */}
              <div className="flex items-center gap-1.5">
                {hasDelta && delta !== 0 ? (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${deltaColor}`}
                  >
                    {isUp ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {Math.abs(delta)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-[#94A3B8] bg-[#F8FAFC]">
                    <Minus className="w-2.5 h-2.5" /> 0%
                  </span>
                )}
                <span className="text-[11px] text-[#94A3B8] truncate max-w-[90px] sm:max-w-[120px]">
                  vs {metrics.previousDateRange.displayLabel}
                </span>
              </div>

              {/* Route Link */}
              <Link
                href={card.href}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#355DAF] hover:text-[#141B47] transition-colors"
              >
                <span>{card.routeLabel}</span>
                <ArrowUpRight className="w-3 h-3 opacity-70 group-hover:opacity-100" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
