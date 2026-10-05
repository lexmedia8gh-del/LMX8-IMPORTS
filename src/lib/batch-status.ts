import { ShipmentStatus } from "@/components/shipment-status";

export const BATCH_STAGES = [
  "SHIPMENT_CREATED",
  "PREPARING_SHIPMENT",
  "SHIPPED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CLOSED",
] as const;

export type BatchStage = typeof BATCH_STAGES[number];

/**
 * Normalizes any database string or legacy batch status into standard ShipmentStatus
 */
export function normalizeBatchStatus(status?: string | null): ShipmentStatus {
  if (!status) return "SHIPMENT_CREATED";
  const s = status.toUpperCase().trim();
  
  if (s === "IN TRANSIT" || s === "IN_TRANSIT") return "IN_TRANSIT";
  if (s === "ARRIVED IN GHANA" || s === "ARRIVED_GHANA" || s === "ARRIVED_AT_DESTINATION") return "ARRIVED_AT_DESTINATION";
  if (s === "CUSTOMS_CLEARANCE" || s === "CUSTOMS CLEARANCE" || s === "PROCESSING / COLLECTION") return "CUSTOMS_CLEARANCE";
  if (s === "OUT_FOR_DELIVERY" || s === "READY_FOR_DELIVERY" || s === "OUT FOR DELIVERY" || s === "READY FOR DELIVERY") return "OUT_FOR_DELIVERY";
  if (s === "DELIVERED") return "DELIVERED";
  if (s === "SHIPPED" || s === "DEPARTED_CHINA" || s === "DEPARTED CHINA") return "SHIPPED";
  if (s === "PREPARING_SHIPMENT" || s === "SUPPLIER_PROCESSING" || s === "CHINA_WAREHOUSE" || s === "CONSOLIDATING") return "PREPARING_SHIPMENT";
  if (s === "ON_HOLD" || s === "ON HOLD") return "ON_HOLD";
  
  return "SHIPMENT_CREATED";
}

/**
 * Customer-facing natural logistics label
 */
export const BATCH_CUSTOMER_LABELS: Record<string, string> = {
  SHIPMENT_CREATED:       "Order Confirmed",
  PREPARING_SHIPMENT:     "Preparing Your Shipment",
  SHIPPED:                "Departed China",
  IN_TRANSIT:             "On the Way to Ghana",
  ARRIVED_AT_DESTINATION: "Arrived in Ghana",
  CUSTOMS_CLEARANCE:      "Customs Clearance",
  OUT_FOR_DELIVERY:       "Ready for Delivery",
  DELIVERED:              "Delivered",
  CLOSED:                 "Batch Completed",
  ON_HOLD:                "On Hold",
};

/**
 * Admin-facing numbered logistics stage label
 */
export const BATCH_ADMIN_LABELS: Record<string, string> = {
  SHIPMENT_CREATED:       "1. Order Confirmed / Open",
  PREPARING_SHIPMENT:     "2. Preparing Shipment / China Warehouse",
  SHIPPED:                "3. Departed China",
  IN_TRANSIT:             "4. On the Way to Ghana (In Transit)",
  ARRIVED_AT_DESTINATION: "5. Arrived in Ghana",
  CUSTOMS_CLEARANCE:      "6. Customs Clearance",
  OUT_FOR_DELIVERY:       "7. Ready for Delivery / Collection",
  DELIVERED:              "8. Delivered",
  CLOSED:                 "9. Closed (Retention Period)",
  ON_HOLD:                "On Hold",
};

/**
 * Rich status descriptions for tracking cards
 */
export const BATCH_STAGE_DESCRIPTIONS: Record<string, string> = {
  SHIPMENT_CREATED:       "Batch opened. Orders are confirmed and being registered at the origin warehouse.",
  PREPARING_SHIPMENT:     "Items in this batch are being received, quality-inspected, and consolidated.",
  SHIPPED:                "Consignment prepared and departed China port/airport for international transport.",
  IN_TRANSIT:             "Your shipment is currently traveling from China to Ghana.",
  ARRIVED_AT_DESTINATION: "Consignment safely docked/landed in Ghana and received at port.",
  CUSTOMS_CLEARANCE:      "Cargo undergoing official customs clearance and duty processing.",
  OUT_FOR_DELIVERY:       "Cleared and dispatched. Ready for office collection or final doorstep delivery.",
  DELIVERED:              "All shipments in this batch have reached their final destination.",
  CLOSED:                 "Batch lifecycle closed. Files retained for 7 days per policy.",
  ON_HOLD:                "This consignment is currently on hold. Our team is resolving requirements.",
};

/**
 * Progress bar percentage values (0 - 100)
 */
export const BATCH_PROGRESS_PERCENT: Record<string, number> = {
  SHIPMENT_CREATED:       10,
  PREPARING_SHIPMENT:     25,
  SHIPPED:                45,
  IN_TRANSIT:             65,
  ARRIVED_AT_DESTINATION: 80,
  CUSTOMS_CLEARANCE:      90,
  OUT_FOR_DELIVERY:       95,
  DELIVERED:              100,
  CLOSED:                 100,
  ON_HOLD:                50,
};

export function getBatchCustomerLabel(stage?: string | null): string {
  if (!stage) return "Order Confirmed";
  const normalized = normalizeBatchStatus(stage);
  return BATCH_CUSTOMER_LABELS[normalized] || stage;
}

export function getBatchAdminLabel(stage?: string | null): string {
  if (!stage) return "1. Order Confirmed / Open";
  if (stage === "CLOSED") return BATCH_ADMIN_LABELS.CLOSED;
  const normalized = normalizeBatchStatus(stage);
  return BATCH_ADMIN_LABELS[normalized] || stage;
}
