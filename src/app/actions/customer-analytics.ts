"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentCustomer, requireAdminSession } from "@/lib/auth";

export async function recordCustomerPageViewAction(path: string, pageTitle?: string) {
  try {
    const customer = await getCurrentCustomer();
    if (!customer || customer.status !== "ACTIVE") return { success: false };

    // Ignore API routes, asset paths, and non-portal routes
    if (!path || !path.startsWith("/portal") || path.startsWith("/api")) {
      return { success: false };
    }

    // Sanitize path (strip query params and hashes for privacy and deduplication)
    const sanitizedPath = path.split("?")[0].split("#")[0];

    await prisma.customerPageView.create({
      data: {
        customerId: customer.id,
        path: sanitizedPath,
        pageTitle: pageTitle ? pageTitle.slice(0, 120) : undefined,
      },
    });

    return { success: true };
  } catch (err: any) {
    // Non-blocking telemetry failure
    console.warn("[Analytics] Page view record error:", err?.message || err);
    return { success: false };
  }
}

export type AnalyticsPeriod = "today" | "7d" | "30d" | "custom";

export interface CustomerAnalyticsOverview {
  period: AnalyticsPeriod;
  dateRange: { start: string; end: string };
  kpis: {
    totalCustomers: number;
    successfulLogins: number;
    uniqueCustomersLoggedIn: number;
    totalPageViews: number;
    uniqueActiveCustomers: number;
    failedLogins: number;
    lockedAttempts: number;
  };
  loginActivitySeries: { date: string; success: number; failed: number }[];
  pageViewsSeries: { date: string; views: number }[];
  mostVisitedPages: { path: string; label: string; views: number; uniqueVisitors: number }[];
  recentlyActiveCustomers: {
    id: string;
    customerIdentifier: string;
    name: string;
    email: string;
    phone: string;
    lastActiveAt: string;
    totalPageViews: number;
    status: string;
  }[];
  recentAuthEvents: {
    id: string;
    customerIdentifier: string;
    name?: string;
    method: string;
    outcome: string;
    createdAt: string;
  }[];
}

const PAGE_LABELS: Record<string, string> = {
  "/portal": "Dashboard Overview",
  "/portal/shipments": "Shipment Directory",
  "/portal/payments": "Shipping Payments",
  "/portal/sourcing": "Product Sourcing",
  "/portal/credits": "Sourcing Credits & Packages",
  "/portal/notifications": "Notifications Center",
  "/portal/profile": "Account Profile & PIN Settings",
};

export async function getCustomerAnalyticsOverviewAction(
  period: AnalyticsPeriod = "7d",
  customRange?: { from: string; to: string }
): Promise<CustomerAnalyticsOverview> {
  await requireAdminSession();

  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now.getTime());

  if (period === "today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "7d") {
    startDate.setDate(now.getDate() - 7);
  } else if (period === "30d") {
    startDate.setDate(now.getDate() - 30);
  } else if (period === "custom" && customRange?.from) {
    startDate = new Date(customRange.from);
    if (customRange.to) {
      endDate = new Date(customRange.to);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  // Fallback check
  if (isNaN(startDate.getTime())) {
    startDate = new Date();
    startDate.setDate(now.getDate() - 7);
  }

  // 1. Total Registered Customers
  const totalCustomers = await prisma.customer.count();

  // 2. Auth Events within period
  const authEventsInPeriod = await prisma.customerAuthEvent.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const successfulLogins = authEventsInPeriod.filter((e) => e.outcome === "SUCCESS").length;
  const failedLogins = authEventsInPeriod.filter((e) => e.outcome === "FAILED").length;
  const lockedAttempts = authEventsInPeriod.filter((e) => e.outcome === "LOCKED").length;

  const uniqueLoggedInSet = new Set(
    authEventsInPeriod.filter((e) => e.outcome === "SUCCESS" && e.customerId).map((e) => e.customerId!)
  );
  const uniqueCustomersLoggedIn = uniqueLoggedInSet.size;

  // 3. Page Views within period
  const pageViewsInPeriod = await prisma.customerPageView.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      customer: {
        select: {
          id: true,
          customerIdentifier: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalPageViews = pageViewsInPeriod.length;
  const uniqueActiveSet = new Set(pageViewsInPeriod.map((pv) => pv.customerId));
  const uniqueActiveCustomers = uniqueActiveSet.size;

  // 4. Daily series aggregation
  const daysMap = new Map<string, { success: number; failed: number; views: number }>();
  
  // Initialize days in range (up to 31 days)
  const daysDiff = Math.min(31, Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))));
  for (let i = 0; i <= daysDiff; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    if (d > endDate) break;
    const key = d.toISOString().split("T")[0];
    daysMap.set(key, { success: 0, failed: 0, views: 0 });
  }

  for (const e of authEventsInPeriod) {
    const key = e.createdAt.toISOString().split("T")[0];
    const item = daysMap.get(key) || { success: 0, failed: 0, views: 0 };
    if (e.outcome === "SUCCESS") item.success += 1;
    else item.failed += 1;
    daysMap.set(key, item);
  }

  for (const pv of pageViewsInPeriod) {
    const key = pv.createdAt.toISOString().split("T")[0];
    const item = daysMap.get(key) || { success: 0, failed: 0, views: 0 };
    item.views += 1;
    daysMap.set(key, item);
  }

  const sortedDays = Array.from(daysMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const loginActivitySeries = sortedDays.map(([date, data]) => ({
    date,
    success: data.success,
    failed: data.failed,
  }));
  const pageViewsSeries = sortedDays.map(([date, data]) => ({
    date,
    views: data.views,
  }));

  // 5. Most visited pages
  const pageCountsMap = new Map<string, { views: number; visitors: Set<string> }>();
  for (const pv of pageViewsInPeriod) {
    const pathKey = pv.path.startsWith("/portal/shipments/")
      ? "/portal/shipments/[id]"
      : pv.path.startsWith("/portal/payments/")
      ? "/portal/payments/[id]"
      : pv.path;

    const current = pageCountsMap.get(pathKey) || { views: 0, visitors: new Set<string>() };
    current.views += 1;
    current.visitors.add(pv.customerId);
    pageCountsMap.set(pathKey, current);
  }

  const mostVisitedPages = Array.from(pageCountsMap.entries())
    .map(([path, data]) => ({
      path,
      label: PAGE_LABELS[path] || (path.includes("[id]") ? "Shipment / Payment Detail" : path),
      views: data.views,
      uniqueVisitors: data.visitors.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // 6. Recently active customers
  const recentActiveCustomerMap = new Map<
    string,
    {
      id: string;
      customerIdentifier: string;
      name: string;
      email: string;
      phone: string;
      lastActiveAt: Date;
      totalPageViews: number;
      status: string;
    }
  >();

  for (const pv of pageViewsInPeriod) {
    if (!pv.customer) continue;
    const cid = pv.customer.id;
    const existing = recentActiveCustomerMap.get(cid);
    if (!existing) {
      recentActiveCustomerMap.set(cid, {
        id: pv.customer.id,
        customerIdentifier: pv.customer.customerIdentifier,
        name: pv.customer.name,
        email: pv.customer.email || "N/A",
        phone: pv.customer.phone || "N/A",
        lastActiveAt: pv.createdAt,
        totalPageViews: 1,
        status: pv.customer.status,
      });
    } else {
      existing.totalPageViews += 1;
      if (pv.createdAt > existing.lastActiveAt) {
        existing.lastActiveAt = pv.createdAt;
      }
    }
  }

  const recentlyActiveCustomers = Array.from(recentActiveCustomerMap.values())
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
    .slice(0, 15)
    .map((c) => ({
      ...c,
      lastActiveAt: c.lastActiveAt.toISOString(),
    }));

  // 7. Recent auth events with customer details
  const recentAuthEventsSlice = authEventsInPeriod.slice(0, 20);
  const customerIds = recentAuthEventsSlice.map((e) => e.customerId).filter(Boolean) as string[];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, name: true, customerIdentifier: true },
  });
  const customerLookup = new Map(customers.map((c) => [c.id, c]));

  const recentAuthEvents = recentAuthEventsSlice.map((e) => ({
    id: e.id,
    customerIdentifier: e.customerIdentifier || (e.customerId ? customerLookup.get(e.customerId)?.customerIdentifier : null) || "Unknown",
    name: e.customerId ? customerLookup.get(e.customerId)?.name : undefined,
    method: e.method,
    outcome: e.outcome,
    createdAt: e.createdAt.toISOString(),
  }));

  return {
    period,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    kpis: {
      totalCustomers,
      successfulLogins,
      uniqueCustomersLoggedIn,
      totalPageViews,
      uniqueActiveCustomers,
      failedLogins,
      lockedAttempts,
    },
    loginActivitySeries,
    pageViewsSeries,
    mostVisitedPages,
    recentlyActiveCustomers,
    recentAuthEvents,
  };
}

export async function getCustomerActivityHistoryAction(customerId: string) {
  await requireAdminSession();

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      customerIdentifier: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      pageViews: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      authEvents: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!customer) {
    return { error: "Customer not found." };
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      customerIdentifier: customer.customerIdentifier,
      email: customer.email || "N/A",
      phone: customer.phone || "N/A",
      status: customer.status,
      createdAt: customer.createdAt.toISOString(),
      pageViews: customer.pageViews.map((pv) => ({
        id: pv.id,
        path: pv.path,
        pageTitle: pv.pageTitle || "",
        createdAt: pv.createdAt.toISOString(),
      })),
      authEvents: customer.authEvents.map((ae) => ({
        id: ae.id,
        method: ae.method,
        outcome: ae.outcome,
        createdAt: ae.createdAt.toISOString(),
      })),
    },
  };
}
