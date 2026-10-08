/**
 * Currency and financial formatting utilities for LMX8 IMPORTS.
 * Single source of truth for currency display across the application.
 */

export function formatCurrency(amount: number | string | null | undefined, currency: string = "GHS"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num === null || num === undefined || isNaN(num)) {
    return "GH₵ 0.00";
  }

  // Consistent Ghanaian Cedi display
  const formatted = num.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency === "GHS" || !currency) {
    return `GH₵ ${formatted}`;
  }

  return `${currency} ${formatted}`;
}

export function formatCredits(credits: number | null | undefined): string {
  const val = credits || 0;
  return `${val.toLocaleString()} ${val === 1 ? "Credit" : "Credits"}`;
}
