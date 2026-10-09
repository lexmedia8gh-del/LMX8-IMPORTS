"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getPublicShipmentAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import { ShipmentStatusBadge, ShipmentTimeline } from "@/components/shipment-status";
import { useShipmentRealtime } from "@/hooks/use-shipment-realtime";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";
import {
  Search,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Package,
  Radio,
  RefreshCw,
  Clock,
  Sparkles,
} from "lucide-react";

function TrackContent() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const primaryColor = branding?.primaryColor || "#07182F";
  const secondaryColor = branding?.secondaryColor || "#0B1F44";
  const accentColor = branding?.accentColor || "#FFB800";

  const searchParams = useSearchParams();
  const queryId =
    searchParams.get("id") ||
    searchParams.get("q") ||
    searchParams.get("tracking") ||
    searchParams.get("code") ||
    "";

  const [trackingId, setTrackingId] = useState(queryId);
  const [activeTrackingNumber, setActiveTrackingNumber] = useState(queryId);
  const [initialData, setInitialData] = useState<Shipment | null>(null);
  const [searched, setSearched] = useState(Boolean(queryId));
  const [loading, setLoading] = useState(false);

  // Hook for Supabase Realtime synchronization
  const {
    shipment,
    isRealtimeConnected,
    isUpdating,
    lastUpdated,
    refresh,
  } = useShipmentRealtime({
    initialShipment: initialData,
    shipmentIdOrTrackingNumber: activeTrackingNumber || null,
    enabled: Boolean(activeTrackingNumber && searched),
    isPublic: true,
  });

  const performSearch = useCallback(async (idToSearch: string) => {
    const cleanId = idToSearch.trim();
    if (!cleanId) return;

    setLoading(true);
    setSearched(true);
    setActiveTrackingNumber(cleanId);

    try {
      const result = await getPublicShipmentAction(cleanId);
      setInitialData(result);
    } catch (err) {
      console.error("[Track] Error searching shipment:", err);
      setInitialData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load if query parameter is provided
  useEffect(() => {
    if (queryId) {
      setTrackingId(queryId);
      performSearch(queryId);
    }
  }, [queryId, performSearch]);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    performSearch(trackingId);
  };

  return (
    <div className="w-full max-w-lg space-y-6">
      {/* Tracking Search Form */}
      <div
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background: "#07182F",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="mb-6 space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Track Your Shipment
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Real-time tracking for cargo from China to Ghana.
          </p>
        </div>

        <form onSubmit={handleTrack} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Enter Tracking No. (e.g. LMX8-00125 / SHP-001)"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              className="w-full pl-11 pr-4 h-12 rounded-xl text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-hidden transition-colors border border-white/15"
              style={{
                background: secondaryColor,
              }}
            />
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !trackingId.trim()}
            className="w-full h-12 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm disabled:opacity-50 cursor-pointer"
            style={{
              background: accentColor,
              color: primaryColor,
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Searching shipment...</span>
              </>
            ) : (
              <>
                <span>Track Shipment</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Tracking Result */}
      {searched && !loading && (
        <div className="rounded-2xl p-5 sm:p-7 bg-white shadow-xl border border-gray-100 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {!shipment ? (
            <div className="text-center py-8">
              <Package size={44} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-[#172236]">
                Shipment Not Found
              </h3>
              <p className="text-xs text-[#667085] mt-1">
                We couldn&apos;t find an active shipment matching &ldquo;{activeTrackingNumber}&rdquo;.
                Please verify your tracking number and try again.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header: ID + Live Indicator + Current Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-[#F1F5F9]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                      Tracking Number
                    </p>
                    {isRealtimeConnected && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                        title="Connected to Supabase Realtime for instant status updates"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute" />
                        <span>Live Sync Active</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black font-mono text-[#172236] truncate">
                    {shipment.id}
                  </h3>
                </div>
                <div className="shrink-0 self-start sm:self-auto flex items-center gap-2">
                  <ShipmentStatusBadge status={shipment.status} showLivePulse />
                </div>
              </div>

              {/* Status Update Banner */}
              {isUpdating && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                  <RefreshCw size={13} className="animate-spin text-amber-600 shrink-0" />
                  <span>Synchronizing live checkpoint from Ctrl Room...</span>
                </div>
              )}

              {/* Info Grid */}
              <div
                className="grid grid-cols-2 gap-3.5 p-4 rounded-xl"
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Origin
                  </p>
                  <p className="font-semibold text-xs sm:text-sm text-[#172236] flex items-center gap-1.5 truncate">
                    <MapPin size={13} className="text-[#94A3B8] shrink-0" />
                    <span className="truncate">{shipment.origin || "Guangzhou, China"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Destination
                  </p>
                  <p className="font-semibold text-xs sm:text-sm text-[#172236] flex items-center gap-1.5 truncate">
                    <MapPin size={13} className="text-[#94A3B8] shrink-0" />
                    <span className="truncate">{shipment.destination || "Accra, Ghana"}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Shipping Method
                  </p>
                  <p className="font-semibold text-xs sm:text-sm text-[#172236] truncate">
                    {shipment.shippingMethod}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085] mb-1">
                    Est. Arrival
                  </p>
                  <p className="font-semibold text-xs sm:text-sm text-emerald-600 flex items-center gap-1.5 truncate">
                    <Calendar size={13} className="text-emerald-500 shrink-0" />
                    <span className="truncate">{shipment.estimatedArrival || "In Transit"}</span>
                  </p>
                </div>
              </div>

              {/* Real-time Timeline */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-sm text-[#172236] flex items-center gap-2">
                    <Radio size={14} style={{ color: accentColor }} />
                    <span>Real-Time Journey Timeline</span>
                  </h4>
                  {lastUpdated && (
                    <span className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                      <Clock size={10} />
                      <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                  )}
                </div>

                <ShipmentTimeline
                  currentStatus={shipment.status}
                  events={shipment.trackingEvents}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const primaryColor = branding?.primaryColor || "#07182F";
  const secondaryColor = branding?.secondaryColor || "#0B1F44";
  const accentColor = branding?.accentColor || "#FFB800";

  return (
    <div className="min-h-screen flex" style={{ background: primaryColor }}>
      {/* ── LEFT PANEL (Marketing & Value Proposition) ── */}
      <div className="hidden lg:flex w-[45%] relative flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?q=80&w=2070&auto=format&fit=crop')",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(7,24,47,0.95) 0%, rgba(7,24,47,0.75) 60%, rgba(7,24,47,0.50) 100%)",
          }}
        />

        <Link href="/" className="relative z-10 flex items-center gap-3">
          <BrandLogo variant="light" height={40} />
        </Link>

        <div className="relative z-10 space-y-5">
          <span className="gold-line" style={{ background: accentColor }}></span>
          <h2
            style={{ fontFamily: "var(--font-heading, var(--font-poppins))" }}
            className="text-4xl md:text-5xl font-bold text-white leading-tight"
          >
            More Than Just
            <br />
            Shipping.
          </h2>
          <h3
            className="text-3xl font-bold"
            style={{ color: accentColor, fontFamily: "var(--font-heading, var(--font-poppins))" }}
          >
            We Bring Your
            <br />
            World Closer.
          </h3>

          <div className="space-y-4 pt-6 mt-6 border-t border-white/10">
            <div className="flex items-center gap-3">
              <CheckCircle2 style={{ color: accentColor }} className="shrink-0" size={20} />
              <p className="text-sm font-medium text-white">
                Track your goods in real-time with instant updates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 style={{ color: accentColor }} className="shrink-0" size={20} />
              <p className="text-sm font-medium text-white">
                Request product sourcing from verified suppliers in China
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 style={{ color: accentColor }} className="shrink-0" size={20} />
              <p className="text-sm font-medium text-white">
                Secure payments and milestone notifications
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm italic text-[#667085]">
            From China to Ghana.
            <br />
            <span style={{ color: accentColor }}>{branding?.tagline || "Your Goods. Our Priority."}</span>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (Tracking Interface) ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 overflow-y-auto"
        style={{ background: secondaryColor }}
      >
        {/* Mobile Logo */}
        <div className="w-full max-w-lg mb-6 lg:hidden flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo variant="light" height={32} />
          </Link>

          <Link
            href="/login"
            className="text-xs font-bold hover:underline"
            style={{ color: accentColor }}
          >
            Customer Portal →
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-lg p-8 rounded-2xl text-center text-white text-sm" style={{ background: primaryColor }}>
              <RefreshCw size={24} className="animate-spin mx-auto mb-2" style={{ color: accentColor }} />
              <p>Loading real-time tracking...</p>
            </div>
          }
        >
          <TrackContent />
        </Suspense>
      </div>
    </div>
  );
}
