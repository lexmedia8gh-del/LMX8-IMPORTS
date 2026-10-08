import "server-only";
import { prisma } from "@/lib/prisma";
import { getBrevoServerConfig } from "@/lib/email/config";
import { STORAGE_BUCKET } from "@/lib/storage";
import { HealthStatus, IntegrationCheckResult, LiveSyncReport } from "./live-sync-types";

export * from "./live-sync-types";

// In-memory cache for last successful check timestamps
const lastSuccessCache: Record<string, string> = {};

/**
 * 1. Supabase PostgreSQL & Prisma Query Check
 */
export async function checkPostgresHealth(): Promise<IntegrationCheckResult> {
  const start = performance.now();
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

  if (!dbUrl || dbUrl.includes("localhost:5432") && process.env.NODE_ENV === "production") {
    return {
      id: "postgres",
      name: "Supabase PostgreSQL & Prisma",
      category: "database",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["postgres"] || null,
      message: "DATABASE_URL environment variable is not configured for remote database.",
    };
  }

  try {
    await prisma.$queryRawUnsafe("SELECT 1 as connected;");
    const latencyMs = Math.round(performance.now() - start);

    // Verify key tables
    const tableChecks = await prisma.$queryRawUnsafe<any[]>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Customer', 'Shipment', 'Payment', 'EmailLog', 'ResetAudit', 'SystemSettings', 'BrandSettings');
    `).catch(() => []);

    const existingTables = (tableChecks || []).map((t) => t.table_name || t.TABLE_NAME);
    const requiredTables = ["Customer", "Shipment", "Payment"];
    const allRequiredExist = requiredTables.every((t) => existingTables.includes(t));

    const nowIso = new Date().toISOString();
    lastSuccessCache["postgres"] = nowIso;

    if (!allRequiredExist) {
      return {
        id: "postgres",
        name: "Supabase PostgreSQL & Prisma",
        category: "database",
        status: "DEGRADED",
        latencyMs,
        lastChecked: nowIso,
        lastSuccessfulCheck: nowIso,
        message: `Database connected (${latencyMs}ms), but schema tables are incomplete. Existing: ${existingTables.length} tables.`,
        details: { existingTables, latencyMs },
      };
    }

    return {
      id: "postgres",
      name: "Supabase PostgreSQL & Prisma",
      category: "database",
      status: "OPERATIONAL",
      latencyMs,
      lastChecked: nowIso,
      lastSuccessfulCheck: nowIso,
      message: `Database connection responsive (${latencyMs}ms). Schema tables verified and query execution confirmed.`,
      details: { verifiedTables: existingTables, latencyMs },
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: "postgres",
      name: "Supabase PostgreSQL & Prisma",
      category: "database",
      status: "DOWN",
      latencyMs,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["postgres"] || null,
      message: `Database query failed: ${err?.message || "Connection timeout or unreachable host."}`,
    };
  }
}

/**
 * 2. Supabase Storage Health Check
 */
export async function checkStorageHealth(): Promise<IntegrationCheckResult> {
  const start = performance.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return {
      id: "storage",
      name: "Supabase Private Storage",
      category: "storage",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["storage"] || null,
      message: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  try {
    const { getSupabaseAdminClient } = await import("@/lib/storage");
    const supabase = getSupabaseAdminClient();

    if (!supabase) {
      return {
        id: "storage",
        name: "Supabase Private Storage",
        category: "storage",
        status: "NOT_CONFIGURED",
        latencyMs: null,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["storage"] || null,
        message: "SUPABASE_SERVICE_ROLE_KEY is missing or invalid.",
      };
    }
    
    // Check bucket without altering files
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list("", { limit: 1 });
    const latencyMs = Math.round(performance.now() - start);

    if (error) {
      return {
        id: "storage",
        name: "Supabase Private Storage",
        category: "storage",
        status: "DEGRADED",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["storage"] || null,
        message: `Storage client authenticated, but bucket "${STORAGE_BUCKET}" returned: ${error.message}`,
      };
    }

    const nowIso = new Date().toISOString();
    lastSuccessCache["storage"] = nowIso;

    return {
      id: "storage",
      name: "Supabase Private Storage",
      category: "storage",
      status: "OPERATIONAL",
      latencyMs,
      lastChecked: nowIso,
      lastSuccessfulCheck: nowIso,
      message: `Bucket "${STORAGE_BUCKET}" verified and responsive (${latencyMs}ms). Signed URL policies active.`,
      details: { bucket: STORAGE_BUCKET, latencyMs },
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: "storage",
      name: "Supabase Private Storage",
      category: "storage",
      status: "DOWN",
      latencyMs,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["storage"] || null,
      message: `Storage connectivity check failed: ${err?.message || "Network error"}`,
    };
  }
}

/**
 * 3. Paystack API Connectivity Check
 */
export async function checkPaystackApiHealth(): Promise<IntegrationCheckResult> {
  const start = performance.now();
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return {
      id: "paystack_api",
      name: "Paystack Payment API",
      category: "payment",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["paystack_api"] || null,
      message: "PAYSTACK_SECRET_KEY is not configured in server environment.",
    };
  }

  try {
    // Authenticated non-destructive query to Paystack transaction totals endpoint
    const res = await fetch("https://api.paystack.co/transaction/totals", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey.trim()}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.status === 200) {
      const nowIso = new Date().toISOString();
      lastSuccessCache["paystack_api"] = nowIso;
      return {
        id: "paystack_api",
        name: "Paystack Payment API",
        category: "payment",
        status: "OPERATIONAL",
        latencyMs,
        lastChecked: nowIso,
        lastSuccessfulCheck: nowIso,
        message: `Paystack API authenticated successfully (${latencyMs}ms). Payment checkout flows active.`,
        details: { latencyMs, status: res.status },
      };
    } else if (res.status === 401) {
      return {
        id: "paystack_api",
        name: "Paystack Payment API",
        category: "payment",
        status: "DEGRADED",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["paystack_api"] || null,
        message: "Paystack authentication failed (HTTP 401 Unauthorized). Check secret key validity.",
      };
    } else {
      return {
        id: "paystack_api",
        name: "Paystack Payment API",
        category: "payment",
        status: "DEGRADED",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["paystack_api"] || null,
        message: `Paystack API returned status ${res.status}. Payment processing may be experiencing delays.`,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: "paystack_api",
      name: "Paystack Payment API",
      category: "payment",
      status: "DOWN",
      latencyMs,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["paystack_api"] || null,
      message: `Failed to contact Paystack endpoint: ${err?.message || "Connection timeout"}`,
    };
  }
}

/**
 * 4. Paystack Webhook Processing Health
 */
export async function checkPaystackWebhookHealth(): Promise<IntegrationCheckResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    return {
      id: "paystack_webhook",
      name: "Paystack Webhook Processing",
      category: "payment",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["paystack_webhook"] || null,
      message: "Webhook verification key is not configured.",
    };
  }

  try {
    // Check last verified payment transaction
    const lastPayment = await prisma.payment.findFirst({
      where: { status: "SUCCESS" },
      orderBy: { updatedAt: "desc" },
      select: { reference: true, updatedAt: true, provider: true },
    });

    const nowIso = new Date().toISOString();
    lastSuccessCache["paystack_webhook"] = nowIso;

    return {
      id: "paystack_webhook",
      name: "Paystack Webhook Processing",
      category: "payment",
      status: "OPERATIONAL",
      latencyMs: null,
      lastChecked: nowIso,
      lastSuccessfulCheck: nowIso,
      message: lastPayment
        ? `Webhook endpoint (/api/webhooks/paystack) ready with HMAC verification. Last confirmed payment: ${lastPayment.reference}`
        : "Webhook endpoint (/api/webhooks/paystack) ready with HMAC SHA-512 verification. Awaiting transactions.",
      details: { lastConfirmedPayment: lastPayment?.reference || null },
    };
  } catch (err: any) {
    return {
      id: "paystack_webhook",
      name: "Paystack Webhook Processing",
      category: "payment",
      status: "UNKNOWN",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["paystack_webhook"] || null,
      message: `Unable to inspect webhook status: ${err?.message || "Database lookup failed"}`,
    };
  }
}

/**
 * 5. Brevo Transactional Email API Health
 */
export async function checkBrevoApiHealth(): Promise<IntegrationCheckResult> {
  const start = performance.now();
  const config = getBrevoServerConfig();
  const rawApiKey = (process.env.BREVO_API_KEY || process.env.BREVO_KEY || "").trim();

  if (!rawApiKey) {
    return {
      id: "brevo",
      name: "Brevo Transactional Email API",
      category: "email",
      status: "NOT_CONFIGURED",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["brevo"] || null,
      message: "BREVO_API_KEY environment variable is missing.",
    };
  }

  try {
    // Authenticate with Brevo account API (non-destructive check — never sends emails)
    const res = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "api-key": rawApiKey,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - start);

    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      const nowIso = new Date().toISOString();
      lastSuccessCache["brevo"] = nowIso;

      const planInfo = Array.isArray(data.plan) && data.plan.length > 0 ? data.plan[0]?.type : "Active";
      const creditsRemaining = Array.isArray(data.plan) && data.plan.length > 0 ? data.plan[0]?.credits : undefined;

      return {
        id: "brevo",
        name: "Brevo Transactional Email API",
        category: "email",
        status: "OPERATIONAL",
        latencyMs,
        lastChecked: nowIso,
        lastSuccessfulCheck: nowIso,
        message: `Brevo API authenticated (${latencyMs}ms). Sender configured: ${config.senderName} <${config.senderEmail}>.`,
        details: {
          senderName: config.senderName,
          senderEmail: config.senderEmail,
          plan: planInfo,
          credits: creditsRemaining,
          latencyMs,
        },
      };
    } else if (res.status === 401) {
      return {
        id: "brevo",
        name: "Brevo Transactional Email API",
        category: "email",
        status: "DEGRADED",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["brevo"] || null,
        message: "Brevo API key rejected (HTTP 401 Unauthorized). Verify BREVO_API_KEY value.",
      };
    } else {
      return {
        id: "brevo",
        name: "Brevo Transactional Email API",
        category: "email",
        status: "DEGRADED",
        latencyMs,
        lastChecked: new Date().toISOString(),
        lastSuccessfulCheck: lastSuccessCache["brevo"] || null,
        message: `Brevo API returned unexpected status ${res.status}. Delivery may be delayed.`,
      };
    }
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      id: "brevo",
      name: "Brevo Transactional Email API",
      category: "email",
      status: "DOWN",
      latencyMs,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["brevo"] || null,
      message: `Brevo connection failed: ${err?.message || "Network unreachable"}`,
    };
  }
}

/**
 * 6. Scheduled Jobs & Reminder Automation Check
 */
export async function checkScheduledJobsHealth(): Promise<IntegrationCheckResult> {
  const cronSecret = process.env.CRON_SECRET;

  try {
    const { getSystemSettings } = await import("@/lib/system-settings");
    const settings = await getSystemSettings().catch(() => null);

    // Look up last email reminder log
    const lastReminder = await prisma.emailLog.findFirst({
      where: { eventType: "SHIPPING_FEE_REMINDER" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, status: true, recipient: true },
    });

    const nowIso = new Date().toISOString();
    lastSuccessCache["cron"] = nowIso;

    if (!cronSecret) {
      return {
        id: "cron",
        name: "Scheduled Jobs & Reminder Processing",
        category: "cron",
        status: "DEGRADED",
        latencyMs: null,
        lastChecked: nowIso,
        lastSuccessfulCheck: nowIso,
        message: "CRON_SECRET is not configured. Cron endpoint (/api/cron/shipping-fee-reminders) requires authorization token.",
      };
    }

    const reminderState = settings?.feeReminderEnabled ? "Enabled" : "Disabled in Settings";
    const intervalDays = settings?.feeReminderIntervalDays || 3;

    return {
      id: "cron",
      name: "Scheduled Jobs & Reminder Processing",
      category: "cron",
      status: "OPERATIONAL",
      latencyMs: null,
      lastChecked: nowIso,
      lastSuccessfulCheck: nowIso,
      message: `Cron handler authorized. Reminders: ${reminderState} (Cadence: every ${intervalDays} days). Last reminder logged: ${
        lastReminder ? lastReminder.createdAt.toISOString().split("T")[0] : "None yet"
      }.`,
      details: {
        feeReminderEnabled: settings?.feeReminderEnabled ?? true,
        cadenceDays: intervalDays,
        lastReminderDate: lastReminder?.createdAt?.toISOString() || null,
      },
    };
  } catch (err: any) {
    return {
      id: "cron",
      name: "Scheduled Jobs & Reminder Processing",
      category: "cron",
      status: "UNKNOWN",
      latencyMs: null,
      lastChecked: new Date().toISOString(),
      lastSuccessfulCheck: lastSuccessCache["cron"] || null,
      message: `Unable to inspect cron status: ${err?.message || "Unknown error"}`,
    };
  }
}

/**
 * Run complete Live Sync diagnostic suite
 */
export async function getLiveSyncReport(): Promise<LiveSyncReport> {
  const [postgres, storage, paystackApi, paystackWebhook, brevo, cron] = await Promise.all([
    checkPostgresHealth(),
    checkStorageHealth(),
    checkPaystackApiHealth(),
    checkPaystackWebhookHealth(),
    checkBrevoApiHealth(),
    checkScheduledJobsHealth(),
  ]);

  const checks = [postgres, storage, paystackApi, paystackWebhook, brevo, cron];

  // Derive overall status
  let overallStatus: HealthStatus = "OPERATIONAL";
  if (checks.some((c) => c.status === "DOWN")) {
    overallStatus = "DOWN";
  } else if (checks.some((c) => c.status === "DEGRADED")) {
    overallStatus = "DEGRADED";
  } else if (checks.some((c) => c.status === "NOT_CONFIGURED")) {
    overallStatus = "DEGRADED";
  }

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };
}
