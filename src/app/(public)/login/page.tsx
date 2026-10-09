"use client";

import Link from "next/link";
import { User, Lock, Eye, EyeOff, AlertCircle, Loader2, Shield } from "lucide-react";
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

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "admin" || params.get("role") === "admin") {
        setActiveTab("admin");
      }
    }
  }, []);

  const handleCustomerSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const identifier = (formData.get("identifier") as string)?.trim();
    const pin = (formData.get("pin") as string)?.trim();

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
    const pin = (formData.get("pin") as string)?.trim();

    startTransition(async () => {
      const result = await loginAdminAction(pin);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const primaryColor = branding?.primaryColor || "#101B49";
  const accentColor = branding?.accentColor || "#FF9418";
  const businessName = branding?.businessName || "LMX8 IMPORTS";

  return (
    <div
      className="min-h-[calc(100vh-78px)] w-full flex flex-col lg:flex-row"
      style={{
        background: `linear-gradient(135deg, ${primaryColor} 0%, #0C1335 60%, #080D24 100%)`,
      }}
    >
      {/* ── LEFT WELCOME PANEL (DESKTOP) ── */}
      <section
        aria-label="Welcome Information"
        className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-20 py-16 relative border-r border-white/[0.04]"
      >
        <div className="max-w-lg space-y-6">
          {/* Official Brand Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="inline-block transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101B49] focus-visible:ring-[#FF9418] rounded-lg"
            >
              <BrandLogo
                variant="light"
                height={48}
                alt={`${businessName} Logo`}
                className="max-h-12 w-auto"
              />
            </Link>
          </div>

          {/* Orange accent line */}
          <div
            className="w-12 h-1 rounded-full"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />

          {/* Heading */}
          <h1
            className="text-4xl xl:text-5xl font-bold text-white tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Welcome back!
          </h1>

          {/* Supporting text */}
          <p className="text-base xl:text-lg text-[#94A3B8] leading-relaxed">
            Access your account to track your shipments, manage your orders and stay updated.
          </p>
        </div>
      </section>

      {/* ── MOBILE / TABLET WELCOME BANNER (< 1024px) ── */}
      <section
        aria-label="Welcome Information"
        className="lg:hidden w-full px-6 pt-10 pb-4 flex flex-col items-center text-center space-y-4"
      >
        <Link
          href="/"
          className="inline-block transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101B49] focus-visible:ring-[#FF9418] rounded-lg"
        >
          <BrandLogo
            variant="light"
            height={40}
            alt={`${businessName} Logo`}
            className="max-h-10 w-auto"
          />
        </Link>

        <div
          className="w-10 h-1 rounded-full mx-auto"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />

        <div className="space-y-2 max-w-md">
          <h1
            className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Welcome back!
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Access your account to track your shipments, manage your orders and stay updated.
          </p>
        </div>
      </section>

      {/* ── RIGHT LOGIN PANEL ── */}
      <section
        aria-label="Login Form"
        className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 xl:p-16 w-full"
      >
        <div className="w-full max-w-md">
          <div
            className="rounded-2xl p-6 sm:p-9 md:p-10 transition-all shadow-2xl shadow-black/50"
            style={{
              background: "#131D45",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {activeTab === "customer" ? (
              /* ── CUSTOMER LOGIN VIEW ── */
              <div>
                <div className="text-center mb-7 space-y-1.5">
                  <h2
                    className="text-2xl font-bold text-white tracking-tight"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Customer Portal
                  </h2>
                  <p className="text-sm text-[#94A3B8]">
                    Enter your details to access your account.
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleCustomerSubmit} noValidate={false}>
                  {/* Field 1: Customer ID or Phone Number */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="customer-identifier"
                      className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider"
                    >
                      Customer ID or Phone Number
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-[#667085] pointer-events-none" aria-hidden="true">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        id="customer-identifier"
                        type="text"
                        name="identifier"
                        required
                        autoComplete="username"
                        placeholder="e.g. LMX8-00125 or 024XXXXXXX"
                        className="w-full pl-10 pr-4 h-12 rounded-xl text-sm text-white placeholder:text-[#667085] transition-all focus:outline-none focus:ring-2"
                        style={{
                          background: "#0C122D",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Field 2: Customer PIN */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="customer-pin"
                      className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider"
                    >
                      Customer PIN
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-[#667085] pointer-events-none" aria-hidden="true">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="customer-pin"
                        type={showPin ? "text" : "password"}
                        name="pin"
                        required
                        maxLength={8}
                        inputMode="numeric"
                        autoComplete="current-password"
                        placeholder="• • • • • •"
                        className="w-full pl-10 pr-11 h-12 rounded-xl text-sm font-mono tracking-widest text-white placeholder:text-[#667085] transition-all focus:outline-none focus:ring-2"
                        style={{
                          background: "#0C122D",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        aria-label={showPin ? "Hide Customer PIN" : "Show Customer PIN"}
                        className="absolute right-3 p-1.5 text-[#667085] hover:text-[#94A3B8] focus:outline-none focus:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl text-sm bg-red-500/10 text-red-300 border border-red-500/25 flex items-start gap-2.5 text-left"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{error}</span>
                    </div>
                  )}

                  {/* Primary Button */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-12 rounded-xl text-sm font-bold tracking-wider uppercase text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
                    style={{ background: accentColor }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      "SIGN IN"
                    )}
                  </button>
                </form>

                {/* Secondary link: Administrator Login */}
                <div className="mt-7 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("admin");
                      setError(null);
                      setShowPin(false);
                    }}
                    className="text-xs font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer focus:outline-none focus:underline"
                  >
                    Administrator Login
                  </button>
                </div>
              </div>
            ) : (
              /* ── ADMINISTRATOR LOGIN VIEW ── */
              <div>
                <div className="text-center mb-7 space-y-1.5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 text-[#FF9418] mb-1">
                    <Shield className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <h2
                    className="text-2xl font-bold text-white tracking-tight"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    CTRL ROOM
                  </h2>
                  <p className="text-sm text-[#94A3B8]">
                    Administrator Access
                  </p>
                </div>

                <form className="space-y-5" onSubmit={handleAdminSubmit} noValidate={false}>
                  {/* Admin PIN */}
                  <div className="space-y-1.5 text-left">
                    <label
                      htmlFor="admin-pin"
                      className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-center"
                    >
                      Admin PIN
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-[#667085] pointer-events-none" aria-hidden="true">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        id="admin-pin"
                        type={showPin ? "text" : "password"}
                        name="pin"
                        required
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={8}
                        autoComplete="current-password"
                        placeholder="• • • • • •"
                        className="w-full pl-10 pr-11 h-12 rounded-xl text-center font-mono tracking-[0.4em] text-base text-white placeholder:text-[#667085] transition-all focus:outline-none focus:ring-2"
                        style={{
                          background: "#0C122D",
                          border: "1px solid rgba(255, 255, 255, 0.12)",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        aria-label={showPin ? "Hide Admin PIN" : "Show Admin PIN"}
                        className="absolute right-3 p-1.5 text-[#667085] hover:text-[#94A3B8] focus:outline-none focus:text-white rounded-lg transition-colors cursor-pointer"
                      >
                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl text-sm bg-red-500/10 text-red-300 border border-red-500/25 flex items-start gap-2.5 text-left"
                    >
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full h-12 rounded-xl text-sm font-bold tracking-wider uppercase text-white transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
                    style={{ background: accentColor }}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      "SIGN IN"
                    )}
                  </button>
                </form>

                {/* Back Link */}
                <div className="mt-7 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("customer");
                      setError(null);
                      setShowPin(false);
                    }}
                    className="text-xs font-semibold text-[#94A3B8] hover:text-white transition-colors cursor-pointer focus:outline-none focus:underline"
                  >
                    &larr; Back to Customer Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
