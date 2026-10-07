import "server-only";

export interface BrevoServerConfig {
  apiKeyConfigured: boolean;
  senderName: string | null;
  senderEmail: string | null;
  environment: string;
}

/**
 * Reads server-side Brevo environment variables directly from Vercel/Node runtime.
 * Never exposes the raw API key to the client.
 */
export function getBrevoServerConfig(): BrevoServerConfig {
  const rawApiKey = process.env.BREVO_API_KEY?.trim() || "";
  const rawSenderName = process.env.BREVO_SENDER_NAME?.trim() || null;
  const rawSenderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || null;

  const vercelEnv = process.env.VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;
  let environment = "Production";
  if (vercelEnv) {
    environment = vercelEnv.charAt(0).toUpperCase() + vercelEnv.slice(1);
  } else if (nodeEnv) {
    environment = nodeEnv === "production" ? "Production" : (nodeEnv.charAt(0).toUpperCase() + nodeEnv.slice(1));
  }

  return {
    apiKeyConfigured: Boolean(rawApiKey && rawApiKey.length > 0),
    senderName: rawSenderName,
    senderEmail: rawSenderEmail,
    environment,
  };
}

export interface BrevoValidationResult {
  valid: boolean;
  apiKey: string | null;
  senderName: string | null;
  senderEmail: string | null;
  environment: string;
  errors: string[];
}

/**
 * Validates the presence of required Brevo configuration.
 * Evaluates all fields independently without short-circuiting so diagnostics receive complete status.
 */
export function validateBrevoConfig(): BrevoValidationResult {
  const config = getBrevoServerConfig();
  const errors: string[] = [];

  const rawApiKey = process.env.BREVO_API_KEY?.trim() || null;

  if (!config.apiKeyConfigured) {
    errors.push("BREVO_API_KEY is not configured");
  }
  if (!config.senderName) {
    errors.push("BREVO_SENDER_NAME is not configured");
  }
  if (!config.senderEmail || !config.senderEmail.includes("@")) {
    errors.push("BREVO_SENDER_EMAIL is not configured");
  }

  return {
    valid: errors.length === 0,
    apiKey: rawApiKey,
    senderName: config.senderName,
    senderEmail: config.senderEmail,
    environment: config.environment,
    errors,
  };
}

export interface BrevoDiagnosticsReport {
  apiKeyConfigured: boolean;
  senderName: string | null;
  senderEmail: string | null;
  environment: string;
  // Backward compatibility fields for legacy views:
  BREVO_API_KEY: "configured" | "missing";
  BREVO_SENDER_NAME: string | null;
  BREVO_SENDER_EMAIL: string | null;
  senderEmailValue: string | null;
}

/**
 * Returns safe diagnostic status for admin monitoring.
 */
export function getBrevoDiagnostics(): BrevoDiagnosticsReport {
  const config = getBrevoServerConfig();

  return {
    apiKeyConfigured: config.apiKeyConfigured,
    senderName: config.senderName,
    senderEmail: config.senderEmail,
    environment: config.environment,

    BREVO_API_KEY: config.apiKeyConfigured ? "configured" : "missing",
    BREVO_SENDER_NAME: config.senderName,
    BREVO_SENDER_EMAIL: config.senderEmail,
    senderEmailValue: config.senderEmail,
  };
}
