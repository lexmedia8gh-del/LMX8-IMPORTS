import crypto from "crypto";

// Dynamic runtime secret key check
function requirePaystackSecret() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey || secretKey.includes("PASTE_YOUR") || secretKey === "sk_test_placeholder_key" || secretKey === "") {
    console.error("Paystack configuration error: PAYSTACK_SECRET_KEY is missing or invalid. Configured:", false);
    throw new Error("Paystack payment gateway is not configured. Please contact administrator.");
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
  const secretKey = requirePaystackSecret();

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
  const secretKey = requirePaystackSecret();

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
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey || secretKey.includes("PASTE_YOUR") || secretKey === "sk_test_placeholder_key" || secretKey === "") {
    console.error("Webhook verification aborted: Paystack secret key is missing or invalid.");
    return false;
  }
  const hash = crypto.createHmac("sha512", secretKey).update(payload).digest("hex");
  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
