"use client";

import { useEffect, useState, use } from "react";
import { getShipmentByIdAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Camera, Radio, RefreshCw, Clock } from "lucide-react";
import { ShipmentStatusBadge, ShipmentTimeline } from "@/components/shipment-status";
import { useShipmentRealtime } from "@/hooks/use-shipment-realtime";
import { useBrandSettings } from "@/components/brand-provider";

export default function ShipmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initialData, setInitialData] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const primaryColor = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";

  // Hook for Supabase Realtime synchronization
  const {
    shipment,
    isRealtimeConnected,
    isUpdating,
    lastUpdated,
  } = useShipmentRealtime({
    initialShipment: initialData,
    shipmentIdOrTrackingNumber: id,
    enabled: Boolean(id),
  });

  useEffect(() => {
    getShipmentByIdAction(id)
      .then((res) => {
        setInitialData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
        />
        <p className="text-sm text-[#667085]">Loading shipment…</p>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold text-lg" style={{ color: "#172236" }}>
          Shipment not found.
        </p>
        <Link
          href="/portal/shipments"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: accentColor }}
        >
          <ArrowLeft size={16} /> Back to Shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/portal/shipments"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold transition-colors hover:text-black"
          style={{ color: "#94A3B8" }}
        >
          <ArrowLeft size={16} /> Back to Shipments
        </Link>

        {isRealtimeConnected && (
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
            title="Connected to real-time status updates"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync Active</span>
          </span>
        )}
      </div>

      <div
        className="bg-white rounded-2xl overflow-hidden shadow-xs"
        style={{ border: "1px solid #E5E7EB" }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex flex-col gap-3"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold" style={{ color: "#172236" }}>
                Track Your Shipment
              </h1>
              <p className="text-xs sm:text-sm mt-0.5 font-mono font-bold text-[#667085] truncate">
                {shipment.id}
              </p>
            </div>
            <div
              className="flex items-center gap-2 bg-gray-50 px-3.5 py-1.5 rounded-xl self-start sm:self-auto"
              style={{ border: "1px solid #E5E7EB" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider shrink-0 text-[#667085]"
              >
                Status
              </span>
              <ShipmentStatusBadge status={shipment.status} showLivePulse />
            </div>
          </div>
        </div>

        {isUpdating && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin text-amber-600 shrink-0" />
            <span>Updating timeline from Ctrl Room...</span>
          </div>
        )}

        <div className="p-5 md:p-7 space-y-8">
          {/* Info grid — 2 cols on all sizes */}
          <div
            className="grid grid-cols-2 gap-4 p-4 rounded-xl"
            style={{ background: "#F7F9FC", border: "1px solid #E5E7EB" }}
          >
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Origin
              </p>
              <p
                className="font-semibold text-xs sm:text-sm break-words"
                style={{ color: "#172236" }}
              >
                {shipment.origin ?? "Guangzhou, China"}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Destination
              </p>
              <p
                className="font-semibold text-xs sm:text-sm break-words"
                style={{ color: "#172236" }}
              >
                {shipment.destination ?? "Accra, Ghana"}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Est. Arrival
              </p>
              <p className="font-semibold text-xs sm:text-sm text-emerald-600">
                {shipment.estimatedArrival ?? "In Transit"}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Method
              </p>
              <p
                className="font-semibold text-xs sm:text-sm break-words"
                style={{ color: "#172236" }}
              >
                {shipment.shippingMethod ?? "Air Cargo"}
              </p>
            </div>
          </div>

          {/* Cargo Photos */}
          {shipment.photos && shipment.photos.length > 0 && (
            <div>
              <h3
                className="font-bold text-sm sm:text-base mb-4 flex items-center gap-2"
                style={{ color: "#172236" }}
              >
                <Camera size={18} /> Cargo Photos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {shipment.photos.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl overflow-hidden border border-[#E5E7EB] aspect-square bg-gray-100"
                  >
                    <img
                      src={p.url}
                      alt="Cargo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Timeline */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3
                className="font-bold text-sm sm:text-base flex items-center gap-2"
                style={{ color: "#172236" }}
              >
                <Radio size={16} style={{ color: accentColor }} />
                <span>Shipment Timeline</span>
              </h3>
              {lastUpdated && (
                <span className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                  <Clock size={10} />
                  <span>
                    Synced{" "}
                    {lastUpdated.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              )}
            </div>
            <ShipmentTimeline
              currentStatus={shipment.status}
              events={shipment.trackingEvents}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
