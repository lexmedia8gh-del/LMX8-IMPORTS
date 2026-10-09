"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, Truck, Package, CreditCard, Search, Bell, Settings, Menu, 
  LogOut, FileText, ArrowRightLeft, Paintbrush, PanelLeftClose, PanelLeftOpen, Database, Mail, Activity
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { getCurrentAdminAction } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";
import { AdminNotificationMenu } from "@/components/admin-notification-menu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ name: string; role: string } | null>(null);
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  useEffect(() => {
    getCurrentAdminAction()
      .then(a => setAdminInfo({ name: a.name, role: a.role }))
      .catch(() => {});
  }, []);
  
  const navItems = [
    { href: "/admin", icon: <Package className="w-5 h-5 shrink-0" />, label: "Dashboard" },
    { href: "/admin/analytics", icon: <Activity className="w-5 h-5 shrink-0" />, label: "Analytics" },
    { href: "/admin/customers", icon: <Users className="w-5 h-5 shrink-0" />, label: "Customers" },
    { href: "/admin/shipments", icon: <Truck className="w-5 h-5 shrink-0" />, label: "Shipments" },
    { href: "/admin/sourcing", icon: <Search className="w-5 h-5 shrink-0" />, label: "Sourcing" },
    { href: "/admin/payments", icon: <CreditCard className="w-5 h-5 shrink-0" />, label: "Payments" },
    { href: "/admin/credits", icon: <div className="w-5 h-5 flex items-center justify-center border-2 border-current rounded-full text-[10px] font-bold shrink-0">C</div>, label: "Credits" },
    { href: "/admin/batches", icon: <FileText className="w-5 h-5 shrink-0" />, label: "Delivery (Batches)" },
    { href: "/admin/transactions", icon: <ArrowRightLeft className="w-5 h-5 shrink-0" />, label: "Transactions" },
    { href: "/admin/notifications", icon: <Bell className="w-5 h-5 shrink-0" />, label: "Notifications" },
    { href: "/admin/live-sync", icon: <Activity className="w-5 h-5 shrink-0" />, label: "Live Sync" },
    { href: "/admin/data-management", icon: <Database className="w-5 h-5 shrink-0" />, label: "Data Control" },
    { href: "/admin/settings?tab=branding", icon: <Paintbrush className="w-5 h-5 shrink-0" />, label: "Branding" },
    { href: "/admin/settings", icon: <Settings className="w-5 h-5 shrink-0" />, label: "Settings" },
  ];

  const handleSignOut = () => {
    import('@/app/actions/auth').then((m) => m.logoutAction('/login'));
  };

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="space-y-1">
      {navItems.map((item) => {
        const itemPath = item.href.split('?')[0];
        const isActive = item.href.includes('?') 
          ? pathname === itemPath && typeof window !== "undefined" && window.location.search.includes("branding")
          : pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + '/'));

        return (
          <Link 
            key={item.href} 
            href={item.href} 
            title={isCollapsed && !mobile ? item.label : undefined}
            onClick={() => {
              if (mobile) setMobileMenuOpen(false);
            }}
            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isActive 
                ? 'shadow-sm text-[#07182F]' 
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            } ${isCollapsed && !mobile ? 'justify-center px-2' : ''}`}
            style={isActive ? { backgroundColor: branding?.accentColor || "#F2901F", color: "#07182F" } : {}}
          >
            {item.icon} 
            {(!isCollapsed || mobile) && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="flex min-h-screen font-sans bg-[#F7F9FC] text-[#172236] overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 shadow-xl z-20 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}
        style={{ background: branding?.primaryColor || "#141B47", color: "#FFFFFF" }}
      >
        <div className="h-20 flex items-center px-5 overflow-hidden shrink-0 border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-3">
            {isCollapsed ? (
              <BrandLogo variant="symbol" height={32} />
            ) : (
              <BrandLogo variant="light" height={36} />
            )}
          </Link>
        </div>
        
        <nav className="flex-1 py-6 overflow-y-auto scrollbar-thin">
          <NavLinks />
        </nav>
        
        <div className="p-4 shrink-0 border-t border-white/10 mt-auto space-y-2">
          {/* Modern Sidebar Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!isCollapsed && <span>Collapse Menu</span>}
          </button>

          <button 
            onClick={handleSignOut}
            title={isCollapsed ? "Logout" : undefined}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-semibold text-red-300 hover:text-white hover:bg-red-500/20 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut className="w-5 h-5 shrink-0" /> 
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
        {/* Responsive Header */}
        <header className="h-16 sm:h-20 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-3 sm:px-6 z-30 sticky top-0 shadow-sm backdrop-blur-sm bg-white/95">
          {/* Mobile Header Left + Logo */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile Sheet Trigger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors text-[#141B47] shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Open Navigation Menu">
                <Menu className="w-6 h-6" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-xs p-0 border-none flex flex-col z-50 shadow-2xl" style={{ backgroundColor: branding?.primaryColor || "#141B47", color: "white" }}>
                <SheetTitle className="sr-only">Admin Navigation Menu</SheetTitle>
                
                {/* Drawer Brand Header */}
                <div className="h-18 flex items-center justify-between px-5 shrink-0 border-b border-white/10">
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                    <BrandLogo
                      variant="full-light"
                      primaryColor={branding?.primaryColor}
                      secondaryColor={branding?.secondaryColor}
                      accentColor={branding?.accentColor}
                      customImageUrl={branding?.lightLogoUrl}
                      height={32}
                    />
                  </Link>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider text-black bg-amber-400">
                    CTRL ROOM
                  </span>
                </div>
                
                {/* Drawer Navigation Links */}
                <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
                  <NavLinks mobile={true} />
                </nav>

                {/* Drawer Footer Actions */}
                <div className="p-4 shrink-0 border-t border-white/10 space-y-2">
                  <div className="px-3 py-2 rounded-xl bg-white/5 flex items-center justify-between">
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{adminInfo?.name ?? "Administrator"}</p>
                      <p className="text-[10px] text-gray-300 uppercase tracking-wider">{adminInfo?.role ?? "System Admin"}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Mobile Logo Brand display */}
            <div className="md:hidden flex items-center gap-2">
              <Link href="/admin" className="min-h-[44px] flex items-center">
                <BrandLogo variant="symbol" height={28} />
              </Link>
              <span className="text-xs font-black tracking-tight text-[#141B47] truncate max-w-[120px] sm:max-w-none">
                CTRL ROOM
              </span>
            </div>

            {/* Desktop Brand / Breadcrumb Label */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm font-bold text-[#141B47]">LMX8 CTRL ROOM</span>
              <span className="text-gray-300">/</span>
              <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
                {navItems.find(i => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href)))?.label || "Operations"}
              </span>
            </div>
          </div>
          
          {/* Header Right Controls */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Notifications Menu Popover */}
            <AdminNotificationMenu />

            <div className="h-6 w-px bg-[#E2E8F0] hidden sm:block"></div>
            
            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  const el = document.getElementById('admin-dropdown');
                  if (el) el.classList.toggle('hidden');
                }}
                onBlur={() => {
                  setTimeout(() => {
                    const el = document.getElementById('admin-dropdown');
                    if (el && !el.contains(document.activeElement)) el.classList.add('hidden');
                  }, 200);
                }}
                className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:bg-gray-100 p-1 sm:p-1.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[44px]"
                aria-expanded="false"
                aria-haspopup="true"
              >
                <div className="hidden sm:block text-right">
                  <span className="text-[#141B47] font-bold text-xs block leading-tight">{adminInfo?.name ?? "Admin"}</span>
                  <span className="text-[#64748B] text-[10px] uppercase tracking-wider block mt-0.5">{adminInfo?.role ?? "Admin"}</span>
                </div>
                <div 
                  className="w-8 h-8 sm:w-9 sm:h-9 text-white rounded-xl flex items-center justify-center text-xs sm:text-sm font-bold shadow-sm shrink-0" 
                  style={{ backgroundColor: branding?.secondaryColor || "#355DAF" }}
                >
                  {adminInfo?.name?.charAt(0) ?? "A"}
                </div>
              </button>
              
              {/* Dropdown Menu */}
              <div id="admin-dropdown" className="hidden absolute right-0 top-full mt-2 w-52 sm:w-56 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3.5 border-b border-[#E2E8F0] bg-gray-50/70">
                  <p className="text-xs font-bold text-[#141B47] truncate">{adminInfo?.name ?? "Administrator"}</p>
                  <p className="text-[10px] font-semibold text-amber-600 mt-0.5 uppercase tracking-wider">CTRL ROOM</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <Link href="/admin/settings" className="flex items-center px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-[#141B47] rounded-xl transition-colors">
                    <Settings className="w-3.5 h-3.5 mr-2 text-gray-400" /> Platform Settings
                  </Link>
                  <Link href="/admin/settings?tab=branding" className="flex items-center px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-[#141B47] rounded-xl transition-colors">
                    <Paintbrush className="w-3.5 h-3.5 mr-2 text-gray-400" /> Branding & Logos
                  </Link>
                </div>
                <div className="p-1.5 border-t border-[#E2E8F0]">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2" /> Log Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content Body */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 min-w-0 w-full overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Quiet Footer */}
        <footer className="py-4 px-4 text-center text-xs text-[#64748B] border-t border-[#E2E8F0] bg-white">
          <p>© {new Date().getFullYear()} LMX8 IMPORTS · Operations & Logistics CTRL ROOM</p>
        </footer>
      </div>
    </div>
  );
}
