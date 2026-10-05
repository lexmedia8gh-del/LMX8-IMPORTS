"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentCustomerAction, getShipmentsAction } from "@/app/actions";
import { getNotificationsAction } from "@/app/actions/notifications";
import { getOutstandingShipmentsAction } from "@/app/actions/customer-payments";
import { ShipmentStatusBadge } from "@/components/shipment-status";
import {
  Truck, CreditCard, Package, Wallet, Bell, Info, PackageX
} from "lucide-react";
import { Shipment } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";

function formatCurrencyLocal(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
}

type NotifItem = { id: string; title: string; message: string; read: boolean; createdAt: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return "Good morning";
  if (hr < 18) return "Good afternoon";
  return "Good evening";
}

type OutstandingShipment = { id: string; fee: number; paid: number; outstanding: number; isPaid: boolean };
type CustomerType = { id: string; name: string; email: string; phone: string; credits: number; internalId: string };

export default function CustomerDashboard() {
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingShipment[]>([]);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCurrentCustomerAction(),
      getShipmentsAction(),
      getOutstandingShipmentsAction().catch(() => []),
      getNotificationsAction().catch(() => []),
    ]).then(([cust, shipments, outst, notifs]) => {
      setCustomer(cust as CustomerType);
      setMyShipments(shipments);
      setOutstanding((outst as OutstandingShipment[]).filter((s: OutstandingShipment) => !s.isPaid));
      setNotifications(notifs);
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

  return (
    <div className="space-y-8 page-fade max-w-4xl">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#0B1F44" }}>
          {getGreeting()}, {customer?.name?.split(" ")[0] || "Customer"}
        </h1>
        <p className="text-sm" style={{ color: "#667085" }}>
          Here is what is happening with your orders.
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
                  {primaryShipment.estimatedArrival ? new Date(primaryShipment.estimatedArrival).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : "Pending"}
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Payment Summary */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Payment Summary</h2>
          <div className="bg-white rounded-2xl p-6 shadow-sm h-full flex flex-col justify-center" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: pendingTotal > 0 ? "#FEF2F2" : "#F0FDF4" }}>
                <Wallet size={20} style={{ color: pendingTotal > 0 ? "#EF4444" : "#10B981" }} />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#667085" }}>Outstanding Balance</p>
            <p className="text-2xl md:text-3xl font-black mt-1 mb-4" style={{ color: "#0B1F44" }}>
              {formatCurrencyLocal(pendingTotal)}
            </p>
            {pendingTotal > 0 ? (
               <Link href="/portal/payments" className="w-full text-center px-4 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 shadow-sm" style={{ background: "#EF4444", color: "white" }}>
                 Make Payment
               </Link>
            ) : (
               <p className="text-sm font-medium flex items-center gap-2" style={{ color: "#10B981" }}>All fees are fully paid.</p>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Recent Activity</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden h-full flex flex-col" style={{ border: "1px solid #E5E7EB" }}>
            <div className="flex-1 p-0 divide-y divide-[#F1F5F9]">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm" style={{ color: "#667085" }}>
                  <Bell size={24} className="mx-auto mb-2 text-gray-200" />
                  No recent activity.
                </div>
              ) : (
                notifications.slice(0, 3).map((n) => (
                  <div key={n.id} className="p-4 flex gap-3 items-start">
                    <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: n.read ? "#E5E7EB" : "#FFB800" }} />
                    <div>
                      <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-[#0B1F44]" : "text-[#475569]"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#667085" }}>{n.message}</p>
                      <p className="text-[10px] mt-1.5 font-medium" style={{ color: "#94A3B8" }}>{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="p-3 border-t border-[#F1F5F9] bg-[#F7F9FC]">
                <Link href="/portal/notifications" className="block text-center text-xs font-bold hover:underline" style={{ color: "#0B1F44" }}>
                  View All Notifications
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
            { label: "Delivery",       icon: <Package size={18} />, href: "/portal/shipments" },
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
