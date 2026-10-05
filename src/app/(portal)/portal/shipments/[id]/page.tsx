"use client";

import { useEffect, useState, use } from "react";
import { getShipmentByIdAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Camera } from "lucide-react";
import { ShipmentStatusBadge, ShipmentTimeline } from "@/components/shipment-status";

export default function ShipmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShipmentByIdAction(id)
      .then((res) => { setShipment(res); setLoading(false); })
      .catch((err) => { console.error(err); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#FFB800] border-t-transparent animate-spin" />
        <p className="text-sm text-[#667085]">Loading shipment…</p>
      </div>
    );
  }
  if (!shipment) {
    return (
      <div className="py-16 text-center">
        <p className="font-bold text-lg" style={{ color: "#172236" }}>Shipment not found.</p>
        <Link href="/portal/shipments" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "#FFB800" }}>
          <ArrowLeft size={16} /> Back to Shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back */}
      <Link
        href="/portal/shipments"
        className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-black"
        style={{ color: "#94A3B8" }}
      >
        <ArrowLeft size={16} /> Back to Shipments
      </Link>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
        {/* Header */}
        <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold" style={{ color: "#172236" }}>
                Track Your Shipment
              </h1>
              <p className="text-sm mt-0.5 break-all font-mono text-[#667085]">{shipment.id}</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg self-start" style={{ border: "1px solid #E5E7EB" }}>
              <span className="text-[10px] font-bold uppercase tracking-wider shrink-0" style={{ color: "#667085" }}>Status</span>
              <ShipmentStatusBadge status={shipment.status} />
            </div>
          </div>
        </div>

        <div className="p-5 md:p-7 space-y-8">

          {/* Info grid — 2 cols on all sizes, key info visible immediately */}
          <div
            className="grid grid-cols-2 gap-4 p-4 rounded-xl"
            style={{ background: "#F7F9FC", border: "1px solid #E5E7EB" }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#667085" }}>Origin</p>
              <p className="font-semibold text-sm break-words" style={{ color: "#172236" }}>{shipment.origin ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#667085" }}>Destination</p>
              <p className="font-semibold text-sm break-words" style={{ color: "#172236" }}>{shipment.destination ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#667085" }}>Est. Arrival</p>
              <p className="font-semibold text-sm" style={{ color: "#10B981" }}>{shipment.estimatedArrival ?? "TBD"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#667085" }}>Method</p>
              <p className="font-semibold text-sm break-words" style={{ color: "#172236" }}>{shipment.shippingMethod ?? "—"}</p>
            </div>
          </div>

          {/* Photos */}
          {shipment.photos && shipment.photos.length > 0 && (
            <div>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: "#172236" }}>
                <Camera size={18} /> Cargo Photos
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {shipment.photos.map((p) => (
                  <div key={p.id} className="rounded-xl overflow-hidden border border-[#E5E7EB] aspect-square bg-gray-100">
                    <img src={p.url} alt="Cargo" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="font-bold text-base mb-5" style={{ color: "#172236" }}>
              Shipment Timeline
            </h3>
            <ShipmentTimeline currentStatus={shipment.status} events={shipment.trackingEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}
