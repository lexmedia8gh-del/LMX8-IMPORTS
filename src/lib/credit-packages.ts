// Server-side authoritative credit package definitions.
// These values are read by both the server action and the UI.
// DO NOT export prices/credits from client-side state.

export const CREDIT_PACKAGES = {
  starter:  { name: "Starter",  credits: 5,  price: 30  },
  standard: { name: "Standard", credits: 12, price: 90  },
  premium:  { name: "Premium",  credits: 20, price: 185 },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
