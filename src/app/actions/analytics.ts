"use server";

import { prisma } from "@/lib/prisma";
import { requireAdminSession, getSession } from "@/lib/auth";
import { ensureAnalyticsSchema } from "@/lib/analytics-schema";

export type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

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
  // Customers
  registeredCustomers: number;
  newCustomersInPeriod: number;

  // Shipments / Logistics
  totalShipments: number;
  activeShipments: number;
  completedShipments: number;
  inTransitShipments: number;
  shipmentsInPeriod: number;
  shipmentsByStatus: ShipmentStatusCount[];

  // Financials (Verified Only)
  totalRevenue: number;
  periodRevenue: number;
  shippingFeeRevenue: number;
  creditPurchaseRevenue: number;
  successfulPaymentsCount: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  outstandingBalances: number;
  monthlyRevenue: MonthlyRevenuePoint[];

  // Sourcing
  totalSourcingRequests: number;
  pendingSourcingRequests: number;

  // Engagement & Activity
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

/**
 * Client/Server hook to record authenticated customer page views.
 * Deduplicated per session + path within a short window.
 */
export async function recordCustomerPageViewAction(path: string, title?: string) {
  try {
    const session = await getSession();
    if (!session || session.type !== "customer" || !session.id) {
      return { skipped: true, reason: "Not an authenticated customer" };
    }

    // Ignore non-portal routes or static endpoints
    if (!path.startsWith("/portal") && !path.startsWith("/pay")) {
      return { skipped: true, reason: "Non-customer route" };
    }

    // Sanitize path (strip sensitive query params or hashes)
    const cleanPath = path.split("?")[0].split("#")[0];

    await ensureAnalyticsSchema();

    // Prevent duplicate recording if identical path was recorded within the last 4 seconds
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

/**
 * Records customer login event (success or failed attempt)
 */
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

/**
 * Admin action to fetch live customer metrics, shipment stats, financial revenue, and activity.
 */
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
    // all time: default to 1 year
    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  }

  const endDate = customEnd ? new Date(customEnd) : now;

  // 1. Registered Customers & New in Period
  const [registeredCustomers, newCustomersInPeriod] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  // 2. Shipments overview
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

  // 3. Financials: Verified Successful Payments Only
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

  // Pending Payments
  const pendingPayments = await prisma.payment.findMany({
    where: { status: "PENDING" },
    select: { amount: true },
  });
  const pendingPaymentsCount = pendingPayments.length;
  const pendingPaymentsAmount = pendingPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

  // Outstanding Balances on Shipments with fee > 0
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

  // Monthly Revenue Grouping (last 6 to 12 months)
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

  // 4. Sourcing Requests
  const [totalSourcingRequests, pendingSourcingRequests] = await Promise.all([
    prisma.sourcingRequest.count(),
    prisma.sourcingRequest.count({ where: { status: "PENDING" } }),
  ]);

  // 5. Auth Events within period
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

  // Page Views within period
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

  // Unique Active Customers (Logged in or viewed page)
  const activeCustomerIds = new Set<string>();
  successfulLogins.forEach((l) => { if (l.customerId) activeCustomerIds.add(l.customerId); });
  pageViews.forEach((p) => { if (p.customerId) activeCustomerIds.add(p.customerId); });
  const uniqueActiveCustomers = activeCustomerIds.size;

  // Most Visited Pages Aggregation
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

  // Daily Activity points (Logins, Page Views, and Revenue)
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

  // Recent Active Customers
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

  // Recent Logins
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
