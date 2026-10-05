// Server-side authoritative credit package definitions.
// These values are read by both the server action and the UI.
// DO NOT export prices/credits from client-side state.

export const CREDIT_PACKAGES = {
  starter:  { name: "Starter",  credits: 1,  price: 50  },
  standard: { name: "Standard", credits: 5,  price: 225 },
  premium:  { name: "Premium",  credits: 10, price: 400 },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
