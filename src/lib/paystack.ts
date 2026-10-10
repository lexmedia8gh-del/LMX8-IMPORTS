import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Check if Paystack secret key is configured in the environment
export function isPaystackConfigured(): boolean {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  return Boolean(
    secretKey &&
    !secretKey.includes("PASTE_YOUR") &&
    secretKey !== "sk_test_placeholder_key" &&
    secretKey !== ""
  );
}

// Dynamic runtime secret key check
function getPaystackSecret(): string | null {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (
    !secretKey ||
    secretKey.includes("PASTE_YOUR") ||
    secretKey === "sk_test_placeholder_key" ||
    secretKey === ""
  ) {
    return null;
  }
  return secretKey;
}

export async function initializePayment(data: {
  amount: number;
  email: string;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}) {
  // Validate amount
  if (!data.amount || data.amount <= 0 || isNaN(data.amount)) {
    console.error("Paystack initialization validation failed: invalid amount", { amount: data.amount });
    throw new Error("Invalid payment amount.");
  }

  // Validate email address
  if (!data.email || !data.email.includes("@")) {
    console.error("Paystack initialization validation failed: invalid email", { email: data.email });
    throw new Error("A valid email address is required for payment initialization.");
  }

  const secretKey = getPaystackSecret();

  // If PAYSTACK_SECRET_KEY is not configured, run in development simulation mode
  if (!secretKey) {
    console.warn(
      `[Paystack Simulation] PAYSTACK_SECRET_KEY is not configured in this environment. Using sandbox checkout flow for reference: ${data.reference}`
    );
    const callback = data.callback_url || "/payment/success";
    const separator = callback.includes("?") ? "&" : "?";
    const mockAuthUrl = `${callback}${separator}reference=${encodeURIComponent(data.reference)}&trxref=${encodeURIComponent(data.reference)}&simulated=true`;

    return {
      authorization_url: mockAuthUrl,
      access_code: `mock_code_${Date.now()}`,
      reference: data.reference,
    };
  }

  // Prevent floating-point errors by rounding to nearest integer (pesewas/cents)
  const rawAmount = Math.round(data.amount * 100);

  let response;
  try {
    response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: rawAmount,
        email: data.email,
        reference: data.reference,
        callback_url: data.callback_url,
        metadata: data.metadata,
        currency: "GHS",
      }),
    });
  } catch (err: any) {
    console.error("Paystack API connection failure:", {
      error: err?.message || "Network error",
    });
    throw new Error("Unable to reach payment provider. Please check your network connection.");
  }

  let result;
  try {
    result = await response.json();
  } catch (err: any) {
    console.error("Paystack API response parsing failure:", {
      status: response.status,
      error: err?.message || "Invalid JSON",
    });
    throw new Error(`Invalid response from payment provider (HTTP ${response.status}).`);
  }

  if (!response.ok || !result.status) {
    console.error("Paystack initialization failed", {
      status: response.status,
      message: result.message || "Failed to initialize payment with Paystack",
    });
    throw new Error(result.message || "Failed to initialize payment with Paystack");
  }

  return result.data;
}

export async function verifyPayment(reference: string) {
  const secretKey = getPaystackSecret();

  // If PAYSTACK_SECRET_KEY is not configured, simulate successful verification using the payment record
  if (!secretKey) {
    console.warn(`[Paystack Simulation] Verifying simulated transaction for ${reference}`);
    const localPayment = await prisma.payment.findUnique({
      where: { reference },
    }).catch(() => null);

    const amountInPesewas = localPayment ? Math.round(localPayment.amount * 100) : 10000;
    const currency = localPayment?.currency || "GHS";

    return {
      status: "success",
      reference,
      amount: amountInPesewas,
      currency,
      id: `sim_tx_${Date.now()}`,
      gateway_response: "Successful (Simulated Gateway)",
      paid_at: new Date().toISOString(),
      channel: "mobile_money",
    };
  }

  let response;
  try {
    response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
  } catch (err: any) {
    console.error("Paystack Verification connection failure:", {
      error: err?.message || "Network error",
    });
    throw new Error("Unable to reach payment provider for verification.");
  }

  let result;
  try {
    result = await response.json();
  } catch (err: any) {
    console.error("Paystack Verification response parsing failure:", {
      status: response.status,
      error: err?.message || "Invalid JSON",
    });
    throw new Error(`Invalid verification response from payment provider (HTTP ${response.status}).`);
  }

  if (!response.ok || !result.status) {
    console.error("Paystack verification failed", {
      status: response.status,
      message: result.message || "Failed to verify payment with Paystack",
    });
    throw new Error(result.message || "Failed to verify payment with Paystack");
  }

  return result.data;
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secretKey = getPaystackSecret();
  if (!secretKey) {
    console.warn("Webhook verification skipped: Paystack secret key is missing or invalid.");
    return false;
  }
  const hash = crypto.createHmac("sha512", secretKey).update(payload).digest("hex");
  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
