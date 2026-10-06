"use client";
import Link from "next/link";
import { Globe } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useBrandSettings } from "@/components/brand-provider";

export function Footer() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  const primaryBg = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const businessName = branding?.businessName || "LMX8 IMPORTS";
  const tagline = branding?.tagline || "Your Goods. Our Priority.";

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
              {[
                { label: "How It Works", href: "/how-it-works" },
                { label: "Contact Us", href: "/contact" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Privacy Policy", href: "/privacy" },
              ].map(item => (
                <li key={item.href}><Link href={item.href} className="text-sm hover:text-white transition-colors" style={{ color: "#94A3B8" }}>{item.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-2.5 text-sm" style={{ color: "#94A3B8" }}>
              <li>[Support Email Placeholder]</li>
              <li>[WhatsApp Placeholder]</li>
              <li>[Ghana Office Placeholder]</li>
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
