"use client";

import Link from "next/link";
import { ArrowRight, Search, Truck, PackageSearch, ShieldCheck, Box, Globe, Clock, CheckCircle, Plane, Ship } from "lucide-react";
import { useBrandSettings } from "@/components/brand-provider";

export default function Home() {
  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;

  const primaryColor = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const businessName = branding?.businessName || "LMX8 IMPORTS";

  return (
    <div className="flex flex-col w-full overflow-hidden">

      {/* ═══════════════════════════════ HERO ═══════════════════════════════ */}
      <section className="relative min-h-[90vh] flex flex-col justify-between overflow-hidden" style={{ background: primaryColor }}>
        {/* Cinematic container ship background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/hero_container_ship_1791241771807.jpg')",
          }}
        />
        {/* Directional overlay */}
        <div className="hero-overlay absolute inset-0" style={{
          background: `linear-gradient(105deg, ${primaryColor}FA 0%, ${primaryColor}E0 40%, ${primaryColor}8C 65%, ${primaryColor}1A 100%)`
        }} />

        {/* Hero content container */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 pt-10 sm:pt-16 lg:pt-24 pb-8 lg:pb-28">
          <div className="max-w-2xl space-y-5 sm:space-y-7">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <span className="gold-line shrink-0" style={{ backgroundColor: accentColor }}></span>
              <span className="text-xs sm:text-sm font-semibold tracking-widest uppercase truncate" style={{ color: accentColor }}>
                Your Trusted Import &amp; Shipping Partner
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontFamily: "var(--font-poppins)", lineHeight: 1.12 }} className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              <span className="text-white block">Import Smarter.</span>
              <span className="block" style={{ color: accentColor }}>Ship Further.</span>
            </h1>

            {/* Sub */}
            <p className="text-sm sm:text-base md:text-lg leading-relaxed max-w-lg" style={{ color: "#94A3B8" }}>
              Get your goods from China to Ghana with ease. Track your shipments, pay shipping fees, and request products with {businessName}.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1 sm:pt-2 w-full sm:w-auto">
              <Link href="/track" className="w-full sm:w-auto">
                <button
                  className="w-full sm:w-auto h-12 px-7 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 hover:scale-[1.01] shadow-lg cursor-pointer text-white"
                  style={{ background: accentColor }}
                >
                  <Search className="w-4 h-4" /> Track My Goods
                </button>
              </Link>
              <Link href="/portal/sourcing" className="w-full sm:w-auto">
                <button
                  className="w-full sm:w-auto h-12 px-7 text-sm font-semibold rounded-xl border flex items-center justify-center gap-2 transition-all duration-200 hover:bg-white/5 cursor-pointer text-white"
                  style={{ borderColor: "rgba(255,255,255,0.25)" }}
                >
                  Request Product Sourcing <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            {/* 2x2 Mobile / 4-Col Desktop Feature Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-5 sm:pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { icon: <Truck className="w-4 h-4 sm:w-5 sm:h-5" />, title: "China to Ghana", sub: "Reliable import services" },
                { icon: <Box className="w-4 h-4 sm:w-5 sm:h-5" />, title: "Track Shipments", sub: "Real-time updates" },
                { icon: <PackageSearch className="w-4 h-4 sm:w-5 sm:h-5" />, title: "Sourcing", sub: "Get products from China" },
                { icon: <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />, title: "Secure Payments", sub: "Powered by Paystack" },
              ].map((f) => (
                <div
                  key={f.title}
                  className="min-w-0 p-2.5 sm:p-3.5 rounded-xl flex items-start gap-2.5 transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="mt-0.5 shrink-0" style={{ color: accentColor }}>{f.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-white truncate sm:whitespace-normal">{f.title}</p>
                    <p className="text-[11px] sm:text-xs mt-0.5 leading-tight break-words" style={{ color: "#94A3B8" }}>{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive tracking bar (flow on mobile, anchored on desktop) */}
        <div
          className="relative lg:absolute lg:bottom-0 left-0 right-0 border-t border-white/10 shadow-xl z-20 mt-4 lg:mt-0"
          style={{ background: `${primaryColor}FA`, backdropFilter: "blur(12px)" }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-5 flex flex-col md:flex-row items-stretch md:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${accentColor}1F` }}>
                <Search className="w-5 h-5" style={{ color: accentColor }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Track Your Shipment</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>Enter your shipment number or tracking ID.</p>
              </div>
            </div>
            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Enter Container / Shipment Number"
                className="flex-1 w-full px-4 h-12 text-sm rounded-xl border text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 transition-colors"
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.15)" }}
              />
              <Link href="/track" className="w-full sm:w-auto">
                <button
                  className="w-full sm:w-auto px-6 h-12 text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity cursor-pointer text-white shrink-0"
                  style={{ background: accentColor }}
                >
                  Track <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>
            <p className="hidden lg:block text-xs text-right max-w-[160px]" style={{ color: "#94A3B8" }}>
              From warehouse to Ghana, stay informed every step of the way.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ AIR FREIGHT ═══════════════════════ */}
      <section className="py-12 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="space-y-5 sm:space-y-7">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider border"
                style={{ background: `${accentColor}12`, color: accentColor, borderColor: `${accentColor}40` }}
              >
                <Plane className="w-4 h-4" /> Air Freight Option
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-2" style={{ color: primaryColor }}>New Update</p>
                <h2 style={{ fontFamily: "var(--font-poppins)", lineHeight: 1.1 }} className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  <span style={{ color: primaryColor }}>7-Day</span><br />
                  <span style={{ color: accentColor }}>Shipping Option</span>
                </h2>
              </div>
              <span className="gold-line" style={{ backgroundColor: accentColor }}></span>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#667085" }}>
                For those who can&apos;t wait for the usual <strong style={{ color: "#172236" }}>2-month timeframe</strong>, we offer{" "}
                <strong style={{ color: "#172236" }}>air shipping</strong> for selected small products so you can receive packages much sooner!
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                {[
                  { icon: <Plane className="w-4 h-4" />, label: "Method", value: "Air Freight" },
                  { icon: <Clock className="w-4 h-4" />, label: "Transit", value: "7 Days" },
                  { icon: <Truck className="w-4 h-4" />, label: "Delivery", value: "10–14 Days" },
                  { icon: <Box className="w-4 h-4" />, label: "For", value: "Small Items" },
                ].map((s) => (
                  <div key={s.label} className="text-center p-2.5 sm:p-3 rounded-xl hover:shadow-sm transition-shadow bg-[#F7F9FC] border border-[#E5E7EB]">
                    <div className="mx-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-1.5 text-white" style={{ background: primaryColor }}>{s.icon}</div>
                    <p className="text-[10px] sm:text-[11px]" style={{ color: "#667085" }}>{s.label}</p>
                    <p className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: "#172236" }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border" style={{ background: `${accentColor}0D`, borderColor: `${accentColor}33` }}>
                <Plane className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
                <p className="text-xs sm:text-sm" style={{ color: "#667085" }}>If you need items faster and can&apos;t wait for the regular shipping period, <strong style={{ color: "#172236" }}>this option is for you!</strong></p>
              </div>
              <p className="text-lg sm:text-xl font-bold italic" style={{ color: primaryColor }}>Shop Smarter. <span style={{ color: accentColor }}>Get It Faster.</span></p>
            </div>
            <div className="relative rounded-2xl overflow-hidden h-[280px] sm:h-[380px] lg:h-[460px] shadow-2xl">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/air_freight_cargo_1791241781252.jpg')" }} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${primaryColor}33, ${primaryColor}80)` }} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ SEA FREIGHT ════════════════════════ */}
      <section className="py-12 sm:py-20 lg:py-24 bg-[#F7F9FC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="relative rounded-2xl overflow-hidden h-[280px] sm:h-[380px] lg:h-[460px] shadow-2xl order-2 md:order-1">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/sea_freight_terminal_1791241790980.jpg')" }} />
              <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${primaryColor}80, ${primaryColor}26)` }} />
              <div className="absolute top-4 right-4 sm:top-5 sm:right-5 bg-white/90 backdrop-blur-sm rounded-xl p-3 sm:p-4 shadow-xl text-right">
                <p className="text-[11px] sm:text-xs italic" style={{ color: "#667085" }}>Your Goods. Across Oceans. To You.</p>
                <p className="text-sm sm:text-base font-bold italic mt-0.5" style={{ color: accentColor }}>Plan Ahead. Save More.</p>
              </div>
            </div>
            <div className="space-y-5 sm:space-y-7 order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider border" style={{ background: `${secondaryColor}14`, color: secondaryColor, borderColor: `${secondaryColor}26` }}>
                <Ship className="w-4 h-4" /> Sea Shipping
              </div>
              <div>
                <h2 style={{ fontFamily: "var(--font-poppins)", lineHeight: 1.1 }} className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  <span style={{ color: primaryColor }}>Reliable &amp;</span><br />
                  <span style={{ color: accentColor }}>Cost-Effective</span><br />
                  <span className="text-2xl sm:text-3xl md:text-4xl" style={{ color: primaryColor }}>Worldwide Shipping</span>
                </h2>
              </div>
              <span className="gold-line" style={{ backgroundColor: accentColor }}></span>
              <p className="text-sm sm:text-base leading-relaxed" style={{ color: "#667085" }}>
                Our sea shipping option is the perfect choice for <strong style={{ color: "#172236" }}>large and bulk orders</strong>, giving you the best value for your money.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {[
                  { icon: <Ship className="w-4 h-4" />, label: "Method", value: "Sea Freight" },
                  { icon: <Clock className="w-4 h-4" />, label: "Transit", value: "~2 Months" },
                  { icon: <Box className="w-4 h-4" />, label: "Best For", value: "Bulk Orders" },
                  { icon: <Globe className="w-4 h-4" />, label: "Available", value: "All Products" },
                  { icon: <ShieldCheck className="w-4 h-4" />, label: "Delivery", value: "Safe & Secure" },
                ].map((s) => (
                  <div key={s.label} className="text-center p-2.5 sm:p-3 rounded-xl bg-white hover:shadow-sm transition-shadow border border-[#E5E7EB]">
                    <div className="mx-auto w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center mb-1.5 text-white" style={{ background: accentColor }}>{s.icon}</div>
                    <p className="text-[10px] sm:text-[11px]" style={{ color: "#667085" }}>{s.label}</p>
                    <p className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: "#172236" }}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 sm:gap-5 text-xs sm:text-sm font-medium" style={{ color: "#667085" }}>
                {["Lower Shipping Costs", "Safe & Reliable", "Global Coverage", "Perfect for Bulk"].map(b => (
                  <span key={b} className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4" style={{ color: accentColor }} />{b}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ PROCESS ════════════════════════════ */}
      <section className="py-12 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="text-center mb-10 sm:mb-16 space-y-2 sm:space-y-3">
            <span className="text-xs sm:text-sm font-bold tracking-widest uppercase" style={{ color: accentColor }}>How It Works</span>
            <h2 style={{ fontFamily: "var(--font-poppins)", color: "#172236" }} className="text-2xl sm:text-3xl md:text-4xl font-bold">Your Import Journey in 4 Steps</h2>
            <p className="text-xs sm:text-base max-w-xl mx-auto" style={{ color: "#667085" }}>From product sourcing in China to your door in Ghana.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { n: "01", icon: <PackageSearch className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Submit Your Request", desc: "Send product images, quantities, colors and specs." },
              { n: "02", icon: <Globe className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Receive Sourcing Info", desc: "Our team reviews and provides a detailed quotation." },
              { n: "03", icon: <Ship className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Ship to Ghana", desc: "Choose air (7 days) or sea (~2 months) freight." },
              { n: "04", icon: <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />, title: "Track & Collect", desc: "Monitor in real-time and collect from our office." },
            ].map((item) => (
              <div key={item.n} className="group relative p-5 sm:p-6 rounded-2xl text-center space-y-3 sm:space-y-4 hover:shadow-lg transition-all duration-300 bg-white border border-[#E5E7EB]">
                <span className="absolute top-3 right-3 sm:top-4 sm:right-4 text-4xl sm:text-5xl font-black leading-none opacity-5 group-hover:opacity-10 transition-opacity" style={{ color: primaryColor }}>{item.n}</span>
                <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white transition-all duration-300 group-hover:scale-110" style={{ background: primaryColor }}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-sm sm:text-base" style={{ color: "#172236" }}>{item.title}</h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "#667085" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════ FINAL CTA ══════════════════════════ */}
      <section className="relative py-12 sm:py-20 lg:py-24 overflow-hidden" style={{ background: primaryColor }}>
        <div className="absolute inset-0 bg-cover bg-center opacity-15" style={{ backgroundImage: "url('/images/logistics_warehouse_1791241802667.jpg')" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 text-center space-y-8 sm:space-y-10">
          <span className="text-xs sm:text-sm font-bold tracking-widest uppercase" style={{ color: accentColor }}>More Than Just Shipping</span>
          <h2 style={{ fontFamily: "var(--font-poppins)" }} className="text-3xl sm:text-4xl md:text-5xl font-bold text-white max-w-2xl mx-auto leading-tight">
            We Bring Your<br /><span style={{ color: accentColor }}>World Closer.</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto text-left">
            {[
              { icon: <Box className="w-5 h-5" />, title: "Personal Imports", desc: "Track and pay for your goods" },
              { icon: <PackageSearch className="w-5 h-5" />, title: "Product Sourcing", desc: "Get what you need from China" },
              { icon: <ShieldCheck className="w-5 h-5" />, title: "Secure Payments", desc: "Powered by Paystack" },
              { icon: <Globe className="w-5 h-5" />, title: "Dedicated Support", desc: "We're always here to help" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl hover:bg-white/5 transition-colors bg-white/4 border border-white/8">
                <div style={{ color: accentColor }}>{f.icon}</div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: "#667085" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/portal" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto h-12 px-8 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:scale-[1.01] shadow-lg cursor-pointer text-white" style={{ background: accentColor }}>
                Access Customer Portal <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto h-12 px-8 text-sm font-semibold rounded-xl border flex items-center justify-center transition-all hover:bg-white/5 cursor-pointer text-white border-white/25">
                Contact Us
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
