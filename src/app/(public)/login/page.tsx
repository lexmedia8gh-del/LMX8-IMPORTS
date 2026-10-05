"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { loginCustomerAction, loginAdminAction } from "@/app/actions/auth";
import { BrandLogo } from "@/components/brand-logo";
import { getBrandSettingsAction } from "@/app/actions/branding";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"customer" | "admin">("customer");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    getBrandSettingsAction().then(setBranding).catch(console.error);
  }, []);

  const handleCustomerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const identifier = formData.get("identifier") as string;
    const pin = formData.get("pin") as string;

    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const redirectParam = params?.get("redirect") || params?.get("callbackUrl") || undefined;

    startTransition(async () => {
      const result = await loginCustomerAction(identifier, pin, redirectParam);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleAdminSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const pin = formData.get("pin") as string;

    startTransition(async () => {
      const result = await loginAdminAction(pin);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const primaryColor = branding?.primaryColor || "#141B47";
  const secondaryColor = branding?.secondaryColor || "#355DAF";
  const accentColor = branding?.accentColor || "#F2901F";
  const tagline = branding?.tagline || "Your Goods. Our Priority.";

  // Darker shade for contrast overlays and inputs
  const darkNavy = "#0C102B";
  const cardNavy = "#1D265A";

  return (
    <div className="min-h-screen flex" style={{ background: darkNavy }}>
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex w-[55%] relative flex-col justify-between p-12 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2127&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}F2 0%, ${primaryColor}BF 60%, ${primaryColor}73 100%)` }} />

        <Link href="/" className="relative z-10 block">
          <BrandLogo
            variant="full-light"
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            customImageUrl={branding?.lightLogoUrl}
            height={44}
          />
        </Link>

        <div className="relative z-10 space-y-5">
          <span className="gold-line" style={{ backgroundColor: accentColor }}></span>
          <h2 style={{ fontFamily: "var(--font-poppins)" }} className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Welcome back!
          </h2>
          <p className="text-base max-w-sm leading-relaxed" style={{ color: "#94A3B8" }}>
            Track your goods and manage your shipping payments.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-sm italic" style={{ color: "#667085" }}>
            From China to Ghana.<br />
            <span style={{ color: accentColor }}>{tagline}</span>
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12" style={{ background: primaryColor }}>
        <div className="absolute top-6 left-6 lg:hidden">
          <Link href="/">
            <BrandLogo
              variant="full-light"
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              accentColor={accentColor}
              customImageUrl={branding?.lightLogoUrl}
              height={36}
            />
          </Link>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="rounded-2xl p-8 transition-all" style={{ background: darkNavy, border: "1px solid rgba(255,255,255,0.08)" }}>
            
            {activeTab === "customer" ? (
              // CUSTOMER VIEW
              <>
                <div className="text-center mb-8 space-y-1">
                  <h2 className="text-2xl font-bold text-white">Customer Portal</h2>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>Enter your details to access your account.</p>
                </div>

                <form className="space-y-5" onSubmit={handleCustomerSubmit}>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Customer ID or Phone Number</label>
                    <input
                      type="text"
                      name="identifier"
                      required
                      placeholder="LMX8-00125 or 024XXXXXXX"
                      className="w-full px-4 h-12 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 transition-all lmx-input"
                      style={{ background: darkNavy, border: "1px solid rgba(255,255,255,0.12)" }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Customer PIN</label>
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        name="pin"
                        required
                        placeholder="• • • • • •"
                        maxLength={6}
                        pattern="\d{6}"
                        title="PIN must be exactly 6 digits"
                        className="w-full px-4 pr-11 h-12 rounded-xl text-center tracking-[0.4em] font-mono text-base text-white placeholder:text-gray-500 focus:outline-none focus:border-yellow-400 transition-all lmx-input"
                        style={{ background: darkNavy, border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer" 
                        style={{ color: "#667085" }}
                      >
                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="mt-4 w-full h-12 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
                    style={{ background: accentColor, color: "#FFFFFF" }}
                  >
                    {isPending ? "Authenticating..." : "SIGN IN"}
                  </button>
                </form>

                <p className="mt-8 text-center text-xs" style={{ color: "#667085" }}>
                  <button onClick={() => { setActiveTab("admin"); setError(null); setShowPin(false); }} className="font-semibold transition-colors hover:text-white cursor-pointer" style={{ color: "#94A3B8" }}>
                    Administrator Login
                  </button>
                </p>
              </>
            ) : (
              // ADMIN VIEW
              <>
                <div className="text-center mb-8 space-y-1">
                  <h2 className="text-2xl font-bold text-white">CTRL ROOM</h2>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>Administrator Access</p>
                </div>

                <form className="space-y-5" onSubmit={handleAdminSubmit}>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-center" style={{ color: "#94A3B8" }}>Admin PIN</label>
                    <div className="relative">
                      <input
                        type={showPin ? "text" : "password"}
                        name="pin"
                        inputMode="numeric"
                        pattern="\d*"
                        autoComplete="off"
                        maxLength={8}
                        required
                        placeholder="• • • • • •"
                        className="w-full px-4 pr-11 h-12 rounded-xl text-center tracking-[0.5em] text-lg font-mono border-none focus:outline-none focus:border-yellow-400 transition-all text-white placeholder:text-gray-500 lmx-input"
                        style={{ background: darkNavy, border: "1px solid rgba(255,255,255,0.12)" }}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 cursor-pointer" 
                        style={{ color: "#667085" }}
                      >
                        {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20 text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="mt-4 w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm disabled:opacity-50 cursor-pointer"
                    style={{ background: accentColor, color: "#FFFFFF" }}
                  >
                    {isPending ? "Authenticating..." : "SIGN IN"}
                  </button>
                </form>

                <p className="mt-8 text-center text-xs">
                  <button onClick={() => { setActiveTab("customer"); setError(null); setShowPin(false); }} className="font-semibold transition-colors hover:text-white cursor-pointer" style={{ color: "#94A3B8" }}>
                    &larr; Back to Customer Login
                  </button>
                </p>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
