/**
 * Customer Name & Profile Extraction Helpers
 * Safely extracts display name, first name, and last name without crashing or producing 'undefined' / 'null'.
 */

export type ExtractedCustomerName = {
  displayName: string;
  firstName: string;
  lastName: string;
};

export function extractCustomerNameFields(customer: any): ExtractedCustomerName {
  if (!customer) {
    return { displayName: "", firstName: "", lastName: "" };
  }

  // 1. Check for single string name fields
  let rawName = "";
  if (typeof customer.name === "string" && customer.name.trim()) {
    rawName = customer.name.trim();
  } else if (typeof customer.fullName === "string" && customer.fullName.trim()) {
    rawName = customer.fullName.trim();
  } else if (typeof customer.full_name === "string" && customer.full_name.trim()) {
    rawName = customer.full_name.trim();
  } else if (typeof customer.customerName === "string" && customer.customerName.trim()) {
    rawName = customer.customerName.trim();
  } else if (typeof customer.customer_name === "string" && customer.customer_name.trim()) {
    rawName = customer.customer_name.trim();
  }

  // 2. Check for separate first/last name fields
  const rawFirst = (
    typeof customer.firstName === "string" ? customer.firstName :
    typeof customer.first_name === "string" ? customer.first_name : ""
  ).trim();

  const rawLast = (
    typeof customer.lastName === "string" ? customer.lastName :
    typeof customer.last_name === "string" ? customer.last_name : ""
  ).trim();

  // If no rawName yet, assemble from first + last name safely
  if (!rawName && (rawFirst || rawLast)) {
    rawName = [rawFirst, rawLast].filter(Boolean).join(" ").trim();
  }

  // Filter out literal string representations of null or undefined
  if (rawName.toLowerCase() === "undefined" || rawName.toLowerCase() === "null") {
    rawName = "";
  }

  let firstName = rawFirst;
  let lastName = rawLast;

  if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    if (!firstName) firstName = parts[0] || "";
    if (!lastName) lastName = parts.slice(1).join(" ") || "";
  }

  if (firstName.toLowerCase() === "undefined" || firstName.toLowerCase() === "null") {
    firstName = "";
  }
  if (lastName.toLowerCase() === "undefined" || lastName.toLowerCase() === "null") {
    lastName = "";
  }

  return {
    displayName: rawName,
    firstName,
    lastName,
  };
}
