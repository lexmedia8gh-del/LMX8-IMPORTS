"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { ShipmentStatusBadge, STATUS_ORDER, ShipmentStatus, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";
import { updateShipmentStatusAction } from "@/app/actions";
import { Clock, MapPin, FileText, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface AddTrackingEventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: string;
  currentStatus: ShipmentStatus;
  onSuccess?: () => void;
}

export function AddTrackingEventDrawer({
  isOpen,
  onClose,
  shipmentId,
  currentStatus,
  onSuccess,
}: AddTrackingEventDrawerProps) {
  const [status, setStatus] = useState<ShipmentStatus>(currentStatus);
  const [location, setLocation] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus(currentStatus);
      setLocation("");
      setNote("");
      setErrorMessage(null);
    }
  }, [isOpen, currentStatus]);

  const isDirty = useMemo(() => {
    return note.trim().length > 0 || location.trim().length > 0 || status !== currentStatus;
  }, [note, location, status, currentStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      await updateShipmentStatusAction(
        shipmentId,
        status,
        note.trim() || undefined,
        location.trim() || undefined
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[AddTrackingEventDrawer] Error adding event:", err);
      setErrorMessage(err?.message || "Failed to add tracking event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Tracking Event"
      description={`Post a live checkpoint update for shipment ${shipmentId}.`}
      icon={<Clock size={20} />}
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
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141B47] hover:bg-[#202B6D] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Publishing Update...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Publish Event</span>
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
            New Operational Status *
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
            placeholder="e.g. Consignment cleared customs and ready for warehouse intake."
            className="w-full p-3 text-xs rounded-xl border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors resize-none leading-relaxed"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E5E7EB] text-xs text-[#667085] space-y-1">
          <p className="font-semibold text-[#141B47]">Automatic Customer Notification</p>
          <p className="text-[11px] leading-relaxed">
            Publishing this event will automatically send an in-portal notification to the customer with your checkpoint remarks.
          </p>
        </div>
      </form>
    </AdminDrawer>
  );
}
