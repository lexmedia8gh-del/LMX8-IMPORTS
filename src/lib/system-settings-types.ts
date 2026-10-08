export interface SystemSettingsType {
  defaultTimezone: string;
  dateTimeFormat: string;
  defaultCurrency: string;
  shipmentEmailEnabled: boolean;
  feeReminderEnabled: boolean;
  feeReminderIntervalDays: number;
  failedEmailRetryMax: number;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  updatedAt?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsType = {
  defaultTimezone: "Africa/Accra",
  dateTimeFormat: "DD/MM/YYYY",
  defaultCurrency: "GHS",
  shipmentEmailEnabled: true,
  feeReminderEnabled: true,
  feeReminderIntervalDays: 3,
  failedEmailRetryMax: 3,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
};
