import { Prisma } from "@prisma/client";

/**
 * Parses and maps Prisma / database errors to clean, safe, user-friendly messages.
 * Never leaks internal SQL queries, connection strings, or stack traces.
 */
export function parsePrismaError(error: unknown, fallbackMessage: string = "A database error occurred."): string {
  if (!error) return fallbackMessage;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        // Unique constraint violation
        const target = error.meta?.target;
        let fieldName = "record";

        if (Array.isArray(target)) {
          fieldName = target.join(", ");
        } else if (typeof target === "string") {
          fieldName = target;
        }

        const lowerField = fieldName.toLowerCase();
        if (lowerField.includes("phone")) {
          return "This phone number is already assigned to another customer.";
        }
        if (lowerField.includes("email")) {
          return "This email address is already assigned to another customer.";
        }
        if (lowerField.includes("customeridentifier") || lowerField.includes("customer_identifier")) {
          return "A customer with this ID already exists. Please try again.";
        }
        if (lowerField.includes("reference")) {
          return "A payment with this transaction reference already exists.";
        }
        if (lowerField.includes("idempotencykey") || lowerField.includes("idempotency_key")) {
          return "This request has already been processed.";
        }
        if (lowerField.includes("trackingnumber") || lowerField.includes("tracking_number")) {
          return "A shipment with this tracking number already exists.";
        }
        if (lowerField.includes("batchnumber") || lowerField.includes("batch_number")) {
          return "A batch with this batch number already exists.";
        }

        return `A duplicate entry already exists for: ${fieldName}.`;
      }

      case "P2003": {
        // Foreign key constraint failed
        const fieldName = (error.meta?.field_name as string) || "related record";
        return `Cannot complete operation because a dependent ${fieldName} was not found or is in use.`;
      }

      case "P2025": {
        // Record not found
        return "The requested record was not found or has already been removed.";
      }

      case "P2014": {
        // Change would violate relation constraint
        return "The requested modification would violate relationship constraints with other records.";
      }

      case "P2024": {
        // Connection timeout
        return "Database operation timed out. Please check your connection and try again.";
      }

      default:
        console.error(`[PrismaKnownError] Code: ${error.code}`, error.message);
        return fallbackMessage;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    console.error("[PrismaValidationError]", error.message);
    return "Invalid data submitted. Please check the required fields.";
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error("[PrismaInitError]", error.message);
    return "Database service is temporarily unavailable. Please try again shortly.";
  }

  if (error instanceof Error) {
    // If it is already a curated user error message (doesn't contain internal Prisma/SQL tokens)
    if (!error.message.includes("prisma") && !error.message.includes("SELECT") && !error.message.includes("INSERT")) {
      return error.message;
    }
  }

  console.error("[UnhandledDatabaseError]", error);
  return fallbackMessage;
}
