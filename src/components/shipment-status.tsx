import { Clock } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical ShipmentStatus type — mirrors the Prisma enum exactly.
// These are the values stored in the database.
// ─────────────────────────────────────────────────────────────────────────────
export type ShipmentStatus =
  | "SHIPMENT_CREATED"
  | "PREPARING_SHIPMENT"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "ARRIVED_AT_DESTINATION"
  | "CUSTOMS_CLEARANCE"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "ON_HOLD";

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable customer-facing and admin labels (Canonical 8-stage naming)
// ─────────────────────────────────────────────────────────────────────────────
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  SHIPMENT_CREATED:       "Order Confirmed",
  PREPARING_SHIPMENT:     "Preparing for Shipment",
  SHIPPED:                "Departed China",
  IN_TRANSIT:             "On the Way to Ghana",
  ARRIVED_AT_DESTINATION: "Arrived in Ghana",
  CUSTOMS_CLEARANCE:      "Customs Clearance",
  OUT_FOR_DELIVERY:       "Out for Delivery",
  DELIVERED:              "Delivered",
  ON_HOLD:                "On Hold",
};

// Admin label matches canonical names consistently
export const SHIPMENT_STATUS_ADMIN_LABELS: Record<ShipmentStatus, string> = SHIPMENT_STATUS_LABELS;

// ─────────────────────────────────────────────────────────────────────────────
// The professional LMX8 journey timeline shown to customers and admins.
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_JOURNEY: ShipmentStatus[] = [
  "SHIPMENT_CREATED",
  "PREPARING_SHIPMENT",
  "SHIPPED",
  "IN_TRANSIT",
  "ARRIVED_AT_DESTINATION",
  "CUSTOMS_CLEARANCE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// Keep STATUS_ORDER as alias for backward compatibility
export const STATUS_ORDER = STATUS_JOURNEY;

// ─────────────────────────────────────────────────────────────────────────────
// Journey milestone descriptions shown under each stage
// ─────────────────────────────────────────────────────────────────────────────
export const SHIPMENT_STATUS_DESCRIPTIONS: Record<ShipmentStatus, string> = {
  SHIPMENT_CREATED:       "Your order has been confirmed and is being registered in our system.",
  PREPARING_SHIPMENT:     "Your item is being prepared, quality-checked, and consolidated for international shipment.",
  SHIPPED:                "Your shipment has departed China and is now on its way to Ghana.",
  IN_TRANSIT:             "Your shipment is currently in transit to Ghana. We'll notify you when it arrives.",
  ARRIVED_AT_DESTINATION: "Your shipment has arrived in Ghana and is being processed for clearance.",
  CUSTOMS_CLEARANCE:      "Your shipment is currently undergoing customs clearance.",
  OUT_FOR_DELIVERY:       "Your shipment has been released for delivery and is on its way to you.",
  DELIVERED:              "Your shipment has been marked as delivered. Thank you for choosing LMX8 Imports!",
  ON_HOLD:                "Your shipment has been placed on hold. Please contact us for more information.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Status badge color palette
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<ShipmentStatus, { bg: string; text: string; dot: string }> = {
  SHIPMENT_CREATED:       { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  PREPARING_SHIPMENT:     { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  SHIPPED:                { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  IN_TRANSIT:             { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6" },
  ARRIVED_AT_DESTINATION: { bg: "#EDE9FE", text: "#5B21B6", dot: "#8B5CF6" },
  CUSTOMS_CLEARANCE:      { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308" },
  OUT_FOR_DELIVERY:       { bg: "#FFF7ED", text: "#9A3412", dot: "#FFB800" },
  DELIVERED:              { bg: "#D1FAE5", text: "#065F46", dot: "#10B981" },
  ON_HOLD:                { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444" },
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — shows the customer-friendly label by default
// ─────────────────────────────────────────────────────────────────────────────
export function ShipmentStatusBadge({
  status,
  adminMode = false,
}: {
  status: ShipmentStatus;
  adminMode?: boolean;
}) {
  const s = STATUS_STYLE[status] ?? { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" };
  const label = SHIPMENT_STATUS_LABELS[status] ?? status;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold max-w-full leading-tight"
      style={{ background: s.bg, color: s.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline event type used for tracking events from the database
// ─────────────────────────────────────────────────────────────────────────────
export interface TimelineEvent {
  id?: string;
  status: ShipmentStatus;
  date?: string;
  note?: string;
  location?: string;
  timestamp?: string;
  createdAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ShipmentTimeline — fully responsive professional journey view
// ─────────────────────────────────────────────────────────────────────────────
export function ShipmentTimeline({
  currentStatus,
  events = [],
  adminMode = false,
  onEditEvent,
  onDeleteEvent,
}: {
  currentStatus: ShipmentStatus;
  events?: TimelineEvent[];
  adminMode?: boolean;
  onEditEvent?: (event: TimelineEvent) => void;
  onDeleteEvent?: (eventId: string) => void;
}) {
  const currentIndex = STATUS_JOURNEY.indexOf(currentStatus);
  const isOnHold = currentStatus === "ON_HOLD";

  // Sort events chronologically to ensure earliest to latest order
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || a.date || "").getTime() || 0;
    const timeB = new Date(b.timestamp || b.createdAt || b.date || "").getTime() || 0;
    return timeA - timeB;
  });

  return (
    <div className="w-full space-y-0">
      {STATUS_JOURNEY.map((status, index) => {
        const isCompleted =
          index < currentIndex || currentStatus === "DELIVERED";
        const isCurrent = index === currentIndex;
        const isPending =
          index > currentIndex && currentStatus !== "DELIVERED";

        // Find tracking events matching this stage
        const stageEvents = sortedEvents.filter((e) => e.status === status);
        const latestEvent = stageEvents[stageEvents.length - 1];

        const dotColor = isCompleted
          ? "#10B981"
          : isCurrent
          ? isOnHold
            ? "#EF4444"
            : "#FFB800"
          : "#E5E7EB";
        const lineColor = isCompleted ? "#10B981" : "#E5E7EB";

        const label = SHIPMENT_STATUS_LABELS[status] ?? status;

        return (
          <div key={status} className="flex gap-3 sm:gap-4 w-full min-w-0">
            {/* Dot + line column */}
            <div className="flex flex-col items-center shrink-0 w-5 sm:w-6">
              <div
                className="w-3 h-3 rounded-full shrink-0 mt-1 transition-colors"
                style={{
                  background: dotColor,
                  boxShadow: isCurrent ? "0 0 0 3px rgba(255,184,0,0.2)" : "none",
                }}
              />
              {index !== STATUS_JOURNEY.length - 1 && (
                <div
                  className="w-0.5 flex-1 my-1 min-h-[20px] sm:min-h-[24px]"
                  style={{ background: lineColor }}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isPending ? "opacity-40" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-1.5 w-full">
                <p
                  className="text-xs sm:text-sm font-bold truncate"
                  style={{
                    color: isCurrent
                      ? isOnHold
                        ? "#EF4444"
                        : "#FFB800"
                      : isCompleted
                      ? "#172236"
                      : "#94A3B8",
                  }}
                >
                  {label}
                </p>

                {/* Admin actions if available for latest event in this stage */}
                {adminMode && latestEvent?.id && (onEditEvent || onDeleteEvent) && (
                  <div className="flex items-center gap-2 shrink-0 opacity-90 hover:opacity-100 transition-opacity">
                    {onEditEvent && (
                      <button
                        type="button"
                        onClick={() => onEditEvent(latestEvent)}
                        className="text-[11px] font-bold text-[#355DAF] hover:underline cursor-pointer"
                        title="Edit checkpoint"
                      >
                        Edit
                      </button>
                    )}
                    {onEditEvent && onDeleteEvent && (
                      <span className="text-[10px] text-gray-300">·</span>
                    )}
                    {onDeleteEvent && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(latestEvent.id!)}
                        className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                        title="Delete checkpoint"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stage Description for current stage (or when active) */}
              {isCurrent && (
                <p className="text-[11px] sm:text-xs mt-1 text-[#667085] leading-relaxed break-words">
                  {SHIPMENT_STATUS_DESCRIPTIONS[status]}
                </p>
              )}

              {/* Show dates and checkpoint notes ONLY if recorded */}
              {stageEvents.length > 0 ? (
                stageEvents.map((evt, evtIdx) => (
                  <div key={evt.id || evtIdx} className={`min-w-0 ${evtIdx > 0 ? "mt-2 pt-2 border-t border-gray-100" : ""}`}>
                    {evt.date && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[#94A3B8] text-[10px] sm:text-[11px]">
                        <Clock size={11} className="shrink-0" />
                        <span className="font-medium whitespace-nowrap">
                          {evt.date}
                        </span>
                        {evt.location && (
                          <span className="truncate max-w-[200px] sm:max-w-none">
                            · {evt.location}
                          </span>
                        )}
                      </div>
                    )}

                    {evt.note && (
                      <div
                        className="mt-1.5 text-xs p-2.5 rounded-xl break-words whitespace-pre-wrap"
                        style={{
                          background: "#F7F9FC",
                          border: "1px solid #E5E7EB",
                          color: "#475569",
                        }}
                      >
                        {evt.note}
                      </div>
                    )}
                  </div>
                ))
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
