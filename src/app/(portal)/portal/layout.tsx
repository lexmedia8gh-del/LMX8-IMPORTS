"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Truck, CreditCard, Search, Bell, User, LogOut,
  Menu, PanelLeftClose, PanelLeftOpen, X, Check, ChevronRight
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getCurrentCustomerAction } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";
import {
  getNotificationsAction,
  getUnreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import { PortalPageTracker } from "@/components/portal-page-tracker";

const NAV = [
  { href: "/portal",               icon: LayoutDashboard, label: "Dashboard" },
  { href: "/portal/shipments",     icon: Truck,           label: "My Shipments" },
  { href: "/portal/payments",      icon: CreditCard,      label: "Shipping Payments" },
  { href: "/portal/sourcing",      icon: Search,          label: "Product Sourcing" },
  { href: "/portal/notifications", icon: Bell,            label: "Notifications" },
  { href: "/portal/profile",       icon: User,            label: "My Profile" },
];

const BOTTOM_NAV = [
  { href: "/portal",               icon: LayoutDashboard, label: "Home" },
  { href: "/portal/shipments",     icon: Truck,           label: "Shipments" },
  { href: "/portal/payments",      icon: CreditCard,      label: "Payments" },
  { href: "/portal/sourcing",      icon: Search,          label: "Sourcing" },
  { href: "/portal/profile",       icon: User,            label: "Profile" },
];

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
  return `${d}d ago`;
}

function SidebarContent({
  collapsed = false,
  onToggleCollapse,
  onClose,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  return (
    <div className="flex flex-col h-full" style={{ background: branding?.primaryColor || "var(--primary)" }}>
      {/* Logo */}
      <div className="h-16 md:h-20 flex items-center px-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <Link href="/" onClick={onClose}>
          {collapsed ? (
            <BrandLogo variant="symbol" height={32} />
          ) : (
            <BrandLogo variant="light" height={36} />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto px-2">
        {NAV.map(({ href, icon: Icon, label }) => {
          const exact = href === "/portal";
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                active ? "text-white shadow-sm" : "text-gray-300 hover:text-white hover:bg-white/10"
              } ${collapsed ? "justify-center" : ""}`}
              style={active ? { 
                background: branding?.secondaryColor || "var(--secondary)", 
                borderLeft: `3px solid ${branding?.accentColor || "var(--accent)"}`, 
                paddingLeft: collapsed ? "12px" : "10px" 
              } : {}}
            >
              <Icon className="shrink-0" size={18} style={active ? { color: branding?.accentColor || "var(--accent)" } : {}} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 shrink-0 space-y-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`hidden md:flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all ${collapsed ? "justify-center" : ""}`}
          >
            {collapsed ? <PanelLeftOpen size={18} className="shrink-0" /> : <PanelLeftClose size={18} className="shrink-0" />}
            {!collapsed && <span>Collapse Menu</span>}
          </button>
        )}
        <button
          onClick={() => { import("@/app/actions/auth").then((m) => m.logoutAction("/login")); }}
          className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

// ── NOTIFICATION PANEL ──────────────────────────────────────────────────────────
function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  notifications: NotifItem[];
  unreadCount: number;
  onMarkRead: (id: string, actionUrl?: string | null) => void;
  onMarkAllRead: () => void;
  loading: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const typeColors: Record<string, string> = {
    SHIPMENT: "#3B82F6",
    PAYMENT: "#10B981",
    DELIVERY: "#8B5CF6",
    ACCOUNT: "#F59E0B",
    SYSTEM: "#667085",
  };

  return (
    <div
      ref={panelRef}
      id="notification-popover"
      role="region"
      aria-label="Customer notifications"
      className="fixed inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col sm:w-96 animate-in fade-in zoom-in-95 duration-150"
      style={{ maxHeight: "min(490px, calc(100vh - 90px))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9] bg-gray-50/80 shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "var(--primary)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>Notifications</span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-[11px] font-semibold text-[#10B981] hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"
            >
              <Check size={12} /> Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9]">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center">
            <Bell size={32} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-[#172236]">You&apos;re all caught up!</p>
            <p className="text-xs text-[#94A3B8] mt-1">No notifications yet.</p>
          </div>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <button
              key={n.id}
              onClick={() => onMarkRead(n.id, n.actionUrl)}
              className={`w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? "bg-blue-50/40" : ""}`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                style={{ background: n.read ? "#E5E7EB" : (typeColors[n.type] ?? "var(--accent)") }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-semibold leading-tight ${n.read ? "text-[#475569]" : ""}`}
                    style={!n.read ? { color: "var(--primary)" } : {}}
                  >
                    {n.title}
                  </p>
                  <span className="text-[10px] text-[#94A3B8] shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-xs text-[#667085] mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                {n.actionUrl && (
                  <span className="text-[10px] font-semibold mt-1 flex items-center gap-0.5" style={{ color: "var(--accent)" }}>
                    View details <ChevronRight size={10} />
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#F1F5F9] px-4 py-2.5 bg-gray-50/50">
        <Link
          href="/portal/notifications"
          onClick={onClose}
          className="text-xs font-semibold hover:opacity-80 transition-colors"
          style={{ color: "var(--primary)" }}
        >
          View all notifications →
        </Link>
      </div>
    </div>
  );
}

// ── PROFILE DROPDOWN ────────────────────────────────────────────────────────────
function ProfileDropdown({
  customerInfo,
}: {
  customerInfo: { id: string; name: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow hover:ring-2 transition-all cursor-pointer"
        style={{
          background: branding?.secondaryColor || "var(--secondary)",
          border: `2px solid ${branding?.accentColor ? `${branding.accentColor}55` : "rgba(255,184,0,0.3)"}`,
        }}
      >
        {(customerInfo?.name || customerInfo?.id || "C").trim().charAt(0).toUpperCase() || "C"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E2E8F0] z-50 overflow-hidden"
             style={{ maxWidth: "calc(100vw - 16px)" }}>
          <div className="p-4 border-b border-[#E2E8F0] bg-gray-50/50">
            <p className="text-sm font-bold text-[#0F172A] truncate">{customerInfo?.name || "Customer"}</p>
            <p className="text-xs font-semibold text-[#64748B] mt-0.5 truncate">ID: {customerInfo?.id || "..."}</p>
          </div>
          <div className="p-1.5">
            <Link
              href="/portal/profile"
              onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Profile
            </Link>
          </div>
          <div className="p-1.5 border-t border-[#E2E8F0]">
            <button
              onClick={() => { import("@/app/actions/auth").then((m) => m.logoutAction("/login")); }}
              className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN LAYOUT ─────────────────────────────────────────────────────────────────
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ id: string; name: string } | null>(null);
  
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  // Notifications state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    getCurrentCustomerAction()
      .then((c) => {
        if (c && c.id) {
          setCustomerInfo({ id: c.id, name: c.name || "Customer" });
        } else {
          setCustomerInfo(null);
        }
      })
      .catch(() => setCustomerInfo(null));
    // Initial unread count
    getUnreadCountAction().then(setUnreadCount).catch(() => {});
  }, []);

  // Refresh unread count on route changes
  useEffect(() => {
    getUnreadCountAction().then(setUnreadCount).catch(() => {});
  }, [pathname]);

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const notifs = await getNotificationsAction();
      setNotifications(notifs);
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadCount(unread);
    } catch {
      // Silently fail
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const handleBellClick = () => {
    if (!notifOpen) {
      setNotifOpen(true);
      loadNotifications();
    } else {
      setNotifOpen(false);
    }
  };

  const handleMarkRead = async (id: string, actionUrl?: string | null) => {
    await markNotificationReadAction(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    if (actionUrl) {
      setNotifOpen(false);
      router.push(actionUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="flex min-h-screen" style={{ background: "#F7F9FC" }}>
      <PortalPageTracker />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`}
        style={{ background: branding?.primaryColor || "var(--primary)" }}
      >
        <SidebarContent collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="p-0 w-72 border-none" style={{ background: branding?.primaryColor || "var(--primary)" }}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Topbar */}
        <header
          className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-30"
          style={{ background: branding?.primaryColor || "var(--primary)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex text-sm font-bold text-white items-center gap-2">
                <BrandLogo variant="symbol" height={24} />
                {branding?.shortName || "LMX8"}
              </span>
              <span className="hidden sm:block text-gray-500 mx-2">/</span>
              <span className="text-sm font-semibold text-white capitalize truncate block">
                {pathname === "/portal" ? "Dashboard" : pathname.split("/").pop()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={handleBellClick}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                aria-haspopup="dialog"
                aria-expanded={notifOpen}
                aria-controls="notification-popover"
                className="relative p-2 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <NotificationPanel
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                loading={notifLoading}
              />
            </div>

            {/* Profile Dropdown */}
            <ProfileDropdown customerInfo={customerInfo} />
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden flex items-center justify-around py-2 fixed bottom-0 left-0 right-0 z-20 shadow-[0_-1px_0_rgba(0,0,0,0.08)]"
          style={{ background: branding?.primaryColor || "var(--primary)" }}
        >
          {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
            const exact = href === "/portal";
            const active = exact ? pathname === href : pathname.startsWith(href);
            const activeColor = branding?.accentColor || "var(--accent)";
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[48px]"
              >
                <Icon size={20} style={{ color: active ? activeColor : "#94A3B8" }} />
                <span className="text-[10px] font-medium" style={{ color: active ? activeColor : "#94A3B8" }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <footer className="hidden md:block py-3 text-center text-xs border-t" style={{ color: "#94A3B8", borderColor: "#E5E7EB", background: "#FFFFFF" }}>
          © {new Date().getFullYear()} {branding?.businessName || "LMX8 IMPORTS"} · Powered by{" "}
          <span className="font-semibold" style={{ color: branding?.primaryColor || "var(--primary)" }}>LEXMEDIA.GH</span>
        </footer>
      </main>
    </div>
  );
}
