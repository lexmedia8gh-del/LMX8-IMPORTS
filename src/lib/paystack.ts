import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes("PASTE_YOUR") || PAYSTACK_SECRET_KEY === "sk_test_placeholder_key") {
  console.warn("WARNING: PAYSTACK_SECRET_KEY is not configured or uses a placeholder.");
}

function requirePaystackSecret() {
  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes("PASTE_YOUR") || PAYSTACK_SECRET_KEY === "sk_test_placeholder_key") {
    throw new Error("Paystack is not configured. Please set PAYSTACK_SECRET_KEY.");
  }
  return PAYSTACK_SECRET_KEY;
}

export async function initializePayment(data: {
  amount: number;
  email: string;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}) {
  const secretKey = requirePaystackSecret();

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: data.amount * 100, // Paystack expects amount in kobo/pesewas
      email: data.email,
      reference: data.reference,
      callback_url: data.callback_url,
      metadata: data.metadata,
      currency: "GHS",
    }),
  });

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.message || "Failed to initialize payment with Paystack");
  }

  return result.data;
}

export async function verifyPayment(reference: string) {
  const secretKey = requirePaystackSecret();

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const result = await response.json();
  if (!result.status) {
    throw new Error(result.message || "Failed to verify payment with Paystack");
  }

  return result.data;
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!PAYSTACK_SECRET_KEY || PAYSTACK_SECRET_KEY.includes("PASTE_YOUR") || PAYSTACK_SECRET_KEY === "sk_test_placeholder_key") {
    return false;
  }
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(payload).digest("hex");
  if (hash.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}
