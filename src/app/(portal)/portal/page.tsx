"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentCustomerAction, getShipmentsAction } from "@/app/actions";
import { getOutstandingShipmentsAction } from "@/app/actions/customer-payments";
import { getCustomerCreditAccountAction, getCustomerRecentActivitiesAction } from "@/app/actions/sourcing-credits";
import { ShipmentStatusBadge } from "@/components/shipment-status";
import {
  Truck, CreditCard, Package, Wallet, Bell, Info, PackageX, Award, BarChart2, PlusCircle
} from "lucide-react";
import { Shipment } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";

// 100% deterministic currency formatter to prevent locale hydration issues
function formatCurrencyDeterministic(amount: number) {
  const numericVal = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
  return `GHS ${numericVal.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
}

// Timezone and locale-safe UTC date formatter for identical SSR and client renders
function formatDateUTC(dateInput: string | Date | null | undefined, includeYear: boolean = false): string {
  if (!dateInput) return "Pending";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Pending";

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  if (includeYear) {
    return `${day} ${month} ${year}`;
  }
  return `${month} ${day}`;
}

// Client-only dynamic relative time formatting to prevent hydration mismatches
function timeAgoClient(iso: string): string {
  if (!iso) return "Today";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return formatDateUTC(iso);
}

// Client-only timezone-sensitive greeting
function getGreetingClient() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 18) return "Good afternoon";
  return "Good evening";
}

type OutstandingShipment = { id: string; fee: number; paid: number; outstanding: number; isPaid: boolean };
type CustomerFetchStatus = "loading" | "loaded" | "no_name" | "not_found" | "auth_expired" | "error";
type CustomerType = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  credits: number;
  internalId: string;
};

type ActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
};

type CreditAccountDetails = {
  balance: number;
  selectedPackage: string;
  packagePrice: number;
  creditsPurchased: number;
  creditsUsed: number;
  creditsRemaining: number;
};

export default function CustomerDashboard() {
  const [mounted, setMounted] = useState(false);
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [customerStatus, setCustomerStatus] = useState<CustomerFetchStatus>("loading");
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingShipment[]>([]);
  const [creditAccount, setCreditAccount] = useState<CreditAccountDetails | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    setCustomerStatus("loading");

    // 1. Fetch customer with detailed state handling
    getCurrentCustomerAction()
      .then((cust) => {
        if (!cust) {
          setCustomer(null);
          setCustomerStatus("not_found");
        } else {
          setCustomer(cust as CustomerType);
          const rawName = (cust.name || "").trim();
          if (!rawName || rawName === "undefined" || rawName === "null") {
            setCustomerStatus("no_name");
          } else {
            setCustomerStatus("loaded");
          }
        }
      })
      .catch((err) => {
        console.warn("[Dashboard] Error fetching customer:", err);
        setCustomer(null);
        setCustomerStatus("error");
      });

    // 2. Fetch shipments, payments, credits, activities safely
    Promise.all([
      getShipmentsAction().catch(() => []),
      getOutstandingShipmentsAction().catch(() => []),
      getCustomerCreditAccountAction().catch(() => null),
      getCustomerRecentActivitiesAction().catch(() => []),
    ]).then(([shipments, outst, credits, acts]) => {
      setMyShipments(shipments);
      setOutstanding((outst as OutstandingShipment[]).filter((s: OutstandingShipment) => !s.isPaid));
      setCreditAccount(credits as any);
      setActivities(acts as ActivityItem[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const pendingTotal = outstanding.reduce((a: number, s: OutstandingShipment) => a + (s.outstanding ?? 0), 0);

  const activeShipments = myShipments.filter(s => s.status !== "DELIVERED" && s.status !== "ON_HOLD");
  const primaryShipment = activeShipments[0] || myShipments[0]; // Most recent active

  if (loading) {
    return (
      <div className="space-y-8 page-fade max-w-4xl">
        <div className="space-y-2">
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-64 h-4" />
        </div>
        <Skeleton className="w-full h-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="w-full h-48" />
          <Skeleton className="w-full h-48" />
        </div>
        <Skeleton className="w-full h-24" />
      </div>
    );
  }

  // Stable rendering wrapper that only evaluates browser dynamic properties post-hydration
  const greeting = mounted ? getGreetingClient() : "Welcome";

  // Construct headline safely to never render "Welcome, undefined" or "Welcome, null"
  const welcomeHeadline = (() => {
    if (customerStatus === "loaded" && customer?.name) {
      const rawName = customer.name.trim();
      if (rawName && rawName !== "undefined" && rawName !== "null") {
        const firstName = customer.firstName || rawName.split(/\s+/)[0];
        if (firstName && firstName !== "undefined" && firstName !== "null") {
          return `${greeting}, ${firstName}`;
        }
      }
    }
    return greeting;
  })();

  return (
    <div className="space-y-8 page-fade max-w-4xl">
      {/* Informational banners for customer state */}
      {customerStatus === "error" && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between">
          <span>Unable to verify complete customer profile details at this moment.</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded text-xs font-bold text-amber-900"
          >
            Retry
          </button>
        </div>
      )}
      {customerStatus === "not_found" && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-sm flex items-center justify-between">
          <span>Your customer profile could not be loaded. Please sign in again.</span>
          <Link
            href="/login"
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
          >
            Sign In
          </Link>
        </div>
      )}

      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#0B1F44" }}>
          {welcomeHeadline}
        </h1>
        <p className="text-sm" style={{ color: "#667085" }}>
          Here is what is happening with your account and shipments.
        </p>
      </div>

      {/* Hero: Active Shipment */}
      {primaryShipment ? (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Active Shipment</h2>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
            <div className="p-5 md:p-6 border-b border-[#F1F5F9] flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F1F5F9" }}>
                  <Truck size={24} style={{ color: "#0B1F44" }} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#667085" }}>{primaryShipment.id}</p>
                  <p className="text-lg font-bold" style={{ color: "#172236" }}>{primaryShipment.description}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <ShipmentStatusBadge status={primaryShipment.status} />
              </div>
            </div>
            <div className="p-5 md:p-6 bg-[#F7F9FC] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#667085" }}>Estimated Arrival</p>
                <p className="font-semibold" style={{ color: "#0B1F44" }}>
                  {formatDateUTC(primaryShipment.estimatedArrival, true)}
                </p>
              </div>
              <Link
                href={`/portal/shipments/${primaryShipment.id}`}
                className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all hover:bg-[#F1F5F9] border border-[#E5E7EB] w-full md:w-auto text-center"
                style={{ color: "#0B1F44", background: "white" }}
              >
                View Tracking
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Active Shipment</h2>
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
             <PackageX size={32} className="mx-auto mb-3 text-gray-300" />
             <p className="text-sm font-semibold" style={{ color: "#172236" }}>No active shipments</p>
             <p className="text-sm mt-1 mb-4" style={{ color: "#667085" }}>Your shipments will appear here once an order has been registered.</p>
             <Link href="/portal/sourcing" className="inline-block px-5 py-2.5 rounded-lg text-sm font-bold transition-colors hover:opacity-90" style={{ background: "#FFB800", color: "#07182F" }}>
               Request Sourcing
             </Link>
          </div>
        </section>
      )}

      {/* Main Grid: Left Side Credits & Balance, Right Side Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        
        {/* Left Column: Sourcing Credits Card + Payment Card */}
        <div className="space-y-6">
          {/* Sourcing Credits Card */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Sourcing Credits</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#F0FDF4]">
                  <Wallet size={20} className="text-[#10B981]" />
                </div>
                <Link
                  href="/portal/credits"
                  className="px-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] text-xs font-bold rounded-lg text-[#0B1F44] transition-colors flex items-center gap-1.5"
                >
                  <PlusCircle size={14} /> Buy Credits
                </Link>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#667085]">Current Credit Balance</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-[#0B1F44]">{creditAccount?.balance ?? 0}</span>
                  <span className="text-xs font-bold text-[#10B981] bg-[#F0FDF4] px-2 py-0.5 rounded">Credits</span>
                </div>
              </div>

              {/* Package stats grid */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#F1F5F9]">
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Active Package</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Award size={14} className="text-[#F2901F]" />
                    <span className="text-sm font-bold text-[#172236]">{creditAccount?.selectedPackage || "None"}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Credits Remaining</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <BarChart2 size={14} className="text-[#10B981]" />
                    <span className="text-sm font-bold text-[#172236]">{(creditAccount?.creditsRemaining ?? creditAccount?.balance) ?? 0} remaining</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Purchased Credits</p>
                  <span className="text-sm font-semibold text-[#475569]">{creditAccount?.creditsPurchased ?? 0} total</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Used Credits</p>
                  <span className="text-sm font-semibold text-[#475569]">{creditAccount?.creditsUsed ?? 0} used</span>
                </div>
              </div>
            </div>
          </section>

          {/* Payment Summary */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Payment Summary</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: pendingTotal > 0 ? "#FEF2F2" : "#F0FDF4" }}>
                  <CreditCard size={20} style={{ color: pendingTotal > 0 ? "#EF4444" : "#10B981" }} />
                </div>
              </div>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#667085" }}>Outstanding Balance</p>
              <p className="text-2xl md:text-3xl font-black mt-1 mb-4" style={{ color: "#0B1F44" }}>
                {formatCurrencyDeterministic(pendingTotal)}
              </p>
              {pendingTotal > 0 ? (
                 <Link href="/portal/payments" className="w-full text-center block px-4 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 shadow-sm" style={{ background: "#EF4444", color: "white" }}>
                   Make Payment
                 </Link>
              ) : (
                 <p className="text-sm font-medium flex items-center gap-2" style={{ color: "#10B981" }}>All fees are fully paid.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Unified Recent Activity */}
        <section className="space-y-3 flex flex-col h-full">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">Recent Activity</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] overflow-hidden flex flex-col flex-1">
            <div className="flex-1 divide-y divide-[#F1F5F9]">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#667085] flex flex-col items-center justify-center h-full min-h-[220px]">
                  <Bell size={24} className="mb-2 text-gray-200" />
                  <p>No recent activity found.</p>
                </div>
              ) : (
                activities.map((item) => {
                  const dateStr = mounted ? timeAgoClient(item.timestamp) : formatDateUTC(item.timestamp);
                  return (
                    <div key={item.id} className="p-4 flex items-start gap-3 transition-colors hover:bg-gray-50/50">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base bg-[#F1F5F9]">
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-bold text-[#0B1F44] truncate">{item.title}</p>
                          <span className="text-[10px] font-medium text-[#94A3B8] shrink-0 whitespace-nowrap font-sans mt-0.5">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-xs text-[#667085] mt-1 break-words leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {activities.length > 0 && (
              <div className="p-3.5 border-t border-[#F1F5F9] bg-[#F7F9FC]">
                <Link href="/portal/notifications" className="block text-center text-xs font-bold text-[#0B1F44] hover:text-[#F2901F] transition-colors">
                  View Notification Center
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "View Shipments", icon: <Truck size={18} />, href: "/portal/shipments" },
            { label: "Payments",       icon: <CreditCard size={18} />, href: "/portal/payments" },
            { label: "Sourcing",       icon: <Package size={18} />, href: "/portal/sourcing" },
            { label: "Profile",        icon: <Info size={18} />, href: "/portal/profile" },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 p-4 rounded-xl transition-all hover:bg-gray-50 border border-[#E5E7EB] bg-white"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F1F5F9", color: "#0B1F44" }}>
                {a.icon}
              </div>
              <span className="text-sm font-semibold" style={{ color: "#172236" }}>
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
