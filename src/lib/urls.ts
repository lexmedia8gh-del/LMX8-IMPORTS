/**
 * Utility helpers for application base URLs and payment callbacks.
 */

export function getAppBaseUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }

  return "http://localhost:3000";
}

export function getPaymentCallbackUrl(reference?: string): string {
  const base = getAppBaseUrl();
  const url = `${base}/portal/payments/verify`;
  if (reference) {
    return `${url}?reference=${encodeURIComponent(reference)}`;
  }
  return url;
}
