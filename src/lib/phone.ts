/**
 * Centralized Phone Normalization Utility for LMX8 IMPORTS
 * 
 * Enforces canonical E.164 phone representation (+233XXXXXXXXX for Ghana).
 * Normalizes input across registration, customer editing, login, searching,
 * duplicate checking, and database storage.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  error?: string;
  isGhanaian?: boolean;
}

/**
 * Normalizes phone numbers to standard canonical format (+233XXXXXXXXX for Ghana).
 * Strips whitespace, hyphens, parentheses, and dots.
 * 
 * Examples that resolve to identical canonical format:
 * - 0241234567   -> +233241234567
 * - +233241234567 -> +233241234567
 * - 233241234567 -> +233241234567
 * - 024 123 4567 -> +233241234567
 * - 024-123-4567 -> +233241234567
 * - 241234567    -> +233241234567
 * 
 * Preserves valid international numbers (e.g. +14155552671, +447911123456).
 * Rejects invalid, empty, or dummy phone numbers.
 */
export function normalizePhoneNumber(input: string | null | undefined): PhoneValidationResult {
  if (!input) {
    return { isValid: false, normalized: "", error: "Phone number is required." };
  }

  // 1. Remove spaces, hyphens, parentheses, dots, tabs
  let cleaned = input.trim().replace(/[\s\-\(\)\.\t]/g, "");

  if (!cleaned) {
    return { isValid: false, normalized: "", error: "Phone number cannot be empty." };
  }

  // 2. Check and strip leading '+'
  const hasPlus = cleaned.startsWith("+");
  if (hasPlus) {
    cleaned = cleaned.substring(1);
  }

  // 3. Must be strictly numeric digits now
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: "",
      error: "Phone number must contain only numeric digits.",
    };
  }

  // 4. Reject repetitive/dummy sequences (e.g. 0000000000, 1111111111)
  if (/^(\d)\1{6,}$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: "",
      error: "Please enter a valid, non-repetitive phone number.",
    };
  }

  // 5. Ghanaian Numbers Normalization
  // Recognized Ghanaian mobile/fixed prefixes (local 9 digits):
  // MTN: 24, 25, 53, 54, 55, 59
  // Vodafone/Telecel: 20, 50
  // AirtelTigo: 27, 57, 26
  // Glo: 23
  // Fixed lines: 30, 31, 32, 33, 34, 35, 36, 37, 38, 39
  const ghanaPrefixes = ["20", "23", "24", "25", "26", "27", "28", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "50", "53", "54", "55", "57", "59"];

  // Case A: 233 followed by 9 digits (12 digits total)
  if (cleaned.startsWith("233")) {
    const national = cleaned.substring(3);
    if (national.length === 9) {
      return { isValid: true, normalized: `+233${national}`, isGhanaian: true };
    }
  }

  // Case B: Leading '0' followed by 9 digits (10 digits total, e.g. 0241234567)
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    const national = cleaned.substring(1);
    const prefix = national.substring(0, 2);
    if (ghanaPrefixes.includes(prefix)) {
      return { isValid: true, normalized: `+233${national}`, isGhanaian: true };
    }
    // General 10-digit Ghanaian mobile/landline fallback
    return { isValid: true, normalized: `+233${national}`, isGhanaian: true };
  }

  // Case C: 9 digits without leading 0 or 233 (e.g. 241234567)
  if (cleaned.length === 9) {
    const prefix = cleaned.substring(0, 2);
    if (ghanaPrefixes.includes(prefix)) {
      return { isValid: true, normalized: `+233${cleaned}`, isGhanaian: true };
    }
  }

  // 6. International Numbers
  // If user provided '+' prefix with 8 to 15 digits
  if (hasPlus) {
    if (cleaned.length >= 8 && cleaned.length <= 15) {
      return { isValid: true, normalized: `+${cleaned}`, isGhanaian: cleaned.startsWith("233") };
    }
    return {
      isValid: false,
      normalized: "",
      error: "International phone number must be between 8 and 15 digits.",
    };
  }

  // 7. Ghanaian 10-digit without recognized prefix or international without +
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return { isValid: true, normalized: `+233${cleaned.substring(1)}`, isGhanaian: true };
  }

  if (cleaned.length >= 9 && cleaned.length <= 15) {
    // If starts with 233 and 9 digits
    if (cleaned.startsWith("233") && cleaned.length === 12) {
      return { isValid: true, normalized: `+${cleaned}`, isGhanaian: true };
    }
    // Ambiguous without country code: if 10 digits starting with non-zero or other lengths
    return {
      isValid: false,
      normalized: "",
      error: "Please enter a valid phone number with Ghanaian format (e.g. 024 123 4567) or country code.",
    };
  }

  return {
    isValid: false,
    normalized: "",
    error: "Invalid phone number length. Ghanaian numbers must be 10 digits (e.g. 0241234567).",
  };
}

/**
 * Returns all potential search/database representation variants for a given phone input.
 * Used for comprehensive duplicate checks across legacy un-normalized and canonical records.
 */
export function getPhoneLookupVariants(input: string | null | undefined): string[] {
  if (!input) return [];

  const variants = new Set<string>();
  const rawClean = input.trim();
  if (rawClean) {
    variants.add(rawClean);
    variants.add(rawClean.replace(/[\s\-\(\)\.]/g, ""));
  }

  const result = normalizePhoneNumber(input);
  if (result.isValid && result.normalized) {
    const canonical = result.normalized; // e.g. +233241234567
    variants.add(canonical);

    if (canonical.startsWith("+233") && canonical.length === 13) {
      const national9 = canonical.substring(4); // 241234567
      variants.add(`0${national9}`);            // 0241234567
      variants.add(`233${national9}`);          // 233241234567
      variants.add(national9);                  // 241234567
      variants.add(`+233 ${national9.substring(0, 2)} ${national9.substring(2, 5)} ${national9.substring(5)}`);
      variants.add(`0${national9.substring(0, 2)} ${national9.substring(2, 5)} ${national9.substring(5)}`);
      variants.add(`0${national9.substring(0, 2)}-${national9.substring(2, 5)}-${national9.substring(5)}`);
    } else if (canonical.startsWith("+")) {
      variants.add(canonical.substring(1));
    }
  }

  return Array.from(variants).filter(Boolean);
}

/**
 * Formats a phone number for user-facing display (e.g. +233 24 123 4567).
 */
export function formatDisplayPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "Not provided";
  const trimmed = phone.trim();
  if (!trimmed) return "Not provided";

  const norm = normalizePhoneNumber(trimmed);
  if (norm.isValid && norm.normalized.startsWith("+233") && norm.normalized.length === 13) {
    const nat = norm.normalized.substring(4);
    return `+233 ${nat.substring(0, 2)} ${nat.substring(2, 5)} ${nat.substring(5)}`;
  }

  return trimmed;
}
