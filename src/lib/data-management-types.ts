export interface ResetCategory {
  id: string;
  label: string;
  desc: string;
}

export const SUPPORTED_RESET_CATEGORIES: readonly ResetCategory[] = [
  { id: "SHIPMENTS", label: "Shipments & Tracking History", desc: "All shipments, tracking events, and cargo photos" },
  { id: "SOURCING_REQUESTS", label: "Sourcing Requests", desc: "Customer product sourcing requests and quotations" },
  { id: "BATCHES", label: "Batch Operational Records", desc: "Shipping consignments and batch schedules" },
  { id: "CREDIT_LEDGER", label: "Credit Ledger & Balances", desc: "Credit transactions (resets balances to 0)" },
  { id: "LOCAL_PAYMENTS", label: "Local Payment Records", desc: "Local database payment history (does not affect external Paystack)" },
  { id: "EMAIL_LOGS_NOTIFICATIONS", label: "Email Logs & Notifications", desc: "Notification history and Brevo email delivery logs" },
  { id: "OPERATIONAL_AUDIT_LOGS", label: "Operational Audit Logs", desc: "General activity audit records (preserves Reset Audits)" },
] as const;

export type ResetCategoryId = typeof SUPPORTED_RESET_CATEGORIES[number]["id"];

export interface DatabaseOverviewResult {
  success: boolean;
  counts: {
    customers: number | null;
    batches: number | null;
    shipments: number | null;
    trackingEvents: number | null;
    payments: number | null;
    notifications: number | null;
    sourcingRequests: number | null;
    photos: number | null;
    auditLogs: number | null;
  };
  errors?: Record<string, string>;
  error?: string;
  requestId?: string;
}

export interface DataRecordsResult {
  success: boolean;
  records: any[];
  total: number;
  error?: string;
  requestId?: string;
}

export interface OperationalResetPreviewResult {
  success: boolean;
  categories: Record<string, { count: number; details: string }>;
  totalOperationalRecords: number;
  protectedInfrastructure: {
    adminAccounts: number;
    customerAccounts: number;
    brandSettings: number;
    systemSettings: number;
  };
  error?: string;
  requestId?: string;
}
