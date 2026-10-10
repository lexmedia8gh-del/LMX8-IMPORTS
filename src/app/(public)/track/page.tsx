"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getPublicShipmentAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import { ShipmentStatusBadge, ShipmentTimeline, ShipmentStatus } from "@/components/shipment-status";
import { useShipmentRealtime } from "@/hooks/use-shipment-realtime";
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
  Copy,
  Check,
  ShieldCheck,
  Plane,
  Ship,
  Truck,
  Boxes,
  Scale,
  FileText,
  Camera,
  ZoomIn,
  Download,
  X,
  MessageSquare,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// 5-Stage Canonical Customer Milestone Stepper
const MILESTONE_STAGES = [
  {
    key: "WAREHOUSE_INTAKE",
    label: "Warehouse Intake",
    location: "Guangzhou, CN",
    description: "Received, inspected & weighed",
    icon: Boxes,
  },
  {
    key: "DEPARTED_CHINA",
    label: "Departed China",
    location: "China Terminal",
    description: "Dispatched from export port",
    icon: Plane,
  },
  {
    key: "INTERNATIONAL_TRANSIT",
    label: "In Transit",
    location: "Air / Sea Freight",
    description: "En route to Accra, Ghana",
    icon: Truck,
  },
  {
    key: "CUSTOMS_CLEARANCE",
    label: "Customs Clearance",
    location: "Accra / Tema Hub",
    description: "Port and customs verification",
    icon: ShieldCheck,
  },
  {
    key: "READY_OR_DELIVERED",
    label: "Delivered / Ready",
    location: "Accra Terminal",
    description: "Available for pickup or delivered",
    icon: CheckCircle2,
  },
];

function getMilestoneProgress(status: ShipmentStatus): { activeIndex: number; percentage: number } {
  switch (status) {
    case "SHIPMENT_CREATED":
      return { activeIndex: 0, percentage: 12 };
    case "PREPARING_SHIPMENT":
      return { activeIndex: 0, percentage: 22 };
    case "SHIPPED":
      return { activeIndex: 1, percentage: 40 };
    case "IN_TRANSIT":
      return { activeIndex: 2, percentage: 60 };
    case "ARRIVED_AT_DESTINATION":
      return { activeIndex: 3, percentage: 75 };
    case "CUSTOMS_CLEARANCE":
      return { activeIndex: 3, percentage: 85 };
    case "OUT_FOR_DELIVERY":
      return { activeIndex: 4, percentage: 95 };
    case "DELIVERED":
      return { activeIndex: 4, percentage: 100 };
    case "ON_HOLD":
      return { activeIndex: 2, percentage: 50 };
    default:
      return { activeIndex: 0, percentage: 10 };
  }
}

function TrackContent() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const primaryColor = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const businessName = branding?.businessName || "LMX8 IMPORTS";

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
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<{ url: string; filename?: string } | null>(null);

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

  const handleCopyTracking = () => {
    if (!shipment) return;
    navigator.clipboard.writeText(shipment.id);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2200);
  };

  const isAirFreight = shipment?.shippingMethod?.toLowerCase().includes("air") ?? true;
  const TransitIcon = isAirFreight ? Plane : Ship;
  const { activeIndex: milestoneIndex, percentage: progressPercentage } = shipment
    ? getMilestoneProgress(shipment.status)
    : { activeIndex: 0, percentage: 0 };

  const whatsappInquiryUrl = shipment
    ? `https://wa.me/233241234567?text=${encodeURIComponent(
        `Hello ${businessName} Support, I am tracking consignment ${shipment.id} (${shipment.description || "General Cargo"}). Please provide an update on this shipment.`
      )}`
    : `https://wa.me/233241234567?text=${encodeURIComponent(
        `Hello ${businessName} Support, I would like to inquire about my shipment.`
      )}`;

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      {/* ── TOP ACTION BAR / SEARCH SWITCHER WHEN SHIPMENT IS ACTIVE ── */}
      {shipment && !loading && (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-[#E5E7EB] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs font-bold text-[#172236]">Tracking Consignment:</span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-[#172236]">
              {shipment.id}
            </span>
          </div>

          <form onSubmit={handleTrack} className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="Track another shipment..."
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                className="w-full pl-8 pr-2.5 h-10 rounded-xl text-xs text-[#172236] placeholder:text-slate-400 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 font-mono transition-all"
                style={{
                  outlineColor: accentColor,
                }}
              />
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingId.trim()}
              className="h-10 px-4 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
              style={{ background: accentColor }}
            >
              <Search size={13} />
              <span className="hidden xs:inline">Track</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTrackingId("");
                setSearched(false);
                setInitialData(null);
                setActiveTrackingNumber("");
              }}
              className="h-10 px-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="Clear search"
            >
              Reset
            </button>
          </form>
        </div>
      )}

      {/* ── TOP SEARCH HERO CONSOLE (Shown when not viewing an active shipment) ── */}
      {(!shipment || loading) && (
        <div
          className="rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-lg text-white relative overflow-hidden border border-white/10"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}EE 55%, ${secondaryColor} 100%)`,
          }}
        >
          {/* Subtle decorative glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div
            className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ background: accentColor }}
          />

          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-3 sm:space-y-4">
            {/* Eyebrow & Live status */}
            <div className="flex items-center justify-center gap-2">
              <span
                className="w-8 h-1 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
              />
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                Official Cargo Telemetry
              </span>
              <span
                className="w-8 h-1 rounded-full shrink-0"
                style={{ backgroundColor: accentColor }}
              />
            </div>

            <h1
              className="text-2xl xs:text-3xl sm:text-4xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Track Your Consignment
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Real-time logistical milestones from intake in Guangzhou to final clearance and release in Accra.
            </p>

            {/* Search Form */}
            <form onSubmit={handleTrack} className="pt-2 sm:pt-4 max-w-xl mx-auto space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch gap-2.5 bg-white/10 p-1.5 sm:p-2 rounded-2xl border border-white/20 backdrop-blur-md shadow-inner">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter Tracking No. (e.g. LMX8-00125 / SHP-001)"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    className="w-full pl-10 pr-3 h-12 rounded-xl text-xs sm:text-sm text-white placeholder:text-slate-400 bg-white/10 border border-transparent focus:border-white/30 focus:outline-none transition-colors font-mono"
                  />
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !trackingId.trim()}
                  className="h-12 px-6 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-98 shadow-md disabled:opacity-50 cursor-pointer text-white shrink-0 min-h-[44px]"
                  style={{
                    background: accentColor,
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search size={15} />
                      <span>Track Cargo</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Demo Tag Helper */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300 pt-1 flex-wrap">
                <span className="text-slate-400">Sample tracking codes:</span>
                {["SHP-001", "SHP-002", "LMX8-00125"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setTrackingId(code);
                      performSearch(code);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-mono text-[11px] cursor-pointer transition-colors border border-white/10 min-h-[28px]"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TRACKING BODY CONTENT ── */}
      {/* State 1: Loading */}
      {loading && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-10 sm:p-16 border border-[#E5E7EB] shadow-xs text-center space-y-3">
          <div
            className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin mx-auto"
            style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
          />
          <h3 className="font-bold text-base text-[#172236]">Retrieving Live Telemetry…</h3>
          <p className="text-xs text-[#667085] max-w-sm mx-auto">
            Contacting operations database and synchronizing latest checkpoint events.
          </p>
        </div>
      )}

      {/* State 2: Not Found */}
      {!loading && searched && !shipment && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-12 border border-[#E5E7EB] shadow-xs text-center max-w-xl mx-auto space-y-4 animate-in fade-in">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <AlertCircle size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-[#172236]">Consignment Not Found</h3>
            <p className="text-xs sm:text-sm text-[#667085] leading-relaxed max-w-md mx-auto">
              We could not find an active consignment matching{" "}
              <strong className="font-mono text-[#172236]">&ldquo;{activeTrackingNumber}&rdquo;</strong>.
              Please check the tracking number format on your receipt or waybill.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTrackingId("");
                setSearched(false);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-[#172236] hover:bg-slate-50 cursor-pointer"
            >
              Clear &amp; Try Again
            </button>
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer inline-flex items-center justify-center gap-1.5"
              style={{ background: "#10B981" }}
            >
              <MessageSquare size={14} /> Contact WhatsApp Support
            </a>
          </div>
        </div>
      )}

      {/* State 3: Shipment Found — High-Hierarchy Full Tracking View */}
      {!loading && shipment && (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* 1. Branded Consignment Hero Header & Identity */}
          <div
            className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-md text-white relative border border-white/10"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}EE 55%, ${secondaryColor} 100%)`,
            }}
          >
            {/* Live sync alert header if updating */}
            {isUpdating && (
              <div className="px-4 sm:px-6 py-2 bg-amber-500/20 border-b border-amber-400/30 text-amber-200 text-xs font-semibold flex items-center gap-2 backdrop-blur-xs">
                <RefreshCw size={13} className="animate-spin text-amber-300 shrink-0" />
                <span>Synchronizing live checkpoint from operations...</span>
              </div>
            )}

            <div className="p-4 sm:p-6 md:p-8 space-y-5 relative z-10">
              {/* Header Row: Tracking ID + Status Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-5 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
                      Consignment Tracking Code
                    </span>
                    {shipment.batch && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15">
                        Batch: {shipment.batch}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <h2 className="text-xl xs:text-2xl sm:text-3xl font-extrabold tracking-wide font-mono text-white drop-shadow-xs break-all">
                      {shipment.id}
                    </h2>
                    <button
                      type="button"
                      onClick={handleCopyTracking}
                      className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-white/15 min-h-[34px]"
                      title="Copy tracking code to clipboard"
                    >
                      {copiedTracking ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  {shipment.description && (
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl font-medium leading-relaxed">
                      {shipment.description}
                    </p>
                  )}
                </div>

                <div className="flex sm:flex-col sm:items-end justify-between items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] hidden sm:block">
                    Current Milestone
                  </span>
                  <ShipmentStatusBadge status={shipment.status} showLivePulse />
                  <div className="flex items-center gap-2 mt-0.5">
                    {lastUpdated && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> Synced {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={refresh}
                      title="Refresh status now"
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw size={11} className={isUpdating ? "animate-spin text-amber-300" : ""} />
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Journey Route Visualizer */}
              {/* Mobile Route (< md) */}
              <div className="md:hidden bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-xs space-y-3.5">
                {/* Origin */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/15">
                    <MapPin size={16} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Origin Hub
                    </span>
                    <p className="font-bold text-xs text-white truncate">
                      {shipment.origin || "Guangzhou Warehouse, China"}
                    </p>
                    <span className="text-[10px] text-slate-300">Intake &amp; Consolidation</span>
                  </div>
                </div>

                {/* In-Transit Connector */}
                <div className="pl-4 py-1 border-l-2 border-dashed border-white/20 ml-4 space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-xs font-bold text-white border border-white/15">
                    <TransitIcon size={13} style={{ color: accentColor }} className="animate-pulse" />
                    <span>{shipment.shippingMethod || (isAirFreight ? "Air Cargo Express" : "Sea Freight Container")}</span>
                  </div>
                  <div className="w-full relative flex items-center pt-1">
                    <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progressPercentage}%`,
                          background: `linear-gradient(90deg, ${accentColor}, #FAB763)`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold block">
                    {progressPercentage}% of journey completed
                  </span>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/15">
                    <MapPin size={16} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                      Final Destination
                    </span>
                    <p className="font-bold text-xs text-white truncate">
                      {shipment.destination || "Accra Hub, Ghana"}
                    </p>
                    <span className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1">
                      <Calendar size={10} /> {shipment.estimatedArrival ? `Est. ${shipment.estimatedArrival}` : "In Transit"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop Route (>= md) */}
              <div className="hidden md:grid md:grid-cols-3 gap-4 items-center bg-white/5 rounded-2xl p-4 sm:p-5 border border-white/10 backdrop-blur-xs">
                {/* Origin */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/15">
                    <MapPin size={20} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Origin Hub
                    </span>
                    <p className="font-bold text-sm text-white truncate">
                      {shipment.origin || "Guangzhou Warehouse, China"}
                    </p>
                    <span className="text-[11px] text-slate-300">Intake &amp; Consolidation</span>
                  </div>
                </div>

                {/* Mode & Path */}
                <div className="flex flex-col items-center justify-center py-2 px-3">
                  <div className="flex items-center justify-center gap-2 mb-1.5">
                    <TransitIcon size={16} style={{ color: accentColor }} className="animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      {shipment.shippingMethod || (isAirFreight ? "Air Cargo Express" : "Sea Freight Container")}
                    </span>
                  </div>
                  <div className="w-full relative flex items-center">
                    <div className="w-full h-1 bg-white/15 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progressPercentage}%`,
                          background: `linear-gradient(90deg, ${accentColor}, #FAB763)`,
                        }}
                      />
                    </div>
                    <div
                      className="absolute w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all duration-700 -translate-x-1/2"
                      style={{
                        left: `${Math.max(5, Math.min(95, progressPercentage))}%`,
                        background: accentColor,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-300 mt-1.5 font-medium">
                    {progressPercentage}% of journey completed
                  </span>
                </div>

                {/* Destination */}
                <div className="flex items-start gap-3 md:justify-end">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/15 md:order-2">
                    <MapPin size={20} className="text-emerald-400" />
                  </div>
                  <div className="min-w-0 md:text-right md:order-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Final Destination
                    </span>
                    <p className="font-bold text-sm text-white truncate">
                      {shipment.destination || "Accra Hub, Ghana"}
                    </p>
                    <span className="text-[11px] text-emerald-300 font-semibold flex items-center md:justify-end gap-1">
                      <Calendar size={11} /> {shipment.estimatedArrival ? `Est. ${shipment.estimatedArrival}` : "In Transit"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 5-Stage Milestone Progress Tracker */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-[#E5E7EB] shadow-xs space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                  <Radio size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#172236]">Milestone Progress Tracker</h3>
                  <p className="text-[10px] sm:text-[11px] text-[#667085]">Verified stages from China intake to Ghana delivery</p>
                </div>
              </div>
              <span
                className="text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full border shrink-0"
                style={{
                  background: `${primaryColor}10`,
                  color: primaryColor,
                  borderColor: `${primaryColor}25`,
                }}
              >
                Stage {milestoneIndex + 1} of 5
              </span>
            </div>

            {/* Mobile View: Vertical Step Cards */}
            <div className="md:hidden space-y-2.5 pt-1">
              {MILESTONE_STAGES.map((stage, idx) => {
                const isPast = idx < milestoneIndex;
                const isCurrent = idx === milestoneIndex;
                const isUpcoming = idx > milestoneIndex;
                const StageIcon = stage.icon;

                return (
                  <div
                    key={stage.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? "shadow-xs"
                        : isPast
                        ? "bg-slate-50/70 border-slate-200"
                        : "bg-white border-slate-100 opacity-60"
                    }`}
                    style={
                      isCurrent
                        ? {
                            backgroundColor: `${accentColor}12`,
                            borderColor: `${accentColor}50`,
                          }
                        : undefined
                    }
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs mt-0.5 ${
                        isPast
                          ? "bg-emerald-500 text-white"
                          : isCurrent
                          ? "ring-3 shadow-xs"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                      style={
                        isCurrent
                          ? {
                              background: primaryColor,
                              color: accentColor,
                              boxShadow: `0 0 0 3px ${accentColor}30`,
                            }
                          : undefined
                      }
                    >
                      {isPast ? <Check size={14} strokeWidth={3} /> : <StageIcon size={14} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className="text-xs font-bold"
                          style={{
                            color: isCurrent ? primaryColor : isPast ? "#172236" : "#64748B",
                          }}
                        >
                          {stage.label}
                        </p>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isCurrent
                              ? "font-extrabold"
                              : isPast
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                          style={
                            isCurrent
                              ? {
                                  background: `${accentColor}25`,
                                  color: primaryColor,
                                }
                              : undefined
                          }
                        >
                          {isCurrent ? "Current" : isPast ? "Done" : "Upcoming"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8] font-medium block mt-0.5">
                        {stage.location}
                      </span>
                      <p className="text-[10px] text-slate-600 mt-1 leading-snug">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Horizontal Connected Stepper */}
            <div className="hidden md:block relative pt-2">
              <div className="absolute top-7 left-10 right-10 h-1 bg-slate-100 z-0 rounded-full" />
              <div
                className="absolute top-7 left-10 h-1 z-0 rounded-full transition-all duration-700"
                style={{
                  width: `calc(${milestoneIndex * 25}% )`,
                  background: `linear-gradient(90deg, #10B981, ${accentColor})`,
                }}
              />

              <div className="grid grid-cols-5 gap-4 relative z-10">
                {MILESTONE_STAGES.map((stage, idx) => {
                  const isPast = idx < milestoneIndex;
                  const isCurrent = idx === milestoneIndex;
                  const isUpcoming = idx > milestoneIndex;
                  const StageIcon = stage.icon;

                  return (
                    <div
                      key={stage.key}
                      className={`flex flex-col items-center text-center p-2 rounded-2xl transition-all ${
                        isCurrent
                          ? "shadow-2xs"
                          : "bg-transparent"
                      }`}
                      style={
                        isCurrent
                          ? {
                              backgroundColor: `${accentColor}12`,
                              border: `1px solid ${accentColor}40`,
                            }
                          : undefined
                      }
                    >
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xs transition-all ${
                          isPast
                            ? "bg-emerald-500 text-white shadow-xs"
                            : isCurrent
                            ? "shadow-sm"
                            : "bg-white border-2 border-slate-200 text-slate-400"
                        }`}
                        style={
                          isCurrent
                            ? {
                                background: primaryColor,
                                color: accentColor,
                                boxShadow: `0 0 0 4px ${accentColor}30`,
                              }
                            : undefined
                        }
                      >
                        {isPast ? <Check size={16} strokeWidth={3} /> : <StageIcon size={16} />}
                      </div>

                      <div className="min-w-0 mt-2">
                        <p
                          className="text-xs font-bold leading-tight"
                          style={{
                            color: isCurrent ? primaryColor : isPast ? "#172236" : "#64748B",
                          }}
                        >
                          {stage.label}
                        </p>
                        <span className="text-[10px] text-[#94A3B8] block mt-0.5 font-medium">
                          {stage.location}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-1 leading-snug">
                          {stage.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4. Relevant Shipment and Batch Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left 2 Cols: Cargo Specifications */}
            <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-[#E5E7EB] shadow-xs space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
                    style={{
                      background: `${secondaryColor}15`,
                      color: secondaryColor,
                      borderColor: `${secondaryColor}30`,
                    }}
                  >
                    <Package size={16} />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#172236] truncate">Cargo Specifications</h3>
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-[#64748B] shrink-0">
                  Registered {shipment.registeredDate || "N/A"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
                {/* Weight */}
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                    <Scale size={11} style={{ color: secondaryColor }} /> Weight
                  </span>
                  <p className="font-extrabold text-xs sm:text-base text-[#172236] truncate">
                    {shipment.weight ? `${shipment.weight} kg` : "Pending"}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-[#94A3B8] block truncate">Gross Weight</span>
                </div>

                {/* Quantity */}
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                    <Boxes size={11} style={{ color: accentColor }} /> Packages
                  </span>
                  <p className="font-extrabold text-xs sm:text-base text-[#172236] truncate">
                    {shipment.quantity ? `${shipment.quantity} Item(s)` : "1 Carton"}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-[#94A3B8] block truncate">Package Count</span>
                </div>

                {/* Shipping Method */}
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                    <TransitIcon size={11} className="text-emerald-600" /> Mode
                  </span>
                  <p className="font-extrabold text-xs sm:text-base text-[#172236] truncate">
                    {isAirFreight ? "Air Cargo" : "Sea Freight"}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-[#94A3B8] block truncate">{isAirFreight ? "7-10 Days" : "25-35 Days"}</span>
                </div>

                {/* Batch Info */}
                <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                    <FileText size={11} style={{ color: secondaryColor }} /> Batch
                  </span>
                  <p className="font-extrabold text-xs sm:text-base text-[#172236] font-mono truncate">
                    {shipment.batch || "Unassigned"}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-[#94A3B8] truncate block">
                    {shipment.batchStageLabel || "Standard"}
                  </span>
                </div>
              </div>

              {/* Consignee & Details List */}
              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-100 gap-1">
                  <span className="text-[#64748B] font-medium text-[11px] sm:text-xs">Consignee Name:</span>
                  <span className="font-bold text-[#172236]">{shipment.customerName || "Registered Customer"}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-gray-100 gap-1">
                  <span className="text-[#64748B] font-medium text-[11px] sm:text-xs">Customer Identifier:</span>
                  <span className="font-mono font-bold" style={{ color: primaryColor }}>{shipment.customerId}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-1">
                  <span className="text-[#64748B] font-medium text-[11px] sm:text-xs">Description of Goods:</span>
                  <span className="font-semibold text-[#172236] sm:text-right break-words max-w-sm">
                    {shipment.description || "General Merchandise"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Quick Actions & Support */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-[#E5E7EB] shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-3 border-b border-[#F1F5F9]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
                    <ShieldCheck size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#172236]">Support &amp; Portal</h3>
                    <p className="text-[10px] text-[#667085]">Instant assistance &amp; fee settlement</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Origin Port</span>
                    <span className="font-semibold text-[#172236]">{shipment.origin || "Guangzhou"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Destination</span>
                    <span className="font-semibold text-[#172236]">{shipment.destination || "Accra"}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-[#64748B]">Estimated Arrival</span>
                    <span className="font-bold text-emerald-700">
                      {shipment.estimatedArrival || "In Transit"}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Have inquiries about cargo clearing or delivery arrangements? Contact our dedicated shipping desk.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#F1F5F9]">
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs min-h-[42px]"
                >
                  <MessageSquare size={14} className="text-emerald-600" />
                  <span>Inquire via WhatsApp Desk</span>
                </a>

                <Link
                  href={`/login?redirect=${encodeURIComponent(`/portal/shipments/${shipment.id}`)}`}
                  className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-2xs min-h-[42px]"
                  style={{ background: primaryColor }}
                >
                  <span>Open in Customer Portal</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </div>

          {/* 5. Cargo Images (Where supported) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-[#E5E7EB] shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                  <Camera size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#172236] truncate">Inspection &amp; Package Photos</h3>
                  <p className="text-[10px] sm:text-[11px] text-[#667085] truncate">
                    HD photos captured during intake in Guangzhou
                  </p>
                </div>
              </div>
              {shipment.photos && shipment.photos.length > 0 && (
                <span
                  className="text-[10px] sm:text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-full bg-slate-100 border shrink-0"
                  style={{ color: primaryColor, borderColor: `${primaryColor}20` }}
                >
                  {shipment.photos.length} Photo(s)
                </span>
              )}
            </div>

            {shipment.photos && shipment.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-4 pt-1">
                {shipment.photos.map((photo, pIdx) => (
                  <div
                    key={photo.id || pIdx}
                    onClick={() => setActivePhotoModal({ url: photo.url, filename: photo.filename })}
                    className="group relative rounded-xl sm:rounded-2xl overflow-hidden border border-[#E5E7EB] aspect-square bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition-all active:scale-95"
                  >
                    <img
                      src={photo.url}
                      alt={`Cargo Photo ${pIdx + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-bold backdrop-blur-2xs">
                      <ZoomIn size={14} />
                      <span>Inspect</span>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded truncate">
                      {photo.filename || `Photo #${pIdx + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 sm:py-10 text-center bg-slate-50 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 space-y-1.5 px-3">
                <Camera size={24} className="mx-auto text-slate-300 sm:w-7 sm:h-7" />
                <p className="text-xs font-bold text-[#172236]">No Intake Photos Uploaded Yet</p>
                <p className="text-[10px] sm:text-[11px] text-[#667085] max-w-sm mx-auto leading-relaxed">
                  Our Guangzhou warehouse team captures and uploads package photos upon intake, inspection, and weighing.
                </p>
              </div>
            )}
          </div>

          {/* 6. Live Checkpoints & Timeline */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-[#E5E7EB] shadow-xs space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9] gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
                  style={{
                    background: `${secondaryColor}15`,
                    color: secondaryColor,
                    borderColor: `${secondaryColor}30`,
                  }}
                >
                  <Radio size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-[#172236] truncate">Journey Timeline &amp; Checkpoints</h3>
                  <p className="text-[10px] sm:text-[11px] text-[#667085] truncate">Verified milestones updated from Operations</p>
                </div>
              </div>
              {lastUpdated && (
                <span className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] flex items-center gap-1 shrink-0">
                  <Clock size={11} />
                  <span>{lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </span>
              )}
            </div>

            {/* Canonical Timeline Component */}
            <ShipmentTimeline currentStatus={shipment.status} events={shipment.trackingEvents} />
          </div>
        </div>
      )}

      {/* State 4: Not Searched Yet (Introductory Guidance) */}
      {!loading && !searched && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 pt-2">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] shadow-xs space-y-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border mb-3"
              style={{
                background: `${secondaryColor}15`,
                color: secondaryColor,
                borderColor: `${secondaryColor}30`,
              }}
            >
              <Radio size={20} />
            </div>
            <h4 className="text-sm font-bold text-[#172236]">Real-Time Checkpoints</h4>
            <p className="text-xs text-[#667085] leading-relaxed">
              Direct telemetry from China cargo consolidation to Tema port customs verification and Accra warehouse release.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 mb-3">
              <Camera size={20} />
            </div>
            <h4 className="text-sm font-bold text-[#172236]">Intake Photo Verification</h4>
            <p className="text-xs text-[#667085] leading-relaxed">
              Every package is inspected, photographed, and weighed upon receipt at our Guangzhou warehouse facility.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#E5E7EB] shadow-xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 mb-3">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-[#172236]">Instant Automated Sync</h4>
            <p className="text-xs text-[#667085] leading-relaxed">
              Track easily across mobile, tablet, and desktop without manual refreshes or delayed updates.
            </p>
          </div>
        </div>
      )}

      {/* ── PHOTO LIGHTBOX / INSPECTION MODAL ── */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActivePhotoModal(null)}
        >
          <div
            className="max-w-3xl w-full bg-slate-900 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 flex items-center justify-between border-b border-white/10 text-white gap-2">
              <span className="text-xs font-mono font-bold truncate max-w-[200px] sm:max-w-md">
                {activePhotoModal.filename || "Cargo Inspection Photo"}
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <a
                  href={activePhotoModal.url}
                  download={activePhotoModal.filename || "cargo-photo.jpg"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer min-h-[36px]"
                >
                  <Download size={13} />
                  <span className="hidden xs:inline">Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePhotoModal(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                  aria-label="Close photo preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-2 sm:p-4 bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={activePhotoModal.url}
                alt="Cargo Full HD Preview"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg sm:rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "#F2901F";

  return (
    <div className="min-h-[calc(100vh-78px)] bg-slate-50 text-[#172236] py-6 sm:py-10 md:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="w-full p-12 rounded-3xl bg-white border border-[#E5E7EB] text-center space-y-3 shadow-xs">
              <RefreshCw size={24} className="animate-spin mx-auto" style={{ color: accentColor }} />
              <p className="text-sm font-semibold text-[#667085]">Loading real-time tracking console...</p>
            </div>
          }
        >
          <TrackContent />
        </Suspense>
      </div>
    </div>
  );
}

