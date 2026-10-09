"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Search, MessageSquare } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";

const CONTACT_URL = "https://lexmedia-nfc.vercel.app/";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/sourcing", label: "Sourcing" },
  { href: "/track", label: "Track Shipment" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  const primaryBg = branding?.primaryColor || "#141B47";
  const accentColor = branding?.accentColor || "#F2901F";
  const isLoginPage = pathname === "/login" || pathname === "/admin-login";

  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: primaryBg, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="max-w-7xl mx-auto flex h-[78px] items-center justify-between px-4 sm:px-6 lg:px-10">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <BrandLogo variant="light" height={36} />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-7">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors duration-200 hover:text-white ${
                pathname === item.href ? "text-white font-semibold" : "text-[#94A3B8]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          {/* Contact Us button */}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact Us"
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 hover:bg-white/5 cursor-pointer text-[#E2E8F0] hover:text-white border-white/20 hover:border-white/40"
          >
            <MessageSquare className="w-3.5 h-3.5" style={{ color: accentColor }} />
            <span>Contact Us</span>
          </a>

          <Link href="/track">
            <button
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 hover:bg-white/5 cursor-pointer"
              style={{ color: accentColor, borderColor: `${accentColor}50` }}
            >
              <Search className="w-4 h-4" /> Track Shipment
            </button>
          </Link>

          {!isLoginPage && (
            <Link href="/login">
              <button
                className="px-5 py-2 text-sm font-bold rounded-lg transition-all duration-200 hover:opacity-90 hover:scale-[1.02] cursor-pointer text-white"
                style={{ background: accentColor }}
              >
                Customer Login
              </button>
            </Link>
          )}
        </div>

        {/* Mobile header controls */}
        <div className="flex md:hidden items-center gap-2">
          {/* Compact visible Contact Us button for mobile header */}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact Us"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-white/15 text-[#E2E8F0] hover:text-white hover:border-white/40 transition-colors"
          >
            <MessageSquare className="w-3 h-3" style={{ color: accentColor }} />
            <span>Contact</span>
          </a>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            className="p-2 rounded-lg transition-colors text-white hover:bg-white/10 cursor-pointer"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
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
          <div className="flex flex-col gap-2.5 pt-4">
            {/* Contact Us button in mobile menu */}
            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="w-full py-2.5 text-sm font-semibold rounded-lg border border-white/20 text-white flex items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
              <span>Contact Us</span>
            </a>

            <Link href="/track" onClick={() => setOpen(false)}>
              <button
                className="w-full py-2.5 text-sm font-semibold rounded-lg border cursor-pointer flex items-center justify-center gap-2"
                style={{ color: accentColor, borderColor: `${accentColor}50` }}
              >
                <Search className="w-4 h-4" />
                <span>Track Shipment</span>
              </button>
            </Link>

            {!isLoginPage && (
              <Link href="/login" onClick={() => setOpen(false)}>
                <button
                  className="w-full py-2.5 text-sm font-bold rounded-lg cursor-pointer text-white"
                  style={{ background: accentColor }}
                >
                  Customer Login
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
