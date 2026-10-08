import React from "react";
import { Clock, Check, AlertTriangle, Radio } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical ShipmentStatus type — mirrors the Prisma enum exactly.
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

// Admin labels match the canonical names consistently
export const SHIPMENT_STATUS_ADMIN_LABELS: Record<ShipmentStatus, string> = SHIPMENT_STATUS_LABELS;

// ─────────────────────────────────────────────────────────────────────────────
// The exact 8 canonical stages of the LMX8 journey
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

export const STATUS_ORDER = STATUS_JOURNEY;

// ─────────────────────────────────────────────────────────────────────────────
// Milestone descriptions shown under each stage
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
  ON_HOLD:                "Your shipment has been placed on hold. Please contact our support team for details.",
};

// ─────────────────────────────────────────────────────────────────────────────
// Status badge styles
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<ShipmentStatus, { bg: string; text: string; dot: string; border: string }> = {
  SHIPMENT_CREATED:       { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", border: "#E2E8F0" },
  PREPARING_SHIPMENT:     { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B", border: "#FDE68A" },
  SHIPPED:                { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6", border: "#BFDBFE" },
  IN_TRANSIT:             { bg: "#DBEAFE", text: "#1E40AF", dot: "#3B82F6", border: "#BFDBFE" },
  ARRIVED_AT_DESTINATION: { bg: "#EDE9FE", text: "#5B21B6", dot: "#8B5CF6", border: "#DDD6FE" },
  CUSTOMS_CLEARANCE:      { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308", border: "#FEF08A" },
  OUT_FOR_DELIVERY:       { bg: "#FFF7ED", text: "#9A3412", dot: "#FFB800", border: "#FFEDD5" },
  DELIVERED:              { bg: "#D1FAE5", text: "#065F46", dot: "#10B981", border: "#A7F3D0" },
  ON_HOLD:                { bg: "#FEE2E2", text: "#991B1B", dot: "#EF4444", border: "#FECACA" },
};

// ─────────────────────────────────────────────────────────────────────────────
// StatusBadge — visual pill displaying current shipment status
// ─────────────────────────────────────────────────────────────────────────────
export function ShipmentStatusBadge({
  status,
  adminMode = false,
  showLivePulse = false,
}: {
  status: ShipmentStatus;
  adminMode?: boolean;
  showLivePulse?: boolean;
}) {
  const s = STATUS_STYLE[status] ?? { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", border: "#E2E8F0" };
  const label = SHIPMENT_STATUS_LABELS[status] ?? status;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold max-w-full leading-tight border transition-all"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {showLivePulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: s.dot }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2 shrink-0"
          style={{ background: s.dot }}
        />
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline event interface for checkpoints
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
// ShipmentTimeline — Production-grade responsive 8-stage real-time timeline
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
  const isAllDelivered = currentStatus === "DELIVERED";

  // Sort events chronologically to guarantee earliest to latest order
  const sortedEvents = [...events].sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || a.date || "").getTime() || 0;
    const timeB = new Date(b.timestamp || b.createdAt || b.date || "").getTime() || 0;
    return timeA - timeB;
  });

  return (
    <div className="w-full space-y-0 select-none">
      {STATUS_JOURNEY.map((status, index) => {
        // Compute stage state
        const isCompleted = isAllDelivered ? true : currentIndex !== -1 && index < currentIndex;
        const isCurrent = isAllDelivered ? index === STATUS_JOURNEY.length - 1 : index === currentIndex;
        const isUpcoming = !isCompleted && !isCurrent;

        // Find tracking events matching this stage and deduplicate by date/note/location
        const rawStageEvents = sortedEvents.filter((e) => e.status === status);
        const stageEvents = rawStageEvents.filter(
          (evt, idx, self) =>
            idx ===
            self.findIndex(
              (t) =>
                t.date === evt.date &&
                (t.note || "") === (evt.note || "") &&
                (t.location || "") === (evt.location || "")
            )
        );
        const latestEvent = stageEvents[stageEvents.length - 1];
        const label = SHIPMENT_STATUS_LABELS[status] ?? status;

        return (
          <div key={status} className="flex gap-3 sm:gap-4 w-full min-w-0">
            {/* Stage Marker & Connector Line */}
            <div className="flex flex-col items-center shrink-0 w-6 sm:w-7">
              {/* Marker Icon */}
              {isCompleted ? (
                <div
                  className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-transform"
                  title="Completed Stage"
                >
                  <Check size={13} strokeWidth={3} />
                </div>
              ) : isCurrent ? (
                <div className="relative flex items-center justify-center w-6 h-6 shrink-0 mt-0.5">
                  <span
                    className="absolute w-6 h-6 rounded-full animate-ping opacity-35"
                    style={{ backgroundColor: isOnHold ? "#EF4444" : "var(--accent)" }}
                  />
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm transition-all"
                    style={{
                      background: isOnHold ? "#EF4444" : "var(--accent)",
                      boxShadow: isOnHold
                        ? "0 0 0 3px rgba(239, 68, 68, 0.25)"
                        : "0 0 0 3px rgba(242, 144, 31, 0.25)",
                    }}
                  >
                    {isOnHold ? (
                      <AlertTriangle size={11} strokeWidth={3} />
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white shrink-0 mt-1"
                  title="Upcoming Stage"
                />
              )}

              {/* Vertical connector line */}
              {index !== STATUS_JOURNEY.length - 1 && (
                <div
                  className={`w-0.5 flex-1 my-1.5 min-h-[24px] sm:min-h-[28px] transition-colors ${
                    isCompleted ? "bg-emerald-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>

            {/* Stage Details */}
            <div
              className={`pb-6 flex-1 min-w-0 transition-opacity ${
                isUpcoming ? "opacity-50" : "opacity-100"
              }`}
            >
              {/* Header row: Stage title + CURRENT badge + Admin controls */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 w-full">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isCurrent
                        ? "text-[#172236]"
                        : isCompleted
                        ? "text-[#172236]"
                        : "text-[#64748B]"
                    }`}
                  >
                    {label}
                  </span>

                  {/* Prominent Current Status Indicator */}
                  {isCurrent && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                        isOnHold
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-amber-50 text-amber-900 border-amber-300"
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                        style={{ background: isOnHold ? "#EF4444" : "var(--accent)" }}
                      />
                      {isOnHold ? "On Hold" : "Current Status"}
                    </span>
                  )}
                </div>

                {/* Admin quick actions if checkpoint exists */}
                {adminMode && latestEvent?.id && (onEditEvent || onDeleteEvent) && (
                  <div className="flex items-center gap-2 shrink-0 text-[11px] font-bold">
                    {onEditEvent && (
                      <button
                        type="button"
                        onClick={() => onEditEvent(latestEvent)}
                        className="hover:underline cursor-pointer transition-colors"
                        style={{ color: "var(--primary)" }}
                        title="Edit stage checkpoint"
                      >
                        Edit
                      </button>
                    )}
                    {onEditEvent && onDeleteEvent && (
                      <span className="text-gray-300">·</span>
                    )}
                    {onDeleteEvent && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(latestEvent.id!)}
                        className="text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        title="Delete stage checkpoint"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Stage Description (always for current, or when completed/helpful) */}
              {isCurrent && (
                <p className="text-[11px] sm:text-xs mt-1.5 text-[#667085] leading-relaxed break-words">
                  {SHIPMENT_STATUS_DESCRIPTIONS[status]}
                </p>
              )}

              {/* Checkpoint dates and notes: ONLY render if recorded in the database */}
              {stageEvents.length > 0 && (
                <div className="mt-2 space-y-2">
                  {stageEvents.map((evt, evtIdx) => (
                    <div
                      key={evt.id || evtIdx}
                      className={`min-w-0 ${
                        evtIdx > 0 ? "pt-2 border-t border-gray-100" : ""
                      }`}
                    >
                      {evt.date && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[#64748B] text-[10px] sm:text-[11px] font-medium">
                          <Clock size={12} className="shrink-0 text-[#94A3B8]" />
                          <span>{evt.date}</span>
                          {evt.location && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="truncate max-w-[200px] sm:max-w-none text-[#172236] font-semibold">
                                {evt.location}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {evt.note && (
                        <div className="mt-1.5 text-xs p-2.5 rounded-xl break-words whitespace-pre-wrap bg-[#F8FAFC] border border-[#E2E8F0] text-[#334155] leading-relaxed">
                          {evt.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
