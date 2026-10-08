"use server";

import { requireAdminSession } from "@/lib/auth";
import {
  getLiveSyncReport,
  checkPostgresHealth,
  checkStorageHealth,
  checkPaystackApiHealth,
  checkPaystackWebhookHealth,
  checkBrevoApiHealth,
  checkScheduledJobsHealth,
  LiveSyncReport,
  IntegrationCheckResult,
} from "@/lib/live-sync";

export async function getLiveSyncReportAction(): Promise<LiveSyncReport> {
  await requireAdminSession();
  return getLiveSyncReport();
}

export async function checkSingleIntegrationAction(id: string): Promise<IntegrationCheckResult> {
  await requireAdminSession();

  switch (id) {
    case "postgres":
      return checkPostgresHealth();
    case "storage":
      return checkStorageHealth();
    case "paystack_api":
      return checkPaystackApiHealth();
    case "paystack_webhook":
      return checkPaystackWebhookHealth();
    case "brevo":
      return checkBrevoApiHealth();
    case "cron":
      return checkScheduledJobsHealth();
    default:
      throw new Error(`Unknown integration identifier: ${id}`);
  }
}
