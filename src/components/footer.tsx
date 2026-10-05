import Link from "next/link";
import { Globe } from "lucide-react";

export function Footer() {
  return (
    <footer style={{ background: "#07182F", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg shrink-0" style={{ background: "#FFB800", color: "#07182F", fontFamily: "var(--font-poppins)" }}>L</div>
              <div>
                <div className="font-bold text-white text-lg tracking-wider leading-none" style={{ fontFamily: "var(--font-poppins)" }}>LMX<span style={{ color: "#FFB800" }}>8</span></div>
                <div className="text-[10px] tracking-[0.2em] uppercase mt-0.5" style={{ color: "#94A3B8" }}>Imports</div>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
              From China to Ghana.<br />
              <span style={{ color: "#FFB800" }}>Your Goods. Our Priority.</span>
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
          <p>© {new Date().getFullYear()} LMX8 IMPORTS. All rights reserved.</p>
          <p>Quality Products. Global Sourcing. Delivered to You.</p>
        </div>
      </div>
    </footer>
  );
}
