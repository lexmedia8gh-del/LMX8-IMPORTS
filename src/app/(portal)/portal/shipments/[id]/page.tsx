"use client";

import { useEffect, useState, use } from "react";
import { getShipmentByIdAction } from "@/app/actions";
import { Shipment } from "@/lib/db";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Radio,
  RefreshCw,
  Clock,
  Copy,
  Check,
  MapPin,
  Calendar,
  Plane,
  Ship,
  Package,
  Scale,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  MessageSquare,
  Download,
  ZoomIn,
  X,
  ChevronRight,
  Boxes,
  FileText,
  Sparkles,
  Truck,
  ExternalLink,
} from "lucide-react";
import { ShipmentStatusBadge, ShipmentTimeline, ShipmentStatus } from "@/components/shipment-status";
import { useShipmentRealtime } from "@/hooks/use-shipment-realtime";
import { useBrandSettings } from "@/components/brand-provider";
import { ShippingPayNowButton } from "@/components/shipping-pay-now-button";

// Deterministic currency formatter
function formatGHS(amount?: number | null) {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount || 0)) || 0;
  return `GHS ${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;
}

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
    description: "Undergoing port verification",
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

export default function ShipmentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [initialData, setInitialData] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedTracking, setCopiedTracking] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<{ url: string; filename?: string } | null>(null);

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const primaryColor = branding?.primaryColor || "#07182F";
  const secondaryColor = branding?.secondaryColor || "#141B47";
  const accentColor = branding?.accentColor || "#F2901F";

  // Hook for Supabase Realtime synchronization
  const {
    shipment,
    isRealtimeConnected,
    isUpdating,
    lastUpdated,
    refresh,
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

  const handleCopyTracking = () => {
    if (!shipment) return;
    navigator.clipboard.writeText(shipment.id);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2200);
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div
          className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
          style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }}
        />
        <p className="text-sm font-semibold text-[#667085]">Retrieving live cargo telemetry…</p>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="py-20 text-center max-w-md mx-auto bg-white rounded-3xl p-8 border border-[#E5E7EB] shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <AlertCircle size={28} />
        </div>
        <h2 className="font-bold text-xl text-[#172236]">Consignment Not Found</h2>
        <p className="text-xs sm:text-sm text-[#667085] mt-1.5 leading-relaxed">
          The requested tracking number was not located in your portal account or may belong to another user.
        </p>
        <Link
          href="/portal/shipments"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 shadow-xs"
          style={{ background: accentColor }}
        >
          <ArrowLeft size={16} /> Return to My Shipments
        </Link>
      </div>
    );
  }

  const { activeIndex: milestoneIndex, percentage: progressPercentage } = getMilestoneProgress(shipment.status);
  const isAirFreight = shipment.shippingMethod?.toLowerCase().includes("air") ?? true;
  const TransitIcon = isAirFreight ? Plane : Ship;
  const isOutstanding = typeof shipment.outstanding === "number" && shipment.outstanding > 0 && !shipment.isPaid;

  const whatsappInquiryUrl = `https://wa.me/233241234567?text=${encodeURIComponent(
    `Hello LMX8 Support, I am tracking consignment ${shipment.id} (${shipment.description || "General Cargo"}). Please provide an update on this shipment.`
  )}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* ── TOP NAVIGATION & LIVE REALTIME BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/portal/shipments"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#172236] transition-colors"
        >
          <ArrowLeft size={16} /> Back to My Shipments
        </Link>

        <div className="flex items-center gap-2">
          {isRealtimeConnected ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
              title="Real-time live synchronization active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync Active</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#94A3B8]">
              <Clock size={12} /> Standard Sync
            </span>
          )}

          <button
            type="button"
            onClick={refresh}
            title="Refresh status now"
            className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#64748B] hover:text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={isUpdating ? "animate-spin text-amber-600" : ""} />
          </button>
        </div>
      </div>

      {/* ── LIVE HERO CONSIGNMENT BANNER ── */}
      <div
        className="rounded-3xl overflow-hidden shadow-md text-white relative border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #0B1F44 60%, ${secondaryColor} 100%)`,
        }}
      >
        {/* Decorative ambient elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div
          className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ background: accentColor }}
        />

        {/* Live sync alert header if updating */}
        {isUpdating && (
          <div className="px-6 py-2 bg-amber-500/20 border-b border-amber-400/30 text-amber-200 text-xs font-semibold flex items-center gap-2 backdrop-blur-xs">
            <RefreshCw size={13} className="animate-spin text-amber-300 shrink-0" />
            <span>Synchronizing live checkpoint from Ctrl Room operations...</span>
          </div>
        )}

        <div className="p-6 sm:p-8 space-y-6 relative z-10">
          {/* Header Row: Tracking ID + Status Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">
                  Consignment Tracking Code
                </span>
                {shipment.batch && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15">
                    Batch: {shipment.batch}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 mt-1.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-wide font-mono text-white drop-shadow-xs">
                  {shipment.id}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyTracking}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-white/15"
                  title="Copy tracking code to clipboard"
                >
                  {copiedTracking ? (
                    <>
                      <Check size={12} className="text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {shipment.description && (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl font-medium">
                  {shipment.description}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Current Milestone
              </span>
              <ShipmentStatusBadge status={shipment.status} showLivePulse />
              {lastUpdated && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> Synced {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          {/* Journey Path Visualizer (Guangzhou ✈/🚢 Accra) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white/5 rounded-2xl p-4 sm:p-5 border border-white/10 backdrop-blur-xs">
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
                      background: `linear-gradient(90deg, #F2901F, #FBBF24)`,
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

      {/* ── VISUAL 5-STAGE MILESTONE JOURNEY STEPPER ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E7EB] shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Radio size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#172236]">Milestone Progress Tracker</h2>
              <p className="text-[11px] text-[#667085]">End-to-end journey stages from China intake to Ghana delivery</p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-[#141B47] border border-slate-200">
            Stage {milestoneIndex + 1} of 5
          </span>
        </div>

        {/* Stepper Grid */}
        <div className="relative pt-2">
          {/* Background Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-7 left-10 right-10 h-1 bg-slate-100 z-0 rounded-full" />
          <div
            className="hidden md:block absolute top-7 left-10 h-1 z-0 rounded-full transition-all duration-700"
            style={{
              width: `calc(${milestoneIndex * 25}% )`,
              background: "linear-gradient(90deg, #10B981, #F2901F)",
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
            {MILESTONE_STAGES.map((stage, idx) => {
              const isPast = idx < milestoneIndex;
              const isCurrent = idx === milestoneIndex;
              const isUpcoming = idx > milestoneIndex;
              const StageIcon = stage.icon;

              return (
                <div
                  key={stage.key}
                  className={`flex md:flex-col items-center md:items-center gap-3.5 md:text-center p-3 md:p-2 rounded-2xl transition-all ${
                    isCurrent
                      ? "bg-amber-50/70 border border-amber-200/80 shadow-2xs"
                      : isPast
                      ? "bg-slate-50/50 md:bg-transparent"
                      : "opacity-60 md:bg-transparent"
                  }`}
                >
                  {/* Step Marker */}
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xs transition-all ${
                      isPast
                        ? "bg-emerald-500 text-white shadow-xs"
                        : isCurrent
                        ? "bg-[#07182F] text-[#F2901F] ring-4 ring-amber-100 shadow-sm"
                        : "bg-white border-2 border-slate-200 text-slate-400"
                    }`}
                  >
                    {isPast ? <Check size={16} strokeWidth={3} /> : <StageIcon size={16} />}
                  </div>

                  <div className="min-w-0">
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isCurrent
                          ? "text-[#07182F]"
                          : isPast
                          ? "text-[#172236]"
                          : "text-[#64748B]"
                      }`}
                    >
                      {stage.label}
                    </p>
                    <span className="text-[10px] text-[#94A3B8] block mt-0.5 font-medium">
                      {stage.location}
                    </span>
                    <span className="text-[10px] text-slate-500 hidden md:block mt-1 leading-snug">
                      {stage.description}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CONSIGNMENT SPECIFICATIONS & SHIPPING FEE STATUS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Cargo Specifications (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E7EB] shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#355DAF] flex items-center justify-center border border-blue-200">
                <Package size={16} />
              </div>
              <h3 className="text-sm font-bold text-[#172236]">Cargo Specifications</h3>
            </div>
            <span className="text-[11px] font-bold text-[#64748B]">
              Registered {shipment.registeredDate || "N/A"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Weight */}
            <div className="p-3.5 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                <Scale size={12} className="text-[#355DAF]" /> Weight
              </span>
              <p className="font-extrabold text-sm sm:text-base text-[#172236]">
                {shipment.weight ? `${shipment.weight} kg` : "Pending"}
              </p>
              <span className="text-[10px] text-[#94A3B8]">Gross Cargo Weight</span>
            </div>

            {/* Quantity */}
            <div className="p-3.5 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                <Boxes size={12} className="text-[#F2901F]" /> Packages
              </span>
              <p className="font-extrabold text-sm sm:text-base text-[#172236]">
                {shipment.quantity ? `${shipment.quantity} Item(s)` : "1 Carton"}
              </p>
              <span className="text-[10px] text-[#94A3B8]">Total Package Count</span>
            </div>

            {/* Shipping Method */}
            <div className="p-3.5 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                <TransitIcon size={12} className="text-emerald-600" /> Mode
              </span>
              <p className="font-extrabold text-sm sm:text-base text-[#172236] truncate">
                {isAirFreight ? "Air Cargo" : "Sea Freight"}
              </p>
              <span className="text-[10px] text-[#94A3B8]">{isAirFreight ? "7-10 Days" : "25-35 Days"}</span>
            </div>

            {/* Batch Info */}
            <div className="p-3.5 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 mb-1">
                <FileText size={12} className="text-purple-600" /> Batch
              </span>
              <p className="font-extrabold text-sm sm:text-base text-[#172236] font-mono truncate">
                {shipment.batch || "Unassigned"}
              </p>
              <span className="text-[10px] text-[#94A3B8] truncate block">
                {shipment.batchStageLabel || "Standard Dispatch"}
              </span>
            </div>
          </div>

          {/* Consignee & Details List */}
          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-[#64748B] font-medium">Consignee Name:</span>
              <span className="font-bold text-[#172236]">{shipment.customerName || "Portal Customer"}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-[#64748B] font-medium">Customer Identifier:</span>
              <span className="font-mono font-bold text-[#141B47]">{shipment.customerId}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-[#64748B] font-medium">Description of Goods:</span>
              <span className="font-semibold text-[#172236] text-right max-w-xs truncate">
                {shipment.description || "General Merchandise"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Financial / Shipping Fee Status (1 col) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E7EB] shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <CreditCard size={16} />
                </div>
                <h3 className="text-sm font-bold text-[#172236]">Shipping Fee</h3>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  isOutstanding
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {isOutstanding ? "Pending Payment" : "Settled in Full"}
              </span>
            </div>

            {/* Fee Figures */}
            <div className="p-4 rounded-2xl bg-[#F7F9FC] border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#64748B]">Total Shipping Fee</span>
                <span className="font-bold text-[#172236]">{formatGHS(shipment.fee)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#64748B]">Amount Paid to Date</span>
                <span className="font-bold text-emerald-600">{formatGHS(shipment.paidAmount)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-[#141B47]">Outstanding Balance</span>
                <span
                  className={`text-base font-extrabold ${
                    isOutstanding ? "text-amber-600" : "text-emerald-700"
                  }`}
                >
                  {formatGHS(shipment.outstanding)}
                </span>
              </div>
            </div>

            {isOutstanding ? (
              <div className="space-y-3 pt-1">
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Pay with Mobile Money (MTN, Telecel, AT) or Bank Card via Paystack for instant automated release.
                </p>
                <ShippingPayNowButton shipmentId={shipment.id} />
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Shipping Fee Paid</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  This consignment is cleared for delivery upon arrival at the destination hub.
                </p>
                <Link
                  href="/portal/payments"
                  className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
                >
                  View Receipts in Payments →
                </Link>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#F1F5F9]">
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <MessageSquare size={14} className="text-emerald-600" />
              <span>Inquire via WhatsApp Desk</span>
            </a>
          </div>
        </div>
      </div>

      {/* ── HIGH-DEFINITION CARGO INSPECTION PHOTOS ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E7EB] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172236]">Cargo Inspection &amp; Package Photos</h3>
              <p className="text-[11px] text-[#667085]">
                High-definition photos captured during intake and weighing in Guangzhou
              </p>
            </div>
          </div>
          {shipment.photos && shipment.photos.length > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-[#141B47]">
              {shipment.photos.length} Photo(s)
            </span>
          )}
        </div>

        {shipment.photos && shipment.photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-1">
            {shipment.photos.map((photo, pIdx) => (
              <div
                key={photo.id || pIdx}
                onClick={() => setActivePhotoModal({ url: photo.url, filename: photo.filename })}
                className="group relative rounded-2xl overflow-hidden border border-[#E5E7EB] aspect-square bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
              >
                <img
                  src={photo.url}
                  alt={`Cargo Photo ${pIdx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-2xs">
                  <ZoomIn size={16} />
                  <span>Inspect</span>
                </div>
                <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-1 rounded-lg truncate">
                  {photo.filename || `Photo #${pIdx + 1}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Camera size={28} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold text-[#172236]">No Intake Photos Uploaded Yet</p>
            <p className="text-[11px] text-[#667085] max-w-sm mx-auto">
              Our Guangzhou warehouse team captures and uploads package photos upon intake, inspection, and weighing.
            </p>
          </div>
        )}
      </div>

      {/* ── REAL-TIME CHECKPOINTS & TIMELINE ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E5E7EB] shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#355DAF] flex items-center justify-center border border-blue-200">
              <Radio size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172236]">Live Journey Timeline &amp; Checkpoints</h3>
              <p className="text-[11px] text-[#667085]">Verified logistical milestones updated from Operations Ctrl Room</p>
            </div>
          </div>
          {lastUpdated && (
            <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1">
              <Clock size={11} />
              <span>Synced {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </span>
          )}
        </div>

        {/* Canonical Timeline Component */}
        <ShipmentTimeline currentStatus={shipment.status} events={shipment.trackingEvents} />
      </div>

      {/* ── PHOTO LIGHTBOX / INSPECTION MODAL ── */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
          onClick={() => setActivePhotoModal(null)}
        >
          <div
            className="max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-center justify-between border-b border-white/10 text-white">
              <span className="text-xs font-mono font-bold truncate max-w-md">
                {activePhotoModal.filename || "Cargo Inspection Photo"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={activePhotoModal.url}
                  download={activePhotoModal.filename || "cargo-photo.jpg"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setActivePhotoModal(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-4 bg-black flex items-center justify-center max-h-[75vh] overflow-hidden">
              <img
                src={activePhotoModal.url}
                alt="Cargo Full HD Preview"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
