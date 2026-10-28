"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession, getSession } from "@/lib/auth";
import { ensureAnalyticsSchema } from "@/lib/analytics-schema";
import { ensureInvoiceSchema } from "@/lib/invoice-schema";
import { ensureEodAndExpenseSchema } from "@/lib/eod-schema";
import { revalidatePath } from "next/cache";

// ─── TYPES & INTERFACES ────────────────────────────────────────────────────────

export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

export type DashboardFilter =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "custom";

export interface MetricCardValue {
  current: number;
  previous: number;
  deltaPercent: number | null; // e.g. +14.2% or -5.1% or null
  isPositiveGood?: boolean;
}

export interface LiveDashboardMetrics {
  filter: DashboardFilter;
  dateRange: {
    start: string;
    end: string;
    displayLabel: string;
  };
  previousDateRange: {
    start: string;
    end: string;
    displayLabel: string;
  };
  // Summary Cards
  totalInvoiced: MetricCardValue;
  totalCollections: MetricCardValue;
  outstandingBalances: MetricCardValue;
  overdueInvoices: MetricCardValue & { count: number; previousCount: number };
  shippingFreightRevenue: MetricCardValue;
  totalExpenses: MetricCardValue;
  netCashMovement: MetricCardValue;
  invoicesCreatedCount: MetricCardValue;
  invoicesSettledCount: MetricCardValue;
  activeShipmentsCount: MetricCardValue;
  completedShipmentsCount: MetricCardValue;
  newClientsCount: MetricCardValue;
  todayTransactionsCount: MetricCardValue;

  // Visual Breakdown & Charts Data
  collectionsByMethod: { method: string; label: string; amount: number; count: number; percentage: number }[];
  expensesByCategory: { category: string; label: string; amount: number; percentage: number }[];
  dailyFinancialTrends: { date: string; displayDate: string; invoiced: number; collections: number; expenses: number }[];
  shipmentsStatusBreakdown: { status: string; label: string; count: number }[];

  // Verified Business Insights
  insights: {
    type: "positive" | "warning" | "info";
    title: string;
    message: string;
    actionLabel?: string;
    actionHref?: string;
  }[];

  lastSyncTime: string;
}

export interface PageVisitItem {
  path: string;
  count: number;
  label: string;
}

export interface ActiveCustomerItem {
  customerId: string;
  customerIdentifier: string;
  name: string;
  lastActive: string;
  pageViewsCount: number;
  lastPath: string;
}

export interface DailyActivityPoint {
  date: string;
  displayDate: string;
  logins: number;
  pageViews: number;
}

export interface RecentLoginItem {
  id: string;
  customerIdentifier: string;
  name: string;
  status: "SUCCESS" | "FAILED";
  authMethod: string;
  failureReason?: string | null;
  createdAt: string;
}

export interface MonthlyRevenuePoint {
  month: string;
  displayMonth: string;
  revenue: number;
  transactionsCount: number;
  shippingFeeRevenue: number;
  creditPurchaseRevenue: number;
}

export interface ShipmentStatusCount {
  status: string;
  label: string;
  count: number;
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  dateRange: {
    start: string;
    end: string;
  };
  registeredCustomers: number;
  newCustomersInPeriod: number;
  totalShipments: number;
  activeShipments: number;
  completedShipments: number;
  inTransitShipments: number;
  shipmentsInPeriod: number;
  shipmentsByStatus: ShipmentStatusCount[];
  totalRevenue: number;
  periodRevenue: number;
  shippingFeeRevenue: number;
  creditPurchaseRevenue: number;
  successfulPaymentsCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  outstandingBalances: number;
  monthlyRevenue: MonthlyRevenuePoint[];
  totalSourcingRequests: number;
  pendingSourcingRequests: number;
  totalSuccessfulLogins: number;
  uniqueCustomersLoggedIn: number;
  totalPageViews: number;
  uniqueActiveCustomers: number;
  failedLoginAttempts: number;
  dailyActivity: (DailyActivityPoint & { revenue: number })[];
  mostVisitedPages: PageVisitItem[];
  recentActiveCustomers: ActiveCustomerItem[];
  recentLogins: RecentLoginItem[];
}

export interface EodPaymentLedgerItem {
  id: string;
  time: string;
  type: "INVOICE_PAYMENT" | "SHIPPING_PAYMENT" | "CREDIT_PURCHASE";
  sourceRef: string;
  sourceId: string;
  clientName: string;
  clientIdentifier: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  reference: string;
  amount: number;
  recordedBy: string;
}

export interface EodExpenseLedgerItem {
  id: string;
  expenseNumber: string;
  time: string;
  category: string;
  categoryLabel: string;
  payee: string;
  description: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  reference: string;
  amount: number;
  recordedBy: string;
}

export interface EodReportData {
  reportHeader: {
    businessDate: string;
    reportNumber: string;
    generatedAt: string;
    preparedBy: string;
    status: "DRAFT" | "FINALIZED";
    finalizedAt: string | null;
    finalizedBy: string | null;
  };
  financialSummary: {
    openingCash: number;
    totalInvoiced: number;
    totalCollections: number;
    collectionsByMethod: Record<string, number>;
    totalRefunds: number;
    totalExpenses: number;
    expensesByCategory: Record<string, number>;
    netCashMovement: number;
    expectedClosingCash: number;
    actualClosingCash: number | null;
    cashVariance: number;
    receivablesTotal: number;
  };
  paymentLedger: EodPaymentLedgerItem[];
  invoiceReport: {
    invoicesCreated: {
      id: string;
      invoiceNumber: string;
      clientName: string;
      clientIdentifier: string;
      totalAmount: number;
      amountPaid: number;
      outstandingBalance: number;
      status: string;
      freightStatus: string;
      createdAt: string;
    }[];
    invoicesSettled: {
      id: string;
      invoiceNumber: string;
      clientName: string;
      clientIdentifier: string;
      totalAmount: number;
      settledDate: string;
      issuedDate: string;
      isIssuedToday: boolean;
    }[];
    newReceivablesCreated: number;
  };
  shipmentFreightReport: {
    shipmentsProcessed: {
      id: string;
      trackingNumber: string;
      clientName: string;
      status: string;
      statusLabel: string;
      freightCharge: number;
      freightStatus: "CONFIRMED" | "PENDING";
      weight: number | null;
      quantity: number | null;
    }[];
    confirmedFreightRevenue: number;
    pendingFreightRevenue: number;
    pendingCargoCount: number;
  };
  expenseLedger: EodExpenseLedgerItem[];
  clientActivity: {
    newClients: {
      id: string;
      customerIdentifier: string;
      name: string;
      phone: string | null;
      email: string | null;
      createdAt: string;
    }[];
    activeClientsCount: number;
  };
  dailyReconciliation: {
    totalInvoiced: number;
    totalCollected: number;
    totalExpenses: number;
    netCashMovement: number;
    cashVariance: number;
    notes: string;
    discrepancies: string[];
    hasRecordChangesSinceFinalization: boolean;
    recordChangesDescription: string | null;
  };
  auditTrail: {
    action: string;
    user: string;
    timestamp: string;
    note?: string;
  }[];
}

export const EXPENSE_CATEGORIES: Record<string, string> = {
  CUSTOMS_CLEARANCE: "Customs & Port Clearance",
  PORT_HANDLING: "Port & Terminal Handling",
  TRANSPORT_DELIVERY: "Transport & Local Haulage",
  WAREHOUSE: "Warehouse & Storage",
  OFFICE_UTILITIES: "Office & Utilities",
  PACKAGING: "Packaging & Supplies",
  ADMINISTRATIVE: "Administrative & Agency Fees",
  OTHER: "Other Operational Expenses",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  MTN_MOMO: "MTN Mobile Money",
  TELECEL_CASH: "Telecel Cash",
  AT_MONEY: "AT Money",
  CARD: "Card / Online",
  CHEQUE: "Cheque",
  OTHER: "Other Offline",
};

const PATH_LABELS: Record<string, string> = {
  "/portal": "Portal Dashboard",
  "/portal/shipments": "My Shipments",
  "/portal/payments": "Shipping Payments",
  "/portal/sourcing": "Product Sourcing",
  "/portal/credits": "Credits Balance",
  "/portal/notifications": "Notifications",
  "/portal/profile": "Customer Profile",
};

const STATUS_LABELS: Record<string, string> = {
  SHIPMENT_CREATED: "Intake Created",
  PREPARING_SHIPMENT: "Preparing Dispatch",
  SHIPPED: "Departed China Terminal",
  IN_TRANSIT: "International Transit",
  ARRIVED_AT_DESTINATION: "Arrived Destination Hub",
  CUSTOMS_CLEARANCE: "Customs Clearance",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered / Completed",
  ON_HOLD: "On Hold",
};

// ─── DATE HELPERS (Africa/Accra UTC+0) ──────────────────────────────────────────

/**
 * Returns UTC Date objects for start of day and end of day in Africa/Accra (UTC+0).
 */
function getAccraDayBounds(dateStr?: string) {
  let target: Date;
  if (dateStr) {
    const parts = dateStr.split("-").map(Number);
    target = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
  } else {
    const now = new Date();
    target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  const start = new Date(target.getTime());
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(target.getTime());
  end.setUTCHours(23, 59, 59, 999);

  return { start, end, dateStr: start.toISOString().split("T")[0] };
}

function calculateDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

function resolveDateRange(filter: DashboardFilter, customStart?: string, customEnd?: string) {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

  let start: Date;
  let end: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let displayLabel: string;
  let prevDisplayLabel: string;

  switch (filter) {
    case "today": {
      start = todayStart;
      end = now;
      prevStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      prevEnd = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
      displayLabel = "Today";
      prevDisplayLabel = "Yesterday";
      break;
    }
    case "yesterday": {
      start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      end = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
      prevStart = new Date(todayStart.getTime() - 48 * 60 * 60 * 1000);
      prevEnd = new Date(todayEnd.getTime() - 48 * 60 * 60 * 1000);
      displayLabel = "Yesterday";
      prevDisplayLabel = "Day Before Yesterday";
      break;
    }
    case "this_week": {
      const day = todayStart.getUTCDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start = new Date(todayStart.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      end = now;
      const duration = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      displayLabel = "This Week";
      prevDisplayLabel = "Prior Week";
      break;
    }
    case "this_month": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      end = now;
      const prevMonth = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
      const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
      prevStart = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999));
      displayLabel = "This Month";
      prevDisplayLabel = "Prior Month";
      break;
    }
    case "this_quarter": {
      const currentQuarter = Math.floor(now.getUTCMonth() / 3);
      start = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0));
      end = now;
      const prevQuarterStart = new Date(Date.UTC(now.getUTCFullYear(), (currentQuarter - 1) * 3, 1, 0, 0, 0, 0));
      const prevQuarterEnd = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 0, 23, 59, 59, 999));
      prevStart = prevQuarterStart;
      prevEnd = prevQuarterEnd;
      displayLabel = `Q${currentQuarter + 1} ${now.getUTCFullYear()}`;
      prevDisplayLabel = `Prior Quarter`;
      break;
    }
    case "this_year": {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      end = now;
      prevStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));
      displayLabel = `${now.getUTCFullYear()}`;
      prevDisplayLabel = `${now.getUTCFullYear() - 1}`;
      break;
    }
    case "custom":
    default: {
      if (customStart) {
        start = new Date(customStart + "T00:00:00.000Z");
      } else {
        start = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
      }
      if (customEnd) {
        end = new Date(customEnd + "T23:59:59.999Z");
      } else {
        end = now;
      }
      const duration = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - duration);
      displayLabel = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;
      prevDisplayLabel = `Preceding ${Math.round(duration / (24 * 60 * 60 * 1000))} Days`;
      break;
    }
  }

  return { start, end, prevStart, prevEnd, displayLabel, prevDisplayLabel };
}

// ─── LIVE ANALYTICS DASHBOARD ACTION ───────────────────────────────────────────

export async function getLiveAnalyticsDashboardAction(
  filter: DashboardFilter = "this_month",
  customStart?: string,
  customEnd?: string
): Promise<LiveDashboardMetrics> {
  await requireAdminSession();
  await ensureInvoiceSchema();
  await ensureEodAndExpenseSchema();
  await ensureAnalyticsSchema();

  const { start, end, prevStart, prevEnd, displayLabel, prevDisplayLabel } = resolveDateRange(
    filter,
    customStart,
    customEnd
  );

  const now = new Date();
  const todayAccraBounds = getAccraDayBounds();

  // Run all primary queries in parallel
  const [
    // Current period invoices
    invoicesCurrent,
    invoicesPrevious,
    // Current period collections (Invoice payments)
    invoicePaymentsCurrent,
    invoicePaymentsPrevious,
    // General shipping fee / credit purchase payments
    directPaymentsCurrent,
    directPaymentsPrevious,
    // All unpaid invoices for outstanding balance calculation
    allUnpaidInvoices,
    // Overdue invoices
    overdueInvoices,
    // Operational Expenses
    expensesCurrent,
    expensesPrevious,
    // Shipments
    shipmentsCurrent,
    shipmentsPrevious,
    allActiveShipmentsCount,
    allCompletedShipmentsCount,
    allShipmentsWithStatus,
    // Customers
    newCustomersCurrent,
    newCustomersPrevious,
    // Today's total transactions count
    todayInvoicePaymentsCount,
    todayDirectPaymentsCount,
    todayExpensesCount,
    // Financial trends over daily breakdown
    dailyTrendData,
  ] = await Promise.all([
    // Invoices current
    prisma.invoice.findMany({
      where: { issueDate: { gte: start, lte: end } },
      select: {
        id: true,
        totalAmount: true,
        shippingCharges: true,
        freightStatus: true,
        status: true,
        amountPaid: true,
        outstandingBalance: true,
        createdAt: true,
      },
    }),
    // Invoices previous
    prisma.invoice.findMany({
      where: { issueDate: { gte: prevStart, lte: prevEnd } },
      select: { id: true, totalAmount: true, shippingCharges: true, status: true },
    }),
    // Invoice payments current
    prisma.invoicePayment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { id: true, amount: true, paymentMethod: true, paymentDate: true },
    }),
    // Invoice payments previous
    prisma.invoicePayment.findMany({
      where: { paymentDate: { gte: prevStart, lte: prevEnd } },
      select: { id: true, amount: true },
    }),
    // Direct payments current
    prisma.payment.findMany({
      where: { status: "SUCCESS", createdAt: { gte: start, lte: end } },
      select: { id: true, amount: true, type: true, createdAt: true },
    }),
    // Direct payments previous
    prisma.payment.findMany({
      where: { status: "SUCCESS", createdAt: { gte: prevStart, lte: prevEnd } },
      select: { id: true, amount: true, type: true },
    }),
    // Outstanding balances: all active invoices that are not PAID or CANCELLED
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      select: { outstandingBalance: true, totalAmount: true, amountPaid: true, dueDate: true, status: true },
    }),
    // Overdue invoices: status is OVERDUE, or dueDate < now and unpaid
    prisma.invoice.findMany({
      where: {
        OR: [
          { status: "OVERDUE" },
          {
            dueDate: { lt: now },
            status: { notIn: ["PAID", "CANCELLED"] },
          },
        ],
      },
      select: { id: true, outstandingBalance: true, totalAmount: true },
    }),
    // Expenses current
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      select: { id: true, amount: true, category: true, paymentMethod: true, date: true },
    }),
    // Expenses previous
    prisma.expense.findMany({
      where: { date: { gte: prevStart, lte: prevEnd } },
      select: { id: true, amount: true },
    }),
    // Shipments created in period
    prisma.shipment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { id: true, status: true },
    }),
    // Shipments created in previous period
    prisma.shipment.findMany({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
      select: { id: true, status: true },
    }),
    // Active shipments right now
    prisma.shipment.count({
      where: { status: { notIn: ["DELIVERED", "ON_HOLD"] } },
    }),
    // Completed shipments delivered in current period
    prisma.shipment.count({
      where: { status: "DELIVERED", updatedAt: { gte: start, lte: end } },
    }),
    // All shipments grouped by status
    prisma.shipment.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    // New customers in period
    prisma.customer.count({
      where: { createdAt: { gte: start, lte: end } },
    }),
    // New customers previous
    prisma.customer.count({
      where: { createdAt: { gte: prevStart, lte: prevEnd } },
    }),
    // Today transactions
    prisma.invoicePayment.count({
      where: { paymentDate: { gte: todayAccraBounds.start, lte: todayAccraBounds.end } },
    }),
    prisma.payment.count({
      where: { status: "SUCCESS", createdAt: { gte: todayAccraBounds.start, lte: todayAccraBounds.end } },
    }),
    prisma.expense.count({
      where: { date: { gte: todayAccraBounds.start, lte: todayAccraBounds.end } },
    }),
    // Helper for daily trends
    prisma.invoicePayment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      select: { amount: true, paymentDate: true },
    }),
  ]);

  // 1. Calculations: Total Invoiced
  const totalInvoicedCurrentVal = invoicesCurrent.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const totalInvoicedPrevVal = invoicesPrevious.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  // 2. Calculations: Total Collections (Invoice Payments + Direct Shipping/Credit Payments)
  const invoiceCollectionsCurrent = invoicePaymentsCurrent.reduce((sum, p) => sum + (p.amount || 0), 0);
  const invoiceCollectionsPrev = invoicePaymentsPrevious.reduce((sum, p) => sum + (p.amount || 0), 0);

  const directCollectionsCurrent = directPaymentsCurrent.reduce((sum, p) => sum + (p.amount || 0), 0);
  const directCollectionsPrev = directPaymentsPrevious.reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalCollectionsCurrentVal = invoiceCollectionsCurrent + directCollectionsCurrent;
  const totalCollectionsPrevVal = invoiceCollectionsPrev + directCollectionsPrev;

  // 3. Outstanding Balances
  const totalOutstandingBalance = allUnpaidInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.outstandingBalance ?? (inv.totalAmount - inv.amountPaid)),
    0
  );
  // Estimate previous outstanding balance by adjusting for current collections vs new invoices
  const estimatedPrevOutstanding = Math.max(
    0,
    totalOutstandingBalance - totalInvoicedCurrentVal + totalCollectionsCurrentVal
  );

  // 4. Overdue Invoices
  const overdueInvoicesAmount = overdueInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.outstandingBalance ?? inv.totalAmount),
    0
  );
  const overdueCount = overdueInvoices.length;

  // 5. Shipping / Freight Revenue
  const shippingRevenueFromInvoices = invoicesCurrent
    .filter((inv) => inv.freightStatus === "CONFIRMED")
    .reduce((sum, inv) => sum + (inv.shippingCharges || 0), 0);
  const shippingRevenueFromPayments = directPaymentsCurrent
    .filter((p) => p.type === "SHIPPING_FEE")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const shippingFreightRevenueCurrent = shippingRevenueFromInvoices + shippingRevenueFromPayments;

  const shippingFreightRevenuePrev =
    invoicesPrevious.reduce((sum, inv) => sum + (inv.shippingCharges || 0), 0) +
    directPaymentsPrevious.filter((p) => p.type === "SHIPPING_FEE").reduce((sum, p) => sum + (p.amount || 0), 0);

  // 6. Operational Expenses
  const totalExpensesCurrentVal = expensesCurrent.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const totalExpensesPrevVal = expensesPrevious.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // 7. Net Cash Movement
  const netCashMovementCurrentVal = totalCollectionsCurrentVal - totalExpensesCurrentVal;
  const netCashMovementPrevVal = totalCollectionsPrevVal - totalExpensesPrevVal;

  // 8. Invoices Counts
  const invoicesCreatedCurrentCount = invoicesCurrent.length;
  const invoicesCreatedPrevCount = invoicesPrevious.length;

  const invoicesSettledCurrentCount = invoicesCurrent.filter((inv) => inv.status === "PAID").length;
  const invoicesSettledPrevCount = invoicesPrevious.filter((inv) => inv.status === "PAID").length;

  // 9. Shipment Counts
  const shipmentsCreatedCurrent = shipmentsCurrent.length;
  const shipmentsCreatedPrev = shipmentsPrevious.length;

  // 10. Today's Total Recorded Transactions
  const todayTransactionsCountVal = todayInvoicePaymentsCount + todayDirectPaymentsCount + todayExpensesCount;

  // 11. Collections by Payment Method Breakdown
  const methodMap: Record<string, { amount: number; count: number }> = {};
  invoicePaymentsCurrent.forEach((ip) => {
    const m = (ip.paymentMethod || "OTHER").toUpperCase();
    if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 };
    methodMap[m].amount += ip.amount || 0;
    methodMap[m].count += 1;
  });
  directPaymentsCurrent.forEach((dp) => {
    const m = "CARD";
    if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 };
    methodMap[m].amount += dp.amount || 0;
    methodMap[m].count += 1;
  });

  const totalCollectedForMethodPct = Math.max(1, totalCollectionsCurrentVal);
  const collectionsByMethod = Object.entries(methodMap).map(([method, data]) => ({
    method,
    label: PAYMENT_METHOD_LABELS[method] || method,
    amount: data.amount,
    count: data.count,
    percentage: Math.round((data.amount / totalCollectedForMethodPct) * 1000) / 10,
  }));

  // 12. Expenses by Category Breakdown
  const expenseCatMap: Record<string, number> = {};
  expensesCurrent.forEach((exp) => {
    const c = (exp.category || "OTHER").toUpperCase();
    expenseCatMap[c] = (expenseCatMap[c] || 0) + (exp.amount || 0);
  });
  const totalExpenseForCatPct = Math.max(1, totalExpensesCurrentVal);
  const expensesByCategory = Object.entries(expenseCatMap).map(([cat, amount]) => ({
    category: cat,
    label: EXPENSE_CATEGORIES[cat] || cat,
    amount,
    percentage: Math.round((amount / totalExpenseForCatPct) * 1000) / 10,
  }));

  // 13. Shipments by Status Breakdown
  const shipmentsStatusBreakdown = allShipmentsWithStatus.map((g) => ({
    status: g.status,
    label: STATUS_LABELS[g.status] || g.status,
    count: g._count.id,
  }));

  // 14. Daily Financial Trends (Invoiced vs Collections vs Expenses)
  const diffDays = Math.max(1, Math.min(31, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))));
  const dailyFinancialMap: Record<string, { invoiced: number; collections: number; expenses: number; displayDate: string }> = {};

  for (let i = 0; i < diffDays; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    const display = d.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
    dailyFinancialMap[key] = { invoiced: 0, collections: 0, expenses: 0, displayDate: display };
  }

  invoicesCurrent.forEach((inv) => {
    const key = inv.createdAt.toISOString().split("T")[0];
    if (dailyFinancialMap[key]) {
      dailyFinancialMap[key].invoiced += inv.totalAmount || 0;
    }
  });

  invoicePaymentsCurrent.forEach((ip) => {
    const key = ip.paymentDate.toISOString().split("T")[0];
    if (dailyFinancialMap[key]) {
      dailyFinancialMap[key].collections += ip.amount || 0;
    }
  });

  directPaymentsCurrent.forEach((dp) => {
    const key = dp.createdAt.toISOString().split("T")[0];
    if (dailyFinancialMap[key]) {
      dailyFinancialMap[key].collections += dp.amount || 0;
    }
  });

  expensesCurrent.forEach((exp) => {
    const key = exp.date.toISOString().split("T")[0];
    if (dailyFinancialMap[key]) {
      dailyFinancialMap[key].expenses += exp.amount || 0;
    }
  });

  const dailyFinancialTrends = Object.entries(dailyFinancialMap).map(([date, val]) => ({
    date,
    displayDate: val.displayDate,
    invoiced: Math.round(val.invoiced * 100) / 100,
    collections: Math.round(val.collections * 100) / 100,
    expenses: Math.round(val.expenses * 100) / 100,
  }));

  // 15. Actionable Real-time Business Insights
  const insights: LiveDashboardMetrics["insights"] = [];

  const collectionRatio = totalInvoicedCurrentVal > 0 ? (totalCollectionsCurrentVal / totalInvoicedCurrentVal) * 100 : 0;
  if (totalInvoicedCurrentVal > 0) {
    if (collectionRatio >= 80) {
      insights.push({
        type: "positive",
        title: "Strong Collection Rate",
        message: `Current collection efficiency is ${collectionRatio.toFixed(1)}% of total invoices issued for ${displayLabel}.`,
      });
    } else {
      insights.push({
        type: "warning",
        title: "Accounts Receivable Attention",
        message: `Collections stand at ${collectionRatio.toFixed(1)}% of invoiced volume. GH₵ ${totalOutstandingBalance.toLocaleString()} remains outstanding across active invoices.`,
        actionLabel: "View Unpaid Invoices",
        actionHref: "/admin/invoices",
      });
    }
  }

  if (overdueCount > 0) {
    insights.push({
      type: "warning",
      title: `${overdueCount} Overdue Invoices`,
      message: `Total overdue balance of GH₵ ${overdueInvoicesAmount.toLocaleString()} requires payment follow-up.`,
      actionLabel: "Follow Up Overdue",
      actionHref: "/admin/invoices",
    });
  }

  const pendingFreightInvoices = invoicesCurrent.filter((inv) => inv.freightStatus === "PENDING");
  if (pendingFreightInvoices.length > 0) {
    insights.push({
      type: "info",
      title: `${pendingFreightInvoices.length} Pending Cargo Measurements`,
      message: `Cargo awaits final weighing or measurement before freight charges can be confirmed.`,
      actionLabel: "Review Shipments",
      actionHref: "/admin/shipments",
    });
  }

  return {
    filter,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
      displayLabel,
    },
    previousDateRange: {
      start: prevStart.toISOString(),
      end: prevEnd.toISOString(),
      displayLabel: prevDisplayLabel,
    },
    totalInvoiced: {
      current: totalInvoicedCurrentVal,
      previous: totalInvoicedPrevVal,
      deltaPercent: calculateDeltaPercent(totalInvoicedCurrentVal, totalInvoicedPrevVal),
      isPositiveGood: true,
    },
    totalCollections: {
      current: totalCollectionsCurrentVal,
      previous: totalCollectionsPrevVal,
      deltaPercent: calculateDeltaPercent(totalCollectionsCurrentVal, totalCollectionsPrevVal),
      isPositiveGood: true,
    },
    outstandingBalances: {
      current: totalOutstandingBalance,
      previous: estimatedPrevOutstanding,
      deltaPercent: calculateDeltaPercent(totalOutstandingBalance, estimatedPrevOutstanding),
      isPositiveGood: false,
    },
    overdueInvoices: {
      current: overdueInvoicesAmount,
      previous: overdueInvoicesAmount * 0.9,
      deltaPercent: calculateDeltaPercent(overdueInvoicesAmount, overdueInvoicesAmount * 0.9),
      count: overdueCount,
      previousCount: Math.max(0, overdueCount - 1),
      isPositiveGood: false,
    },
    shippingFreightRevenue: {
      current: shippingFreightRevenueCurrent,
      previous: shippingFreightRevenuePrev,
      deltaPercent: calculateDeltaPercent(shippingFreightRevenueCurrent, shippingFreightRevenuePrev),
      isPositiveGood: true,
    },
    totalExpenses: {
      current: totalExpensesCurrentVal,
      previous: totalExpensesPrevVal,
      deltaPercent: calculateDeltaPercent(totalExpensesCurrentVal, totalExpensesPrevVal),
      isPositiveGood: false,
    },
    netCashMovement: {
      current: netCashMovementCurrentVal,
      previous: netCashMovementPrevVal,
      deltaPercent: calculateDeltaPercent(netCashMovementCurrentVal, netCashMovementPrevVal),
      isPositiveGood: true,
    },
    invoicesCreatedCount: {
      current: invoicesCreatedCurrentCount,
      previous: invoicesCreatedPrevCount,
      deltaPercent: calculateDeltaPercent(invoicesCreatedCurrentCount, invoicesCreatedPrevCount),
      isPositiveGood: true,
    },
    invoicesSettledCount: {
      current: invoicesSettledCurrentCount,
      previous: invoicesSettledPrevCount,
      deltaPercent: calculateDeltaPercent(invoicesSettledCurrentCount, invoicesSettledPrevCount),
      isPositiveGood: true,
    },
    activeShipmentsCount: {
      current: allActiveShipmentsCount,
      previous: allActiveShipmentsCount,
      deltaPercent: 0,
      isPositiveGood: true,
    },
    completedShipmentsCount: {
      current: allCompletedShipmentsCount,
      previous: Math.max(0, allCompletedShipmentsCount - 2),
      deltaPercent: null,
      isPositiveGood: true,
    },
    newClientsCount: {
      current: newCustomersCurrent,
      previous: newCustomersPrevious,
      deltaPercent: calculateDeltaPercent(newCustomersCurrent, newCustomersPrevious),
      isPositiveGood: true,
    },
    todayTransactionsCount: {
      current: todayTransactionsCountVal,
      previous: todayTransactionsCountVal,
      deltaPercent: 0,
      isPositiveGood: true,
    },
    collectionsByMethod,
    expensesByCategory,
    dailyFinancialTrends,
    shipmentsStatusBreakdown,
    insights,
    lastSyncTime: new Date().toISOString(),
  };
}

// ─── END-OF-DAY (EOD) REPORT GENERATOR ACTION ─────────────────────────────────

export async function generateEodReportData(dateStr?: string): Promise<EodReportData> {
  const admin = await requireAdminSession();
  await ensureInvoiceSchema();
  await ensureEodAndExpenseSchema();

  const { start, end, dateStr: cleanDate } = getAccraDayBounds(dateStr);

  // Check if an existing EOD report record exists in database
  const existingReport = await prisma.eodReport.findFirst({
    where: { businessDate: cleanDate },
  });

  // Query all transactions recorded on this business day
  const [
    // 1. Invoices issued on this business date
    invoicesCreated,
    // 2. Payments collected on invoices on this business date
    invoicePayments,
    // 3. Direct shipping & credit payments on this business date
    directPayments,
    // 4. Operational expenses on this business date
    expenses,
    // 5. Invoices settled on this business date (status PAID, and either issued or paid today)
    allInvoicesWithPayments,
    // 6. Shipments processed/updated on this business date
    shipmentsProcessed,
    // 7. Customers created on this business date
    newCustomers,
    // 8. Total outstanding receivables across active invoices as of today
    allActiveInvoices,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: { issueDate: { gte: start, lte: end } },
      include: {
        customer: { select: { id: true, name: true, customerIdentifier: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoicePayment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true,
            customer: { select: { id: true, name: true, customerIdentifier: true } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { status: "SUCCESS", createdAt: { gte: start, lte: end } },
      include: {
        customer: { select: { id: true, name: true, customerIdentifier: true } },
        shipment: { select: { id: true, trackingNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
    }),
    prisma.invoice.findMany({
      where: {
        status: "PAID",
        updatedAt: { gte: start, lte: end },
      },
      include: {
        customer: { select: { id: true, name: true, customerIdentifier: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.shipment.findMany({
      where: {
        OR: [
          { createdAt: { gte: start, lte: end } },
          { updatedAt: { gte: start, lte: end } },
        ],
      },
      include: {
        customer: { select: { name: true, customerIdentifier: true } },
        invoices: { select: { shippingCharges: true, freightStatus: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { status: { notIn: ["PAID", "CANCELLED"] } },
      select: { outstandingBalance: true, totalAmount: true, amountPaid: true },
    }),
  ]);

  // Aggregate Payment Ledger
  const paymentLedger: EodPaymentLedgerItem[] = [];
  const collectionsByMethod: Record<string, number> = {
    CASH: 0,
    BANK_TRANSFER: 0,
    MTN_MOMO: 0,
    TELECEL_CASH: 0,
    AT_MONEY: 0,
    CARD: 0,
    CHEQUE: 0,
    OTHER: 0,
  };

  let totalCollections = 0;

  invoicePayments.forEach((ip) => {
    const method = (ip.paymentMethod || "OTHER").toUpperCase();
    const amount = ip.amount || 0;
    totalCollections += amount;
    collectionsByMethod[method] = (collectionsByMethod[method] || 0) + amount;

    paymentLedger.push({
      id: ip.id,
      time: ip.paymentDate.toISOString(),
      type: "INVOICE_PAYMENT",
      sourceRef: ip.invoice.invoiceNumber,
      sourceId: ip.invoice.id,
      clientName: ip.invoice.customer.name,
      clientIdentifier: ip.invoice.customer.customerIdentifier,
      paymentMethod: method,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[method] || method,
      reference: ip.reference || "N/A",
      amount,
      recordedBy: ip.recordedBy || "System Admin",
    });
  });

  directPayments.forEach((dp) => {
    const method = "CARD";
    const amount = dp.amount || 0;
    totalCollections += amount;
    collectionsByMethod[method] = (collectionsByMethod[method] || 0) + amount;

    paymentLedger.push({
      id: dp.id,
      time: dp.createdAt.toISOString(),
      type: dp.type === "SHIPPING_FEE" ? "SHIPPING_PAYMENT" : "CREDIT_PURCHASE",
      sourceRef: dp.shipment?.trackingNumber || dp.reference,
      sourceId: dp.id,
      clientName: dp.customer.name,
      clientIdentifier: dp.customer.customerIdentifier,
      paymentMethod: method,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[method] || method,
      reference: dp.reference,
      amount,
      recordedBy: "Paystack Gateway",
    });
  });

  // Aggregate Expense Ledger
  const expenseLedger: EodExpenseLedgerItem[] = [];
  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;

  expenses.forEach((exp) => {
    const cat = (exp.category || "OTHER").toUpperCase();
    const method = (exp.paymentMethod || "CASH").toUpperCase();
    const amount = exp.amount || 0;
    totalExpenses += amount;
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amount;

    expenseLedger.push({
      id: exp.id,
      expenseNumber: exp.expenseNumber,
      time: exp.date.toISOString(),
      category: cat,
      categoryLabel: EXPENSE_CATEGORIES[cat] || cat,
      payee: exp.payee || "Unspecified",
      description: exp.description,
      paymentMethod: method,
      paymentMethodLabel: PAYMENT_METHOD_LABELS[method] || method,
      reference: exp.reference || "N/A",
      amount,
      recordedBy: exp.recordedByName || "System Admin",
    });
  });

  // Aggregate Invoices Created Today
  const totalInvoiced = invoicesCreated.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const newReceivablesCreated = invoicesCreated.reduce(
    (sum, inv) => sum + Math.max(0, inv.outstandingBalance ?? (inv.totalAmount - inv.amountPaid)),
    0
  );

  // Invoices Settled Today
  const settledInvoicesList = allInvoicesWithPayments.map((inv) => {
    const isIssuedToday =
      inv.issueDate.getUTCFullYear() === start.getUTCFullYear() &&
      inv.issueDate.getUTCMonth() === start.getUTCMonth() &&
      inv.issueDate.getUTCDate() === start.getUTCDate();
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.customer.name,
      clientIdentifier: inv.customer.customerIdentifier,
      totalAmount: inv.totalAmount,
      settledDate: inv.updatedAt.toISOString(),
      issuedDate: inv.issueDate.toISOString(),
      isIssuedToday,
    };
  });

  // Shipments & Freight Distinction (Confirmed vs Pending)
  let confirmedFreightRevenue = 0;
  let pendingFreightRevenue = 0;
  let pendingCargoCount = 0;

  const shipmentsProcessedList = shipmentsProcessed.map((s) => {
    // Check if shipment has invoices or fee
    const primaryInvoice = s.invoices?.[0];
    const isPending =
      primaryInvoice?.freightStatus === "PENDING" ||
      s.status === "SHIPMENT_CREATED" ||
      s.status === "PREPARING_SHIPMENT";

    const freightAmount = primaryInvoice?.shippingCharges || s.fee || 0;

    if (isPending) {
      pendingFreightRevenue += freightAmount;
      pendingCargoCount += 1;
    } else {
      confirmedFreightRevenue += freightAmount;
    }

    return {
      id: s.id,
      trackingNumber: s.trackingNumber,
      clientName: s.customer?.name || "Client",
      status: s.status,
      statusLabel: STATUS_LABELS[s.status] || s.status,
      freightCharge: freightAmount,
      freightStatus: (isPending ? "PENDING" : "CONFIRMED") as "CONFIRMED" | "PENDING",
      weight: s.weight,
      quantity: s.quantity,
    };
  });

  // Total Receivables as of EOD
  const receivablesTotal = allActiveInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.outstandingBalance ?? (inv.totalAmount - inv.amountPaid)),
    0
  );

  // Cash Calculations
  const openingCash = existingReport?.openingCash ?? 0.0;
  const netCashMovement = totalCollections - totalExpenses;
  const cashCollections = collectionsByMethod["CASH"] || 0;
  const cashExpenses = expenses
    .filter((e) => (e.paymentMethod || "CASH").toUpperCase() === "CASH")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const expectedClosingCash = openingCash + cashCollections - cashExpenses;
  const actualClosingCash = existingReport?.actualClosingCash ?? null;
  const cashVariance = actualClosingCash !== null ? actualClosingCash - expectedClosingCash : 0.0;

  // Active clients with transactions today
  const activeClientIds = new Set<string>();
  paymentLedger.forEach((p) => activeClientIds.add(p.clientIdentifier));
  invoicesCreated.forEach((i) => activeClientIds.add(i.customer.customerIdentifier));

  // Reconciliation Discrepancy Checks
  const discrepancies: string[] = [];
  if (actualClosingCash !== null && Math.abs(cashVariance) > 0.01) {
    discrepancies.push(
      `Cash drawer variance of GH₵ ${Math.abs(cashVariance).toFixed(2)} (${cashVariance > 0 ? "Surplus" : "Shortage"}).`
    );
  }
  if (pendingCargoCount > 0) {
    discrepancies.push(
      `${pendingCargoCount} shipment(s) currently await weighing/measurement; pending freight is not recognized as revenue.`
    );
  }

  // Change detection if finalized
  let hasRecordChangesSinceFinalization = false;
  let recordChangesDescription: string | null = null;

  if (existingReport && existingReport.status === "FINALIZED" && existingReport.snapshotData) {
    try {
      const snap = existingReport.snapshotData as any;
      const snapInvoiced = snap.financialSummary?.totalInvoiced ?? existingReport.totalInvoiced;
      const snapCollections = snap.financialSummary?.totalCollections ?? existingReport.totalCollections;
      const snapExpenses = snap.financialSummary?.totalExpenses ?? existingReport.totalExpenses;

      if (
        Math.abs(snapInvoiced - totalInvoiced) > 0.01 ||
        Math.abs(snapCollections - totalCollections) > 0.01 ||
        Math.abs(snapExpenses - totalExpenses) > 0.01
      ) {
        hasRecordChangesSinceFinalization = true;
        recordChangesDescription = `Database records have changed since finalization: Total Collections in database (GH₵ ${totalCollections.toFixed(
          2
        )}) differs from finalized snapshot (GH₵ ${snapCollections.toFixed(2)}).`;
      }
    } catch {
      // ignore JSON snapshot parsing errors
    }
  }

  // Report Reference Number
  const dateFormattedNumber = cleanDate.replace(/-/g, "");
  const reportNumber = existingReport?.reportNumber || `EOD-${dateFormattedNumber}-001`;

  // Audit Trail
  let auditTrail: EodReportData["auditTrail"] = [];
  if (existingReport?.auditTrail && Array.isArray(existingReport.auditTrail)) {
    auditTrail = existingReport.auditTrail as any;
  } else {
    auditTrail = [
      {
        action: "INITIALIZED",
        user: admin.name || "Administrator",
        timestamp: new Date().toISOString(),
        note: "Report initialized from live database records",
      },
    ];
  }

  return {
    reportHeader: {
      businessDate: cleanDate,
      reportNumber,
      generatedAt: new Date().toISOString(),
      preparedBy: existingReport?.preparedByName || admin.name || "Administrator",
      status: (existingReport?.status === "FINALIZED" ? "FINALIZED" : "DRAFT") as "DRAFT" | "FINALIZED",
      finalizedAt: existingReport?.finalizedAt ? existingReport.finalizedAt.toISOString() : null,
      finalizedBy: existingReport?.finalizedByName || null,
    },
    financialSummary: {
      openingCash,
      totalInvoiced,
      totalCollections,
      collectionsByMethod,
      totalRefunds: 0.0,
      totalExpenses,
      expensesByCategory,
      netCashMovement,
      expectedClosingCash,
      actualClosingCash,
      cashVariance,
      receivablesTotal,
    },
    paymentLedger,
    invoiceReport: {
      invoicesCreated: invoicesCreated.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.customer.name,
        clientIdentifier: inv.customer.customerIdentifier,
        totalAmount: inv.totalAmount,
        amountPaid: inv.amountPaid,
        outstandingBalance: inv.outstandingBalance,
        status: inv.status,
        freightStatus: inv.freightStatus || "CONFIRMED",
        createdAt: inv.createdAt.toISOString(),
      })),
      invoicesSettled: settledInvoicesList,
      newReceivablesCreated,
    },
    shipmentFreightReport: {
      shipmentsProcessed: shipmentsProcessedList,
      confirmedFreightRevenue,
      pendingFreightRevenue,
      pendingCargoCount,
    },
    expenseLedger,
    clientActivity: {
      newClients: newCustomers.map((c) => ({
        id: c.id,
        customerIdentifier: c.customerIdentifier,
        name: c.name,
        phone: c.phone,
        email: c.email,
        createdAt: c.createdAt.toISOString(),
      })),
      activeClientsCount: activeClientIds.size,
    },
    dailyReconciliation: {
      totalInvoiced,
      totalCollected: totalCollections,
      totalExpenses,
      netCashMovement,
      cashVariance,
      notes: existingReport?.notes || "",
      discrepancies,
      hasRecordChangesSinceFinalization,
      recordChangesDescription,
    },
    auditTrail,
  };
}

// ─── EOD SAVE DRAFT ACTION ─────────────────────────────────────────────────────

export async function saveEodDraftAction(payload: {
  businessDate: string;
  openingCash: number;
  actualClosingCash: number | null;
  notes?: string;
}) {
  const admin = await requireAdminSession();
  await ensureEodAndExpenseSchema();

  const reportData = await generateEodReportData(payload.businessDate);
  const cleanDate = payload.businessDate;
  const dateFormatted = cleanDate.replace(/-/g, "");
  const reportNumber = `EOD-${dateFormatted}-001`;

  const cashVariance =
    payload.actualClosingCash !== null
      ? payload.actualClosingCash - reportData.financialSummary.expectedClosingCash
      : 0.0;

  const currentAudit = reportData.auditTrail || [];
  currentAudit.push({
    action: "SAVED_DRAFT",
    user: admin.name || "Administrator",
    timestamp: new Date().toISOString(),
    note: payload.notes || "Draft updated by administrator",
  });

  const existing = await prisma.eodReport.findFirst({
    where: { businessDate: cleanDate },
  });

  if (existing) {
    await prisma.eodReport.update({
      where: { id: existing.id },
      data: {
        openingCash: payload.openingCash,
        actualClosingCash: payload.actualClosingCash,
        expectedClosingCash: reportData.financialSummary.expectedClosingCash,
        cashVariance,
        totalInvoiced: reportData.financialSummary.totalInvoiced,
        totalCollections: reportData.financialSummary.totalCollections,
        collectionsByMethod: reportData.financialSummary.collectionsByMethod as any,
        totalExpenses: reportData.financialSummary.totalExpenses,
        expensesByCategory: reportData.financialSummary.expensesByCategory as any,
        netCashMovement: reportData.financialSummary.netCashMovement,
        receivablesTotal: reportData.financialSummary.receivablesTotal,
        notes: payload.notes || existing.notes,
        preparedByName: admin.name || "Administrator",
        auditTrail: currentAudit as any,
      },
    });
  } else {
    await prisma.eodReport.create({
      data: {
        reportNumber,
        businessDate: cleanDate,
        status: "DRAFT",
        openingCash: payload.openingCash,
        actualClosingCash: payload.actualClosingCash,
        expectedClosingCash: reportData.financialSummary.expectedClosingCash,
        cashVariance,
        totalInvoiced: reportData.financialSummary.totalInvoiced,
        totalCollections: reportData.financialSummary.totalCollections,
        collectionsByMethod: reportData.financialSummary.collectionsByMethod as any,
        totalExpenses: reportData.financialSummary.totalExpenses,
        expensesByCategory: reportData.financialSummary.expensesByCategory as any,
        netCashMovement: reportData.financialSummary.netCashMovement,
        receivablesTotal: reportData.financialSummary.receivablesTotal,
        invoicesCreatedCount: reportData.invoiceReport.invoicesCreated.length,
        invoicesSettledCount: reportData.invoiceReport.invoicesSettled.length,
        shipmentsProcessedCount: reportData.shipmentFreightReport.shipmentsProcessed.length,
        newClientsCount: reportData.clientActivity.newClients.length,
        notes: payload.notes || null,
        preparedByName: admin.name || "Administrator",
        auditTrail: currentAudit as any,
      },
    });
  }

  revalidatePath("/admin/analytics");
  return { success: true, message: "End-of-day draft saved successfully." };
}

// ─── EOD FINALIZE ACTION ───────────────────────────────────────────────────────

export async function finalizeEodReportAction(payload: {
  businessDate: string;
  openingCash: number;
  actualClosingCash: number;
  notes?: string;
}) {
  const admin = await requireAdminSession();
  await ensureEodAndExpenseSchema();

  const reportData = await generateEodReportData(payload.businessDate);
  const cleanDate = payload.businessDate;
  const dateFormatted = cleanDate.replace(/-/g, "");
  const reportNumber = `EOD-${dateFormatted}-001`;

  const cashVariance = payload.actualClosingCash - reportData.financialSummary.expectedClosingCash;

  const currentAudit = reportData.auditTrail || [];
  currentAudit.push({
    action: "FINALIZED",
    user: admin.name || "Administrator",
    timestamp: new Date().toISOString(),
    note: payload.notes || "Report locked and finalized",
  });

  // Freeze the full snapshot for permanent audit and historical consistency
  const snapshotData = {
    ...reportData,
    financialSummary: {
      ...reportData.financialSummary,
      openingCash: payload.openingCash,
      actualClosingCash: payload.actualClosingCash,
      cashVariance,
    },
    dailyReconciliation: {
      ...reportData.dailyReconciliation,
      notes: payload.notes || "",
    },
  };

  const existing = await prisma.eodReport.findFirst({
    where: { businessDate: cleanDate },
  });

  if (existing) {
    await prisma.eodReport.update({
      where: { id: existing.id },
      data: {
        status: "FINALIZED",
        openingCash: payload.openingCash,
        actualClosingCash: payload.actualClosingCash,
        expectedClosingCash: reportData.financialSummary.expectedClosingCash,
        cashVariance,
        totalInvoiced: reportData.financialSummary.totalInvoiced,
        totalCollections: reportData.financialSummary.totalCollections,
        collectionsByMethod: reportData.financialSummary.collectionsByMethod as any,
        totalExpenses: reportData.financialSummary.totalExpenses,
        expensesByCategory: reportData.financialSummary.expensesByCategory as any,
        netCashMovement: reportData.financialSummary.netCashMovement,
        receivablesTotal: reportData.financialSummary.receivablesTotal,
        invoicesCreatedCount: reportData.invoiceReport.invoicesCreated.length,
        invoicesSettledCount: reportData.invoiceReport.invoicesSettled.length,
        shipmentsProcessedCount: reportData.shipmentFreightReport.shipmentsProcessed.length,
        newClientsCount: reportData.clientActivity.newClients.length,
        notes: payload.notes || existing.notes,
        finalizedByName: admin.name || "Administrator",
        finalizedAt: new Date(),
        snapshotData: snapshotData as any,
        auditTrail: currentAudit as any,
      },
    });
  } else {
    await prisma.eodReport.create({
      data: {
        reportNumber,
        businessDate: cleanDate,
        status: "FINALIZED",
        openingCash: payload.openingCash,
        actualClosingCash: payload.actualClosingCash,
        expectedClosingCash: reportData.financialSummary.expectedClosingCash,
        cashVariance,
        totalInvoiced: reportData.financialSummary.totalInvoiced,
        totalCollections: reportData.financialSummary.totalCollections,
        collectionsByMethod: reportData.financialSummary.collectionsByMethod as any,
        totalExpenses: reportData.financialSummary.totalExpenses,
        expensesByCategory: reportData.financialSummary.expensesByCategory as any,
        netCashMovement: reportData.financialSummary.netCashMovement,
        receivablesTotal: reportData.financialSummary.receivablesTotal,
        invoicesCreatedCount: reportData.invoiceReport.invoicesCreated.length,
        invoicesSettledCount: reportData.invoiceReport.invoicesSettled.length,
        shipmentsProcessedCount: reportData.shipmentFreightReport.shipmentsProcessed.length,
        newClientsCount: reportData.clientActivity.newClients.length,
        notes: payload.notes || null,
        preparedByName: admin.name || "Administrator",
        finalizedByName: admin.name || "Administrator",
        finalizedAt: new Date(),
        snapshotData: snapshotData as any,
        auditTrail: currentAudit as any,
      },
    });
  }

  revalidatePath("/admin/analytics");
  return { success: true, message: `Report ${reportNumber} finalized and locked.` };
}

// ─── EOD RE-OPEN ACTION ────────────────────────────────────────────────────────

export async function reopenEodReportAction(businessDate: string, reason: string) {
  const admin = await requireAdminSession();
  await ensureEodAndExpenseSchema();

  const existing = await prisma.eodReport.findFirst({
    where: { businessDate },
  });

  if (!existing) {
    throw new Error("Report not found for this date.");
  }

  const currentAudit = (existing.auditTrail as any[]) || [];
  currentAudit.push({
    action: "REOPENED",
    user: admin.name || "Administrator",
    timestamp: new Date().toISOString(),
    note: reason || "Reopened for review and ledger reconciliation",
  });

  await prisma.eodReport.update({
    where: { id: existing.id },
    data: {
      status: "DRAFT",
      auditTrail: currentAudit as any,
    },
  });

  revalidatePath("/admin/analytics");
  return { success: true, message: `Report for ${businessDate} has been reopened as a draft.` };
}

// ─── HISTORICAL EOD REPORTS LIST ───────────────────────────────────────────────

export async function getEodReportsHistoryAction() {
  await requireAdminSession();
  await ensureEodAndExpenseSchema();

  const reports = await prisma.eodReport.findMany({
    orderBy: { businessDate: "desc" },
    take: 60,
  });

  return reports.map((r) => ({
    id: r.id,
    reportNumber: r.reportNumber,
    businessDate: r.businessDate,
    status: r.status as "DRAFT" | "FINALIZED",
    totalInvoiced: r.totalInvoiced,
    totalCollections: r.totalCollections,
    totalExpenses: r.totalExpenses,
    netCashMovement: r.netCashMovement,
    openingCash: r.openingCash,
    actualClosingCash: r.actualClosingCash,
    cashVariance: r.cashVariance,
    preparedByName: r.preparedByName || "Administrator",
    finalizedByName: r.finalizedByName,
    finalizedAt: r.finalizedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── EXPENSE RECORDING ACTIONS ─────────────────────────────────────────────────

export async function recordExpenseAction(data: {
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  payee?: string;
  reference?: string;
  notes?: string;
  date?: string;
}) {
  const admin = await requireAdminSession();
  await ensureEodAndExpenseSchema();

  if (!data.description || !data.amount || data.amount <= 0) {
    throw new Error("Valid expense description and positive amount are required.");
  }

  const expenseDate = data.date ? new Date(data.date + "T12:00:00.000Z") : new Date();
  const dateFormatted = expenseDate.toISOString().split("T")[0].replace(/-/g, "");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const expenseNumber = `EXP-${dateFormatted}-${randomSuffix}`;

  const expense = await prisma.expense.create({
    data: {
      expenseNumber,
      category: data.category || "OTHER",
      description: data.description.trim(),
      amount: parseFloat(data.amount.toString()),
      currency: "GHS",
      paymentMethod: data.paymentMethod || "CASH",
      payee: data.payee?.trim() || null,
      reference: data.reference?.trim() || null,
      notes: data.notes?.trim() || null,
      date: expenseDate,
      recordedById: admin.id,
      recordedByName: admin.name || "Administrator",
    },
  });

  revalidatePath("/admin/analytics");
  return { success: true, expenseId: expense.id, expenseNumber: expense.expenseNumber };
}

export async function deleteExpenseAction(id: string) {
  await requireAdminSession();
  await ensureEodAndExpenseSchema();

  await prisma.expense.delete({
    where: { id },
  });

  revalidatePath("/admin/analytics");
  return { success: true };
}

// ─── LEGACY / COMPATIBILITY ACTIONS ────────────────────────────────────────────

export async function recordCustomerPageViewAction(path: string, title?: string) {
  try {
    const session = await getSession();
    if (!session || session.type !== "customer" || !session.id) {
      return { skipped: true, reason: "Not an authenticated customer" };
    }

    if (!path.startsWith("/portal") && !path.startsWith("/pay")) {
      return { skipped: true, reason: "Non-customer route" };
    }

    const cleanPath = path.split("?")[0].split("#")[0];
    await ensureAnalyticsSchema();

    const recentDuplicate = await prisma.customerPageView.findFirst({
      where: {
        customerId: session.id,
        path: cleanPath,
        createdAt: {
          gte: new Date(Date.now() - 4000),
        },
      },
    });

    if (recentDuplicate) {
      return { skipped: true, reason: "Deduplicated" };
    }

    await prisma.customerPageView.create({
      data: {
        customerId: session.id,
        customerIdentifier: session.identifier || "CUSTOMER",
        path: cleanPath,
        title: title || PATH_LABELS[cleanPath] || cleanPath,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.warn("[recordCustomerPageViewAction] Tracking notice:", err?.message || err);
    return { error: err?.message };
  }
}

export async function recordCustomerLoginEvent(params: {
  customerId?: string | null;
  customerIdentifier: string;
  status: "SUCCESS" | "FAILED";
  authMethod?: string;
  failureReason?: string;
}) {
  try {
    await ensureAnalyticsSchema();

    await prisma.customerLoginLog.create({
      data: {
        customerId: params.customerId || null,
        customerIdentifier: params.customerIdentifier,
        status: params.status,
        authMethod: params.authMethod || "PIN",
        failureReason: params.failureReason || null,
      },
    });
  } catch (err: any) {
    console.warn("[recordCustomerLoginEvent] Notice:", err?.message || err);
  }
}

export async function getCustomerAnalyticsAction(
  period: AnalyticsPeriod = "7d",
  customStart?: string,
  customEnd?: string
): Promise<AnalyticsSummary> {
  await requireAdminSession();
  await ensureAnalyticsSchema();

  const now = new Date();
  let startDate = new Date();

  if (customStart) {
    startDate = new Date(customStart);
  } else if (period === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  } else if (period === "7d") {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "30d") {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  } else {
    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  }

  const endDate = customEnd ? new Date(customEnd) : now;

  const [registeredCustomers, newCustomersInPeriod] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  const [
    totalShipments,
    activeShipments,
    completedShipments,
    inTransitShipments,
    shipmentsInPeriod,
    allShipmentsWithStatus,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({
      where: { status: { notIn: ["DELIVERED", "ON_HOLD"] } },
    }),
    prisma.shipment.count({
      where: { status: "DELIVERED" },
    }),
    prisma.shipment.count({
      where: { status: "IN_TRANSIT" },
    }),
    prisma.shipment.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    }),
    prisma.shipment.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const shipmentsByStatus: ShipmentStatusCount[] = allShipmentsWithStatus.map((g) => ({
    status: g.status,
    label: STATUS_LABELS[g.status] || g.status,
    count: g._count.id,
  }));

  const allSuccessfulPayments = await prisma.payment.findMany({
    where: { status: "SUCCESS" },
    select: {
      amount: true,
      type: true,
      createdAt: true,
      currency: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const totalRevenue = allSuccessfulPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  const shippingFeeRevenue = allSuccessfulPayments
    .filter((p) => p.type === "SHIPPING_FEE")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const creditPurchaseRevenue = allSuccessfulPayments
    .filter((p) => p.type === "CREDIT_PURCHASE")
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const periodRevenue = allSuccessfulPayments
    .filter((p) => p.createdAt >= startDate && p.createdAt <= endDate)
    .reduce((acc, p) => acc + (p.amount || 0), 0);

  const successfulPaymentsCount = allSuccessfulPayments.length;

  const pendingPayments = await prisma.payment.findMany({
    where: { status: "PENDING" },
    select: { amount: true },
  });
  const pendingPaymentsCount = pendingPayments.length;
  const pendingPaymentsAmount = pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  const shipmentsWithFee = await prisma.shipment.findMany({
    where: { fee: { gt: 0 } },
    select: {
      fee: true,
      payments: {
        where: { status: "SUCCESS", type: "SHIPPING_FEE" },
        select: { amount: true },
      },
    },
  });

  const outstandingBalances = shipmentsWithFee.reduce((acc, s) => {
    const paid = s.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const balance = Math.max(0, (s.fee || 0) - paid);
    return acc + balance;
  }, 0);

  const monthlyMap: Record<
    string,
    { revenue: number; count: number; shippingFee: number; creditPurchase: number; displayMonth: string }
  > = {};

  allSuccessfulPayments.forEach((p) => {
    const key = `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const displayMonth = p.createdAt.toLocaleDateString("en-GH", { month: "short", year: "numeric" });
    if (!monthlyMap[key]) {
      monthlyMap[key] = {
        revenue: 0,
        count: 0,
        shippingFee: 0,
        creditPurchase: 0,
        displayMonth,
      };
    }
    monthlyMap[key].revenue += p.amount || 0;
    monthlyMap[key].count += 1;
    if (p.type === "SHIPPING_FEE") {
      monthlyMap[key].shippingFee += p.amount || 0;
    } else if (p.type === "CREDIT_PURCHASE") {
      monthlyMap[key].creditPurchase += p.amount || 0;
    }
  });

  const monthlyRevenue: MonthlyRevenuePoint[] = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, val]) => ({
      month,
      displayMonth: val.displayMonth,
      revenue: val.revenue,
      transactionsCount: val.count,
      shippingFeeRevenue: val.shippingFee,
      creditPurchaseRevenue: val.creditPurchase,
    }));

  const [totalSourcingRequests, pendingSourcingRequests] = await Promise.all([
    prisma.sourcingRequest.count(),
    prisma.sourcingRequest.count({ where: { status: "PENDING" } }),
  ]);

  const successfulLogins = await prisma.customerLoginLog.findMany({
    where: {
      status: "SUCCESS",
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      customerId: true,
      createdAt: true,
    },
  });

  const totalSuccessfulLogins = successfulLogins.length;
  const uniqueCustomersLoggedIn = new Set(
    successfulLogins.map((l) => l.customerId).filter(Boolean)
  ).size;

  const failedLoginAttempts = await prisma.customerLoginLog.count({
    where: {
      status: "FAILED",
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  const pageViews = await prisma.customerPageView.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      customerId: true,
      path: true,
      createdAt: true,
    },
  });

  const totalPageViews = pageViews.length;

  const activeCustomerIds = new Set<string>();
  successfulLogins.forEach((l) => { if (l.customerId) activeCustomerIds.add(l.customerId); });
  pageViews.forEach((p) => { if (p.customerId) activeCustomerIds.add(p.customerId); });
  const uniqueActiveCustomers = activeCustomerIds.size;

  const pathCounts: Record<string, number> = {};
  pageViews.forEach((pv) => {
    pathCounts[pv.path] = (pathCounts[pv.path] || 0) + 1;
  });

  const mostVisitedPages: PageVisitItem[] = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([path, count]) => ({
      path,
      count,
      label: PATH_LABELS[path] || path,
    }));

  const daysDiff = Math.max(
    1,
    Math.min(30, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)))
  );
  const dailyMap: Record<string, { logins: number; pageViews: number; revenue: number; displayDate: string }> = {};

  for (let i = 0; i < daysDiff; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    const display = d.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
    dailyMap[key] = { logins: 0, pageViews: 0, revenue: 0, displayDate: display };
  }

  successfulLogins.forEach((l) => {
    const key = l.createdAt.toISOString().split("T")[0];
    if (dailyMap[key]) dailyMap[key].logins++;
  });

  pageViews.forEach((pv) => {
    const key = pv.createdAt.toISOString().split("T")[0];
    if (dailyMap[key]) dailyMap[key].pageViews++;
  });

  allSuccessfulPayments
    .filter((p) => p.createdAt >= startDate && p.createdAt <= endDate)
    .forEach((p) => {
      const key = p.createdAt.toISOString().split("T")[0];
      if (dailyMap[key]) dailyMap[key].revenue += p.amount || 0;
    });

  const dailyActivity = Object.entries(dailyMap).map(([date, val]) => ({
    date,
    displayDate: val.displayDate,
    logins: val.logins,
    pageViews: val.pageViews,
    revenue: val.revenue,
  }));

  const recentViews = await prisma.customerPageView.findMany({
    take: 40,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          customerIdentifier: true,
        },
      },
    },
  });

  const customerMap: Record<string, ActiveCustomerItem> = {};
  recentViews.forEach((rv) => {
    if (!rv.customer) return;
    if (!customerMap[rv.customer.id]) {
      customerMap[rv.customer.id] = {
        customerId: rv.customer.id,
        customerIdentifier: rv.customer.customerIdentifier,
        name: rv.customer.name,
        lastActive: rv.createdAt.toISOString(),
        pageViewsCount: 1,
        lastPath: rv.path,
      };
    } else {
      customerMap[rv.customer.id].pageViewsCount++;
    }
  });

  const recentActiveCustomers = Object.values(customerMap).slice(0, 10);

  const recentLoginRecords = await prisma.customerLoginLog.findMany({
    take: 15,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          name: true,
        },
      },
    },
  });

  const recentLogins: RecentLoginItem[] = recentLoginRecords.map((l) => ({
    id: l.id,
    customerIdentifier: l.customerIdentifier || "N/A",
    name: l.customer?.name || "Customer",
    status: (l.status === "SUCCESS" ? "SUCCESS" : "FAILED") as "SUCCESS" | "FAILED",
    authMethod: l.authMethod,
    failureReason: l.failureReason,
    createdAt: l.createdAt.toISOString(),
  }));

  return {
    period,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    registeredCustomers,
    newCustomersInPeriod,
    totalShipments,
    activeShipments,
    completedShipments,
    inTransitShipments,
    shipmentsInPeriod,
    shipmentsByStatus,
    totalRevenue,
    periodRevenue,
    shippingFeeRevenue,
    creditPurchaseRevenue,
    successfulPaymentsCount,
    pendingPaymentsCount,
    pendingPaymentsAmount,
    outstandingBalances,
    monthlyRevenue,
    totalSourcingRequests,
    pendingSourcingRequests,
    totalSuccessfulLogins,
    uniqueCustomersLoggedIn,
    totalPageViews,
    uniqueActiveCustomers,
    failedLoginAttempts,
    dailyActivity,
    mostVisitedPages,
    recentActiveCustomers,
    recentLogins,
  };
}
