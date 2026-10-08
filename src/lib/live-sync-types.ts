export type HealthStatus = "OPERATIONAL" | "DEGRADED" | "DOWN" | "NOT_CONFIGURED" | "UNKNOWN";

export interface IntegrationCheckResult {
  id: string;
  name: string;
  category: "database" | "storage" | "payment" | "email" | "cron";
  status: HealthStatus;
  latencyMs: number | null;
  lastChecked: string;
  lastSuccessfulCheck: string | null;
  message: string;
  details?: Record<string, any>;
}

export interface LiveSyncReport {
  overallStatus: HealthStatus;
  timestamp: string;
  checks: IntegrationCheckResult[];
}
