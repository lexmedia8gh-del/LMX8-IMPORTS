"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CreditCard, Truck, Package, ShieldCheck, Info, CheckCircle2 } from "lucide-react";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";

type NotifItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
  SHIPMENT: { icon: Truck,        bg: "#DBEAFE", color: "#1E40AF" },
  PAYMENT:  { icon: CreditCard,   bg: "#D1FAE5", color: "#065F46" },
  DELIVERY: { icon: Package,      bg: "#EDE9FE", color: "#5B21B6" },
  ACCOUNT:  { icon: ShieldCheck,  bg: "#FEF9C3", color: "#854D0E" },
  SYSTEM:   { icon: Info,         bg: "#F1F5F9", color: "#475569" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [isPending, startTransition] = useTransition();

  const tabs = ["All", "Shipments", "Payments", "Delivery", "Account", "System"];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNotificationsAction()
      .then((data) => { if (!cancelled) setNotifications(data); })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = activeTab === "All"
    ? notifications
    : notifications.filter((n) => n.type === activeTab.toUpperCase());

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = async (n: NotifItem) => {
    if (!n.read) {
      await markNotificationReadAction(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    if (n.actionUrl) router.push(n.actionUrl);
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>
            Notifications
          </h1>
          <p className="text-sm mt-1" style={{ color: "#667085" }}>
            Stay updated on your cargo and account activity.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="self-start sm:self-auto text-xs font-semibold hover:opacity-80 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
            style={{ color: "#10B981" }}
          >
            <CheckCircle2 size={14} />
            Mark all as read {unreadCount > 0 && `(${unreadCount})`}
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="bg-white rounded-2xl overflow-hidden flex flex-col"
        style={{ border: "1px solid #E5E7EB", minHeight: "60vh" }}
      >
        <div
          className="flex overflow-x-auto px-2 pt-2"
          style={{ borderBottom: "1px solid #F1F5F9", WebkitOverflowScrolling: "touch" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors shrink-0 border-b-2 cursor-pointer"
              style={{
                color: activeTab === tab ? "var(--primary)" : "#667085",
                borderColor: activeTab === tab ? "var(--accent)" : "transparent",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 divide-y divide-[#F1F5F9]">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-sm text-[#667085]">Loading notifications…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center px-6">
              <Bell size={40} className="mb-4 text-gray-200" />
              <p className="font-semibold text-base" style={{ color: "#172236" }}>
                No notifications here
              </p>
              <p className="text-sm mt-1" style={{ color: "#667085" }}>
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            filtered.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.SYSTEM;
              const Icon = cfg.icon;
              return (
                <button
                  key={notif.id}
                  onClick={() => handleMarkRead(notif)}
                  className={`w-full flex items-start gap-4 p-4 md:p-5 text-left transition-colors hover:bg-gray-50/70 cursor-pointer ${
                    !notif.read ? "bg-blue-50/30" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: cfg.bg }}
                  >
                    <Icon size={18} style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <h4
                        className={`font-semibold text-sm leading-tight ${
                          !notif.read ? "" : "text-[#475569]"
                        }`}
                        style={!notif.read ? { color: "var(--primary)" } : {}}
                      >
                        {notif.title}
                      </h4>
                      <span
                        className="text-[11px] font-medium shrink-0"
                        style={{ color: "#94A3B8" }}
                      >
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "#667085" }}
                    >
                      {notif.message}
                    </p>
                    {notif.actionUrl && (
                      <span className="text-[11px] font-semibold mt-1 block" style={{ color: "var(--accent)" }}>
                        View details →
                      </span>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.read && (
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                      style={{ background: "var(--accent)" }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
