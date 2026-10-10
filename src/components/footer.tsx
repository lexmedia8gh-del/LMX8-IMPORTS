"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";

const CONTACT_URL = "https://lexmedia-nfc.vercel.app/";

export function Footer() {
  const pathname = usePathname();
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  const primaryBg = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const businessName = branding?.businessName || "LMX8 IMPORTS";
  const tagline = branding?.tagline || "Your Goods. Our Priority.";

  const isLoginPage = pathname === "/login" || pathname === "/admin-login";
  const isTrackingPage = pathname === "/track" || pathname.startsWith("/track/");

  // Dedicated minimal footer for tracking and login pages without duplicate logo or public clutter
  if (isLoginPage || isTrackingPage) {
    return (
      <footer
        className="w-full py-5 px-6 border-t text-center"
        style={{
          background: primaryBg,
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <p>
            &copy; {new Date().getFullYear()} <strong className="text-white font-semibold">{businessName}</strong>. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
            <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Support Desk</a>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer style={{ background: primaryBg, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <BrandLogo variant="light" height={32} />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
              From China to Ghana.<br />
              <span style={{ color: accentColor }}>{tagline}</span>
            </p>
            <div className="flex items-center gap-2 text-xs" style={{ color: "#667085" }}>
              <Globe className="w-3.5 h-3.5" />
              Powered by <span className="font-semibold text-white/60">LEXMEDIA.GH</span>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Services</h4>
            <ul className="space-y-2.5">
              {["Product Sourcing", "Warehouse Handling", "International Shipping", "Shipment Tracking"].map(s => (
                <li key={s}><Link href="/sourcing" className="text-sm hover:text-white transition-colors" style={{ color: "#94A3B8" }}>{s}</Link></li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2.5">
              <li><Link href="/how-it-works" className="text-sm hover:text-white transition-colors" style={{ color: "#94A3B8" }}>How It Works</Link></li>
              <li>
                <a
                  href={CONTACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-white transition-colors"
                  style={{ color: "#94A3B8" }}
                >
                  Contact Us
                </a>
              </li>
              <li><Link href="/terms" className="text-sm hover:text-white transition-colors" style={{ color: "#94A3B8" }}>Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-sm hover:text-white transition-colors" style={{ color: "#94A3B8" }}>Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Help &amp; Support</h4>
            <ul className="space-y-2.5 text-sm" style={{ color: "#94A3B8" }}>
              <li>
                <a
                  href={CONTACT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 text-xs font-semibold text-white hover:bg-white/5 transition-colors"
                >
                  Open Support Hub &rarr;
                </a>
              </li>
              <li className="text-xs text-[#667085]">Official support &amp; inquiries via LexMedia</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "#667085" }}>
          <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          <p>Quality Products. Global Sourcing. Delivered to You.</p>
        </div>
      </div>
    </footer>
  );
}
