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

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  registeredCustomers: number;
  totalSuccessfulLogins: number;
  uniqueCustomersLoggedIn: number;
  totalPageViews: number;
  uniqueActiveCustomers: number;
  failedLoginAttempts: number;
  dailyActivity: DailyActivityPoint[];
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
    // Fail silently so page view tracking never interferes with customer experience
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
 * Admin action to fetch aggregated customer login and page visit metrics.
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
    // all time: 1 year ago default
    startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  }

  const endDate = customEnd ? new Date(customEnd) : now;

  // 1. Registered Customers
  const registeredCustomers = await prisma.customer.count();

  // 2. Successful Logins within range
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

  // 3. Failed Logins within range
  const failedLoginAttempts = await prisma.customerLoginLog.count({
    where: {
      status: "FAILED",
      createdAt: { gte: startDate, lte: endDate },
    },
  });

  // 4. Page Views within range
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

  // 5. Unique Active Customers (Logged in or viewed a page)
  const activeCustomerIds = new Set<string>();
  successfulLogins.forEach((l) => { if (l.customerId) activeCustomerIds.add(l.customerId); });
  pageViews.forEach((p) => { if (p.customerId) activeCustomerIds.add(p.customerId); });
  const uniqueActiveCustomers = activeCustomerIds.size;

  // 6. Most Visited Pages Aggregation
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

  // 7. Daily Activity Data points (last 7 or up to 14 days)
  const daysDiff = Math.max(1, Math.min(30, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))));
  const dailyMap: Record<string, { logins: number; pageViews: number; displayDate: string }> = {};

  for (let i = 0; i < daysDiff; i++) {
    const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split("T")[0];
    const display = d.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
    dailyMap[key] = { logins: 0, pageViews: 0, displayDate: display };
  }

  successfulLogins.forEach((l) => {
    const key = l.createdAt.toISOString().split("T")[0];
    if (dailyMap[key]) dailyMap[key].logins++;
  });

  pageViews.forEach((pv) => {
    const key = pv.createdAt.toISOString().split("T")[0];
    if (dailyMap[key]) dailyMap[key].pageViews++;
  });

  const dailyActivity: DailyActivityPoint[] = Object.entries(dailyMap).map(([date, val]) => ({
    date,
    displayDate: val.displayDate,
    logins: val.logins,
    pageViews: val.pageViews,
  }));

  // 8. Recent Active Customers
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

  // 9. Recent Logins List
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
    registeredCustomers,
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
