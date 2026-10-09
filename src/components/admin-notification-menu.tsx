"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, X, ChevronRight, AlertCircle, Package, CreditCard, Truck, RefreshCw } from "lucide-react";
import {
  getAdminNotificationsAction,
  markAdminNotificationReadAction,
  markAllAdminNotificationsReadAction,
} from "@/app/actions/notifications";

interface AdminNotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    customerIdentifier: string;
  } | null;
}

export function AdminNotificationMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getAdminNotificationsAction();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.warn("[AdminNotificationMenu] Failed to fetch notifications:", err);
    }
  }, []);

  // Initial fetch and periodic background check
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000); // 45s poll
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  };

  const handleMarkRead = async (id: string, actionUrl?: string | null) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await markAdminNotificationReadAction(id);
    } catch (e) {
      console.error(e);
    }

    if (actionUrl) {
      setIsOpen(false);
      router.push(actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await markAllAdminNotificationsReadAction();
    } catch (e) {
      console.error(e);
    }
  };

  function timeAgo(isoDate: string) {
    const diff = Date.now() - new Date(isoDate).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SHIPMENT":
        return <Truck size={13} className="text-blue-600" />;
      case "PAYMENT":
        return <CreditCard size={13} className="text-emerald-600" />;
      case "DELIVERY":
        return <Package size={13} className="text-purple-600" />;
      default:
        return <AlertCircle size={13} className="text-amber-600" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-label={`Admin notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="admin-notification-popover"
        className="relative hover:bg-gray-100 rounded-xl w-11 h-11 min-h-[44px] min-w-[44px] text-[#64748B] hover:text-[#141B47] flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none shadow-sm ring-2 ring-white animate-in zoom-in-75 duration-150">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Responsive Notification Popover */}
      {isOpen && (
        <div
          ref={panelRef}
          id="admin-notification-popover"
          role="dialog"
          aria-label="Admin Notifications"
          className="fixed inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-96 max-w-md bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
          style={{ maxHeight: "min(520px, calc(100vh - 90px))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9] bg-gray-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#141B47] uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
                  {unreadCount}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Mark all as read"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Close notification popup"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9] scrollbar-thin">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-[#64748B] gap-2">
                <RefreshCw size={18} className="animate-spin text-[#141B47]" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                  <Bell size={22} />
                </div>
                <p className="text-sm font-bold text-[#172236]">All caught up!</p>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs">
                  No notifications to review right now. Automated milestone and system alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleMarkRead(item.id, item.actionUrl)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer hover:bg-gray-50/80 ${
                    !item.read ? "bg-amber-50/40" : ""
                  }`}
                >
                  {/* Indicator / Type Icon */}
                  <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100 shrink-0">
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-xs font-bold leading-snug line-clamp-1 ${
                          item.read ? "text-[#475569]" : "text-[#141B47]"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-[#94A3B8] shrink-0 font-medium whitespace-nowrap">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      {item.customer && (
                        <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {item.customer.customerIdentifier}
                        </span>
                      )}
                      {item.actionUrl && (
                        <span className="text-[10px] font-bold text-[#F2901F] flex items-center gap-0.5 ml-auto">
                          View <ChevronRight size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="shrink-0 border-t border-[#F1F5F9] px-4 py-2.5 bg-gray-50/70 flex items-center justify-between">
            <Link
              href="/admin/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#141B47] hover:text-[#355DAF] transition-colors flex items-center gap-1"
            >
              Open Notifications Center <ChevronRight size={12} />
            </Link>

            <button
              onClick={() => {
                setLoading(true);
                fetchNotifications().finally(() => setLoading(false));
              }}
              className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
