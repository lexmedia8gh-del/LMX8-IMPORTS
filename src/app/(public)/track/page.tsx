"use client";

import { useState } from "react";
import Link from "next/link";
import { getShipmentByIdAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import { ShipmentStatusBadge, ShipmentTimeline } from "@/components/shipment-status";
import { Search, MapPin, Calendar, CheckCircle2, ArrowRight, Package } from "lucide-react";

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId) return;
    
    setLoading(true);
    setSearched(true);
    const result = await getShipmentByIdAction(trackingId);
    setShipment(result);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#07182F" }}>
      {/* ── LEFT PANEL (Marketing) ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?q=80&w=2070&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(7,24,47,0.95) 0%, rgba(7,24,47,0.75) 60%, rgba(7,24,47,0.50) 100%)" }} />

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl" style={{ background: "#FFB800", color: "#07182F", fontFamily: "var(--font-poppins)" }}>L</div>
          <div>
            <div className="text-xl font-bold tracking-wider text-white leading-none" style={{ fontFamily: "var(--font-poppins)" }}>LMX<span style={{ color: "#FFB800" }}>8</span></div>
            <div className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: "#94A3B8" }}>Imports</div>
          </div>
        </Link>

        <div className="relative z-10 space-y-5">
          <span className="gold-line"></span>
          <h2 style={{ fontFamily: "var(--font-poppins)" }} className="text-4xl md:text-5xl font-bold text-white leading-tight">
            More Than Just<br/>Shipping.
          </h2>
          <h3 className="text-3xl font-bold" style={{ color: "#FFB800", fontFamily: "var(--font-poppins)" }}>We Bring Your<br/>World Closer.</h3>
          
          <div className="space-y-4 pt-6 mt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-[#FFB800]" size={20} />
              <p className="text-sm font-medium text-white">Track your goods in real-time</p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-[#FFB800]" size={20} />
              <p className="text-sm font-medium text-white">Request product sourcing from China</p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-[#FFB800]" size={20} />
              <p className="text-sm font-medium text-white">Secure payments via Paystack</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm italic text-[#667085]">
            From China to Ghana.<br />
            <span className="text-[#FFB800]">Your Goods. Our Priority.</span>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (Tracking Interface) ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto" style={{ background: "#0B1F44" }}>
        {/* Mobile Logo */}
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-base" style={{ background: "#FFB800", color: "#07182F", fontFamily: "var(--font-poppins)" }}>L</div>
          <span className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-poppins)" }}>LMX<span style={{ color: "#FFB800" }}>8</span></span>
        </div>

        <div className="w-full max-w-lg space-y-8">
          
          {/* Tracking Search Form */}
          <div className="rounded-2xl p-8" style={{ background: "#07182F", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="mb-6 space-y-1">
              <h2 className="text-2xl font-bold text-white">Track Your Shipment</h2>
              <p className="text-sm text-[#94A3B8]">Follow your cargo from China to Ghana.</p>
            </div>

            <form onSubmit={handleTrack} className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Shipment ID (e.g. SHP-12345)"
                  value={trackingId}
                  onChange={e => setTrackingId(e.target.value)}
                  className="w-full pl-11 pr-4 h-12 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 transition-colors bg-[#0B1F44]"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                />
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              </div>
              <button
                type="submit"
                disabled={loading || !trackingId}
                className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm bg-[#FFB800] text-[#07182F] disabled:opacity-50"
              >
                {loading ? "Searching..." : "Track Shipment"} <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Tracking Result */}
          {searched && !loading && (
            <div className="rounded-2xl p-6 sm:p-8 bg-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
              {!shipment ? (
                <div className="text-center py-8">
                  <Package size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-bold text-[#172236]">Shipment Not Found</h3>
                  <p className="text-sm text-[#667085] mt-1">Please check your tracking ID and try again.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F1F5F9]">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Shipment ID</p>
                      <h3 className="text-xl font-bold text-[#172236]">{shipment.id}</h3>
                    </div>
                    <ShipmentStatusBadge status={shipment.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Origin</p>
                      <p className="font-semibold text-sm text-[#172236] flex items-center gap-1.5"><MapPin size={14} className="text-[#94A3B8]"/> {shipment.origin}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Destination</p>
                      <p className="font-semibold text-sm text-[#172236] flex items-center gap-1.5"><MapPin size={14} className="text-[#94A3B8]"/> {shipment.destination}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Method</p>
                      <p className="font-semibold text-sm text-[#172236]">{shipment.shippingMethod}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#667085] mb-1">Est. Arrival</p>
                      <p className="font-semibold text-sm text-[#10B981] flex items-center gap-1.5"><Calendar size={14} className="text-[#10B981]"/> {shipment.estimatedArrival}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-[#172236] mb-5">Tracking Updates</h4>
                    <ShipmentTimeline currentStatus={shipment.status} events={shipment.trackingEvents} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
