"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { STATUS_ORDER, ShipmentStatus, SHIPMENT_STATUS_ADMIN_LABELS, TimelineEvent } from "@/components/shipment-status";
import { updateTrackingEventAction } from "@/app/actions";
import { Shipment as UIShipment } from "@/lib/db";
import { Clock, MapPin, FileText, RefreshCw, AlertCircle, CheckCircle2, Edit3 } from "lucide-react";

interface EditTrackingEventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: TimelineEvent | null;
  onSuccess?: (updatedEvent?: TimelineEvent, updatedShipment?: UIShipment) => void;
}

export function EditTrackingEventDrawer({
  isOpen,
  onClose,
  event,
  onSuccess,
}: EditTrackingEventDrawerProps) {
  const [status, setStatus] = useState<ShipmentStatus>("SHIPMENT_CREATED");
  const [location, setLocation] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && event) {
      setStatus(event.status);
      setLocation(event.location || "");
      setNote(event.note || "");
      setErrorMessage(null);
    }
  }, [isOpen, event]);

  const isDirty = useMemo(() => {
    if (!event) return false;
    return (
      status !== event.status ||
      location !== (event.location || "") ||
      note !== (event.note || "")
    );
  }, [event, status, location, note]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event?.id) return;
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      const res = await updateTrackingEventAction(event.id, {
        status,
        note: note.trim() || undefined,
        location: location.trim() || undefined,
      });

      if (res?.error) {
        setErrorMessage(res.error);
        setIsSubmitting(false);
        return;
      }

      if (onSuccess && res) {
        onSuccess(res.event, res.shipment);
      }
      onClose();
    } catch (err: any) {
      console.error("[EditTrackingEventDrawer] Error editing event:", err);
      setErrorMessage(err?.message || "Failed to update tracking event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Tracking Checkpoint"
      description={`Update event details for checkpoint (${event?.status ? SHIPMENT_STATUS_ADMIN_LABELS[event.status] : "Event"}).`}
      icon={<Edit3 size={20} />}
      isDirty={isDirty}
      widthClassName="sm:max-w-md md:max-w-lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !isDirty}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141B47] hover:bg-[#202B6D] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Update failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47]">
            Operational Stage *
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
            className="w-full px-3.5 h-11 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors cursor-pointer"
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {SHIPMENT_STATUS_ADMIN_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <MapPin size={14} className="text-[#355DAF]" /> Checkpoint Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Tema Port Container Terminal, Ghana"
            className="w-full px-3.5 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <FileText size={14} className="text-[#355DAF]" /> Event Description & Note
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter tracking checkpoint update note..."
            className="w-full p-3.5 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors resize-none"
          />
        </div>
      </form>
    </AdminDrawer>
  );
}
