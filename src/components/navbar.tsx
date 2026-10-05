"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Search } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sourcing", label: "Sourcing" },
  { href: "/track", label: "Track Shipment" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [branding, setBranding] = useState<any>(null);

  const loadBranding = () => {
    import("@/app/actions/branding").then((m) => {
      m.getBrandSettingsAction().then(setBranding).catch(console.error);
    });
  };

  useEffect(() => {
    loadBranding();
    window.addEventListener("lmx8-branding-updated", loadBranding);
    return () => window.removeEventListener("lmx8-branding-updated", loadBranding);
  }, []);

  const primaryBg = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";

  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: primaryBg, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="max-w-7xl mx-auto flex h-[78px] items-center justify-between px-6 lg:px-10">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <BrandLogo variant="light" height={36} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium transition-colors duration-200 hover:text-white"
              style={{ color: "#94A3B8" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/track">
            <button
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 hover:bg-white/5 cursor-pointer"
              style={{ color: accentColor, borderColor: `${accentColor}50` }}
            >
              <Search className="w-4 h-4" /> Track Shipment
            </button>
          </Link>
          <Link href="/login">
            <button
              className="px-5 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] cursor-pointer"
              style={{ background: accentColor, color: "#FFFFFF" }}
            >
              Customer Login
            </button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 rounded-lg transition-colors text-white hover:bg-white/10 cursor-pointer"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t px-6 py-5 space-y-1" style={{ background: primaryBg, borderColor: "rgba(255,255,255,0.07)" }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-medium border-b last:border-0 transition-colors hover:text-white"
              style={{ color: "#94A3B8", borderColor: "rgba(255,255,255,0.06)" }}
            >
              {item.label}
            </Link>
          ))}
          <div className="flex flex-col gap-3 pt-4">
            <Link href="/track" onClick={() => setOpen(false)}>
              <button className="w-full py-3 text-sm font-semibold rounded-lg border cursor-pointer" style={{ color: accentColor, borderColor: `${accentColor}50` }}>
                Track Shipment
              </button>
            </Link>
            <Link href="/login" onClick={() => setOpen(false)}>
              <button className="w-full py-3 text-sm font-bold rounded-lg cursor-pointer" style={{ background: accentColor, color: "#FFFFFF" }}>
                Customer Login
              </button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
