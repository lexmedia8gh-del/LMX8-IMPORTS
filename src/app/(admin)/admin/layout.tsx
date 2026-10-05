"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Truck, Package, CreditCard, Search, Bell, Settings, Menu, LogOut, FileText, ArrowRightLeft, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getCurrentAdminAction } from "@/app/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    getCurrentAdminAction()
      .then(a => setAdminInfo({ name: a.name, role: a.role }))
      .catch(() => {});
  }, []);
  
  const navItems = [
    { href: "/admin", icon: <Package className="w-5 h-5 shrink-0" />, label: "Overview" },
    { href: "/admin/customers", icon: <Users className="w-5 h-5 shrink-0" />, label: "Customers" },
    { href: "/admin/shipments", icon: <Truck className="w-5 h-5 shrink-0" />, label: "Shipments" },
    { href: "/admin/batches", icon: <FileText className="w-5 h-5 shrink-0" />, label: "Batches" },
    { href: "/admin/payments", icon: <CreditCard className="w-5 h-5 shrink-0" />, label: "Payments" },
    { href: "/admin/sourcing", icon: <Search className="w-5 h-5 shrink-0" />, label: "Sourcing" },
    { href: "/admin/credits", icon: <div className="w-5 h-5 flex items-center justify-center border-2 rounded-full text-[10px] font-bold shrink-0">C</div>, label: "Credits" },
    { href: "/admin/transactions", icon: <ArrowRightLeft className="w-5 h-5 shrink-0" />, label: "Transactions" },
    { href: "/admin/notifications", icon: <Bell className="w-5 h-5 shrink-0" />, label: "Notifications" },
    { href: "/admin/settings", icon: <Settings className="w-5 h-5 shrink-0" />, label: "Settings" },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + '/'));
        return (
          <Link 
            key={item.href} 
            href={item.href} 
            title={isCollapsed && !mobile ? item.label : undefined}
            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive 
                ? 'bg-brand-secondary text-brand-gold shadow-sm' 
                : 'text-gray-400 hover:text-white hover:bg-brand-secondary/50'
            } ${isCollapsed && !mobile ? 'justify-center px-2' : ''}`}
          >
            {item.icon} 
            {(!isCollapsed || mobile) && <span className="truncate">{item.label}</span>}
          </Link>
        )
      })}
    </>
  );

  return (
    <div className="flex min-h-screen font-sans" style={{ background: "#F7F9FC", color: "#172236" }}>
      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col shrink-0 shadow-xl z-20 transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}
        style={{ background: "#07182F", color: "#FFFFFF" }}
      >
        <div className="h-20 flex items-center px-6 overflow-hidden shrink-0 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-gold rounded-lg flex items-center justify-center font-bold text-brand-navy shrink-0 shadow-sm">A</div>
            {!isCollapsed && (
              <div className="whitespace-nowrap transition-opacity duration-300">
                <span className="text-lg font-bold tracking-wide leading-none block">LMX8</span>
                <span className="text-[10px] uppercase tracking-widest text-brand-gold block">Admin</span>
              </div>
            )}
          </Link>
        </div>
        
        <nav className="flex-1 py-6 space-y-1 overflow-y-auto scrollbar-thin">
          <NavLinks />
        </nav>
        
        <div className="p-4 shrink-0 border-t border-white/5 mt-auto space-y-2">
          {/* Modern Sidebar Toggle */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5 shrink-0" /> : <PanelLeftClose className="w-5 h-5 shrink-0" />}
            {!isCollapsed && <span>Collapse Menu</span>}
          </button>

          <button 
            onClick={() => {
              import('@/app/actions/auth').then((m) => m.logoutAction('/login'));
            }}
            title={isCollapsed ? "Logout" : undefined}
            className={`flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-brand-error hover:bg-red-500/10 transition-colors ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <LogOut className="w-5 h-5 shrink-0" /> 
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="h-20 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-6 z-10 sticky top-0 shadow-sm backdrop-blur-sm bg-white/95">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger className="md:hidden hover:bg-brand-light p-2 rounded-md transition-colors">
                <Menu className="w-6 h-6 text-[#0F172A]" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-brand-navy text-white p-0 border-none flex flex-col">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <div className="h-20 flex items-center px-6 shrink-0 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-gold rounded-lg flex items-center justify-center font-bold text-brand-navy shadow-sm">A</div>
                    <div>
                      <span className="text-lg font-bold tracking-wide leading-none block">LMX8</span>
                      <span className="text-[10px] uppercase tracking-widest text-brand-gold block">Admin</span>
                    </div>
                  </div>
                </div>
                <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
                  <NavLinks mobile={true} />
                </nav>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold text-[#0F172A] hidden sm:block">Control Center</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative hover:bg-brand-light rounded-full">
              <Bell className="w-5 h-5 text-[#64748B]" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-error rounded-full border-2 border-white"></span>
            </Button>
            <div className="h-8 w-px bg-[#E2E8F0] mx-2 hidden sm:block"></div>
            {/* Profile Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  const el = document.getElementById('admin-dropdown');
                  if (el) el.classList.toggle('hidden');
                }}
                onBlur={(e) => {
                  // Delay hiding so clicks on menu items can register
                  setTimeout(() => {
                    const el = document.getElementById('admin-dropdown');
                    if (el && !el.contains(document.activeElement)) el.classList.add('hidden');
                  }, 200);
                }}
                className="flex items-center gap-3 cursor-pointer hover:bg-brand-light p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
                aria-expanded="false"
                aria-haspopup="true"
              >
                <div className="hidden sm:block text-right">
                  <span className="text-[#0F172A] font-bold text-sm block leading-none">{adminInfo?.name ?? "Admin"}</span>
                  <span className="text-[#64748B] text-[10px] uppercase tracking-wider block mt-1">{adminInfo?.role ?? "..."}</span>
                </div>
                <div className="w-9 h-9 bg-brand-navy text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                  {adminInfo?.name?.charAt(0) ?? "A"}
                </div>
              </button>
              
              {/* Dropdown Menu */}
              <div id="admin-dropdown" className="hidden absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E2E8F0] z-50 overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F0] bg-gray-50/50">
                  <p className="text-sm font-bold text-[#0F172A] truncate">{adminInfo?.name ?? "Administrator"}</p>
                  <p className="text-xs font-semibold text-brand-gold mt-0.5">CTRL ROOM</p>
                </div>
                <div className="p-1.5">
                  <Link href="/admin/settings" className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-brand-navy rounded-lg transition-colors">
                    Profile / Account
                  </Link>
                </div>
                <div className="p-1.5 border-t border-[#E2E8F0]">
                  <button
                    onClick={() => {
                      import('@/app/actions/auth').then((m) => m.logoutAction('/login'));
                    }}
                    className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-6 md:p-8 overflow-x-auto">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </div>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-[#64748B] border-t border-[#E2E8F0] bg-white">
          <p>© {new Date().getFullYear()} LMX8 IMPORTS. Powered by <span className="font-semibold text-brand-navy">LEXMEDIA.GH</span></p>
        </footer>
      </main>
    </div>
  );
}
