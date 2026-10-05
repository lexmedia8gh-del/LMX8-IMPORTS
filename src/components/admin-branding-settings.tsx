"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Paintbrush, Image as ImageIcon, FileText, CheckCircle, AlertCircle, RefreshCw, Upload, Trash2, Eye } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  getBrandSettingsAction,
  updateBrandIdentityAction,
  initiateBrandingAssetUploadAction,
  confirmBrandingAssetUploadAction,
  removeBrandingAssetAction,
} from "@/app/actions/branding";

interface BrandSettingsState {
  businessName: string;
  shortName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  mainLogoUrl: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
  brandMarkUrl: string | null;
  faviconUrl: string | null;
  invoiceLogoUrl: string | null;
  invoiceFooterLogoUrl: string | null;
  invoiceStampUrl: string | null;
}

export default function AdminBrandingSettings() {
  const [activeSubTab, setActiveSubTab] = useState<"identity" | "logos" | "invoice" | "preview">("identity");
  const [settings, setSettings] = useState<BrandSettingsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, startTransition] = useTransition();

  // Status states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File uploading states
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Local form inputs
  const [formIdentity, setFormIdentity] = useState({
    businessName: "",
    shortName: "",
    tagline: "",
    primaryColor: "",
    secondaryColor: "",
    accentColor: "",
  });

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getBrandSettingsAction();
      setSettings(data);
      setFormIdentity({
        businessName: data.businessName,
        shortName: data.shortName,
        tagline: data.tagline,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
      });
    } catch (e) {
      console.error("[Branding UI] Failed to load brand settings:", e);
      setErrorMsg("Failed to load branding configurations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    startTransition(async () => {
      const result = await updateBrandIdentityAction(formIdentity);
      if (result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg("Brand identity and colors updated successfully!");
        await loadSettings();
        // Dispatches global style reload if CSS variables are dynamically injected
        window.dispatchEvent(new Event("lmx8-branding-updated"));
      }
    });
  };

  const handleFileUpload = async (
    assetType: "mainLogo" | "lightLogo" | "darkLogo" | "brandMark" | "favicon" | "invoiceLogo" | "invoiceFooterLogo" | "invoiceStamp",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSuccessMsg(null);
    setErrorMsg(null);
    setUploadingAsset(assetType);
    setUploadProgress(0);

    try {
      // 1. Get signed upload URL
      const initResult = await initiateBrandingAssetUploadAction(assetType, file.name, file.type, file.size);
      if ("error" in initResult && initResult.error) {
        setErrorMsg(initResult.error);
        setUploadingAsset(null);
        return;
      }

      if (!initResult.signedUrl || !initResult.token || !initResult.objectPath) {
        setErrorMsg("Failed to authorize direct storage upload.");
        setUploadingAsset(null);
        return;
      }

      // 2. Perform direct PUT upload to Supabase storage
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", initResult.signedUrl);
        xhr.setRequestHeader("Authorization", `Bearer ${initResult.token}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage server responded with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network connection failure during upload."));
        xhr.send(file);
      });

      // 3. Confirm upload metadata with database
      const confirmResult = await confirmBrandingAssetUploadAction(assetType, initResult.objectPath);
      if (confirmResult.error) {
        setErrorMsg(confirmResult.error);
      } else {
        setSuccessMsg(`Branding asset '${assetType}' uploaded and set successfully!`);
        await loadSettings();
        window.dispatchEvent(new Event("lmx8-branding-updated"));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploadingAsset(null);
      setUploadProgress(0);
      // Reset input element
      if (e.target) e.target.value = "";
    }
  };

  const handleResetAsset = async (
    assetType: "mainLogo" | "lightLogo" | "darkLogo" | "brandMark" | "favicon" | "invoiceLogo" | "invoiceFooterLogo" | "invoiceStamp"
  ) => {
    if (!confirm(`Are you sure you want to reset '${assetType}' to its default vector fallback?`)) return;
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const result = await removeBrandingAssetAction(assetType);
      if (result && "error" in result && result.error) {
        setErrorMsg(result.error);
      } else {
        setSuccessMsg(`Branding asset '${assetType}' has been reset.`);
        await loadSettings();
        window.dispatchEvent(new Event("lmx8-branding-updated"));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Reset failed.");
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-[#E5E7EB] flex flex-col items-center justify-center gap-4">
        <RefreshCw className="animate-spin text-[#141B47]" size={32} />
        <p className="text-sm font-semibold text-[#172236]">Loading branding settings...</p>
      </div>
    );
  }

  const subTabs = [
    { id: "identity", label: "Brand Identity", icon: <Paintbrush size={16} /> },
    { id: "logos", label: "Logo Management", icon: <ImageIcon size={16} /> },
    { id: "invoice", label: "Invoice Branding", icon: <FileText size={16} /> },
    { id: "preview", label: "Brand Preview", icon: <Eye size={16} /> },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-sm">
      {/* Subtab Header */}
      <div className="flex border-b border-[#F1F5F9] bg-[#F7F9FC] overflow-x-auto scrollbar-none">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSubTab(tab.id);
              setSuccessMsg(null);
              setErrorMsg(null);
            }}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-b-2 focus:outline-none ${
              activeSubTab === tab.id
                ? "border-[#F2901F] text-[#141B47] bg-white"
                : "border-transparent text-[#667085] hover:text-[#141B47] hover:bg-gray-50"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 md:p-8">
        {/* Status Notifications */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl text-sm font-semibold bg-green-50 text-green-700 border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ── SUBTAB: BRAND IDENTITY & COLORS ── */}
        {activeSubTab === "identity" && (
          <form onSubmit={handleSaveIdentity} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Business Name *</label>
                <input
                  type="text"
                  required
                  value={formIdentity.businessName}
                  onChange={(e) => setFormIdentity({ ...formIdentity, businessName: e.target.value })}
                  placeholder="e.g. LMX8 IMPORTS"
                  className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-[#F2901F] bg-white border-[#E5E7EB] text-[#172236]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Short Name *</label>
                <input
                  type="text"
                  required
                  value={formIdentity.shortName}
                  onChange={(e) => setFormIdentity({ ...formIdentity, shortName: e.target.value })}
                  placeholder="e.g. LMX8"
                  className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-[#F2901F] bg-white border-[#E5E7EB] text-[#172236]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Tagline / Slogan</label>
              <input
                type="text"
                value={formIdentity.tagline}
                onChange={(e) => setFormIdentity({ ...formIdentity, tagline: e.target.value })}
                placeholder="e.g. Your Goods. Our Priority."
                className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-[#F2901F] bg-white border-[#E5E7EB] text-[#172236]"
              />
            </div>

            <div className="pt-4 border-t border-[#F1F5F9] space-y-4">
              <h4 className="text-sm font-bold text-[#141B47]">Official Brand Palette</h4>
              <p className="text-xs text-[#667085] leading-relaxed">
                Update the official primary, secondary, and accent colors. These determine the primary navigation, active tracking milestones, and buttons across the system.
              </p>

              <div className="grid sm:grid-cols-3 gap-6">
                {/* Primary Navy */}
                <div className="bg-[#F7F9FC] p-4 rounded-xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141B47]">Primary Color</span>
                    <div className="w-5 h-5 rounded border shadow-sm" style={{ backgroundColor: formIdentity.primaryColor }} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formIdentity.primaryColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, primaryColor: e.target.value.toUpperCase() })}
                      className="w-10 h-10 border-0 rounded cursor-pointer shrink-0 bg-transparent"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={formIdentity.primaryColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, primaryColor: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono text-sm border bg-white rounded-lg"
                    />
                  </div>
                </div>

                {/* Secondary Blue */}
                <div className="bg-[#F7F9FC] p-4 rounded-xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141B47]">Secondary Color</span>
                    <div className="w-5 h-5 rounded border shadow-sm" style={{ backgroundColor: formIdentity.secondaryColor }} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formIdentity.secondaryColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, secondaryColor: e.target.value.toUpperCase() })}
                      className="w-10 h-10 border-0 rounded cursor-pointer shrink-0 bg-transparent"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={formIdentity.secondaryColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, secondaryColor: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono text-sm border bg-white rounded-lg"
                    />
                  </div>
                </div>

                {/* Brand Accent / Orange */}
                <div className="bg-[#F7F9FC] p-4 rounded-xl border border-[#E5E7EB] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141B47]">Accent Color</span>
                    <div className="w-5 h-5 rounded border shadow-sm" style={{ backgroundColor: formIdentity.accentColor }} />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formIdentity.accentColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, accentColor: e.target.value.toUpperCase() })}
                      className="w-10 h-10 border-0 rounded cursor-pointer shrink-0 bg-transparent"
                    />
                    <input
                      type="text"
                      maxLength={7}
                      value={formIdentity.accentColor}
                      onChange={(e) => setFormIdentity({ ...formIdentity, accentColor: e.target.value.toUpperCase() })}
                      className="w-full text-center font-mono text-sm border bg-white rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#F1F5F9] flex justify-end">
              <button
                type="submit"
                disabled={updating}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: formIdentity.primaryColor }}
              >
                {updating ? "Saving Changes..." : "Save Brand Settings"}
              </button>
            </div>
          </form>
        )}

        {/* ── SUBTAB: LOGO MANAGEMENT ── */}
        {activeSubTab === "logos" && settings && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#141B47]">Logo Management Settings</h4>
              <p className="text-xs text-[#667085]">
                Replace default responsive SVG vectors with custom branding files (PNG, JPG, WebP, SVG, ICO).
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  id: "mainLogo",
                  title: "Main Logo",
                  desc: "Primary color logo with dark text. Best for standard light backgrounds.",
                  variant: "full-dark" as const,
                  url: settings.mainLogoUrl,
                },
                {
                  id: "lightLogo",
                  title: "Light Logo (Dark Backgrounds)",
                  desc: "Primary color logo with white text. Renders on dark headers or sidebars.",
                  variant: "full-light" as const,
                  url: settings.lightLogoUrl,
                  darkBg: true,
                },
                {
                  id: "darkLogo",
                  title: "Dark Logo (Monochrome)",
                  desc: "Alternative monochrome layout for clean document representation.",
                  variant: "full-dark" as const,
                  url: settings.darkLogoUrl,
                },
                {
                  id: "brandMark",
                  title: "Brand Mark (Symbol)",
                  desc: "Icon representation of the arrow and orbit globe, used as compact avatar.",
                  variant: "symbol" as const,
                  url: settings.brandMarkUrl,
                },
              ].map((logo) => (
                <div key={logo.id} className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-[#E5E7EB] bg-[#F1F5F9]">
                    <h5 className="font-bold text-xs text-[#141B47] uppercase tracking-wide">{logo.title}</h5>
                  </div>
                  
                  {/* Preview Container */}
                  <div
                    className={`flex-1 p-6 flex items-center justify-center min-h-[140px] relative ${
                      logo.darkBg ? "bg-[#141B47]" : "bg-white"
                    }`}
                  >
                    {uploadingAsset === logo.id ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="animate-spin text-[#F2901F]" size={24} />
                        <span className="text-xs font-semibold text-[#141B47]">Uploading ({uploadProgress}%)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <BrandLogo
                          variant={logo.variant}
                          primaryColor={formIdentity.primaryColor}
                          secondaryColor={formIdentity.secondaryColor}
                          accentColor={formIdentity.accentColor}
                          customImageUrl={logo.url}
                          height={50}
                        />
                        {!logo.url && (
                          <span className="text-[10px] mt-2 font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-[#355DAF] border border-blue-100">
                            Vector Fallback Active
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#667085] max-w-[60%] leading-tight">{logo.desc}</p>
                    <div className="flex items-center gap-2">
                      <label className="p-2 cursor-pointer rounded-lg bg-gray-50 border border-gray-200 text-[#141B47] hover:bg-gray-100 transition-colors" title="Upload New File">
                        <Upload size={14} />
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(logo.id as any, e)}
                          disabled={!!uploadingAsset}
                        />
                      </label>
                      {logo.url && (
                        <button
                          onClick={() => handleResetAsset(logo.id as any)}
                          disabled={!!uploadingAsset}
                          className="p-2 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors"
                          title="Reset to Default Fallback"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBTAB: INVOICE BRANDING ── */}
        {activeSubTab === "invoice" && settings && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#141B47]">Invoice Branding & Configuration</h4>
              <p className="text-xs text-[#667085]">
                Configure the branding assets and stamps printed on newly generated customer shipping invoices and transaction records.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  id: "invoiceLogo",
                  title: "Invoice Primary Logo",
                  desc: "Full logo printed in the header of invoices. Falls back to Main Logo if unset.",
                  variant: "full-dark" as const,
                  url: settings.invoiceLogoUrl,
                },
                {
                  id: "invoiceStamp",
                  title: "Official Stamp / Seal",
                  desc: "Optional circular seal or authorization stamp printed on finalized records.",
                  variant: "symbol" as const,
                  url: settings.invoiceStampUrl,
                },
              ].map((logo) => (
                <div key={logo.id} className="bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB] overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-[#E5E7EB] bg-[#F1F5F9]">
                    <h5 className="font-bold text-xs text-[#141B47] uppercase tracking-wide">{logo.title}</h5>
                  </div>
                  
                  {/* Preview */}
                  <div className="flex-1 p-6 flex items-center justify-center min-h-[140px] bg-white relative">
                    {uploadingAsset === logo.id ? (
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="animate-spin text-[#F2901F]" size={24} />
                        <span className="text-xs font-semibold text-[#141B47]">Uploading ({uploadProgress}%)</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        {logo.id === "invoiceStamp" ? (
                          logo.url ? (
                            <img src={logo.url} alt="Official Stamp" className="h-20 w-20 object-contain" />
                          ) : (
                            <div className="h-16 w-16 rounded-full border-4 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 font-bold">
                              No Stamp
                            </div>
                          )
                        ) : (
                          <BrandLogo
                            variant={logo.variant}
                            primaryColor={formIdentity.primaryColor}
                            secondaryColor={formIdentity.secondaryColor}
                            accentColor={formIdentity.accentColor}
                            customImageUrl={logo.url || settings.mainLogoUrl}
                            height={50}
                          />
                        )}
                        {!logo.url && (
                          <span className="text-[10px] mt-2 font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-[#355DAF] border border-blue-100">
                            {logo.id === "invoiceStamp" ? "Optional (Omitted)" : "Fallback Active"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-white border-t border-[#E5E7EB] flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#667085] max-w-[60%] leading-tight">{logo.desc}</p>
                    <div className="flex items-center gap-2">
                      <label className="p-2 cursor-pointer rounded-lg bg-gray-50 border border-gray-200 text-[#141B47] hover:bg-gray-100 transition-colors" title="Upload New File">
                        <Upload size={14} />
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.gif,.svg"
                          className="hidden"
                          onChange={(e) => handleFileUpload(logo.id as any, e)}
                          disabled={!!uploadingAsset}
                        />
                      </label>
                      {logo.url && (
                        <button
                          onClick={() => handleResetAsset(logo.id as any)}
                          disabled={!!uploadingAsset}
                          className="p-2 rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-colors"
                          title="Reset / Omit"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SUBTAB: LIVE BRAND PREVIEW ── */}
        {activeSubTab === "preview" && (
          <div className="space-y-8">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#141B47]">Live Brand Preview</h4>
              <p className="text-xs text-[#667085]">
                See how your configured logo, brand name, and custom colors will render across active system modules.
              </p>
            </div>

            {/* Simulated UI Areas */}
            <div className="space-y-6">
              {/* UI Area 1: Client Portal Header */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#667085]">Simulated Portal Header / Sidebar</span>
                <div
                  className="rounded-xl p-4 flex items-center justify-between shadow-sm transition-all border"
                  style={{ backgroundColor: formIdentity.primaryColor, borderColor: formIdentity.primaryColor }}
                >
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      variant="full-light"
                      primaryColor={formIdentity.primaryColor}
                      secondaryColor={formIdentity.secondaryColor}
                      accentColor={formIdentity.accentColor}
                      customImageUrl={settings?.lightLogoUrl}
                      height={32}
                    />
                    <div className="hidden sm:block border-l border-white/10 pl-3">
                      <span className="text-xs text-white/50 block font-semibold leading-none">{formIdentity.businessName}</span>
                      <span className="text-[10px] text-white/80 block uppercase tracking-widest mt-1 font-bold">Portal</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">JD</div>
                  </div>
                </div>
              </div>

              {/* UI Area 2: Buttons and Interactions */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#667085]">Button Systems Hierarchy</span>
                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-6 flex flex-wrap gap-4 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#667085] block">Primary Button</span>
                    <button
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg transition-all hover:opacity-90"
                      style={{ backgroundColor: formIdentity.primaryColor }}
                    >
                      Process Cargo
                    </button>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#667085] block">Secondary Button</span>
                    <button
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg transition-all hover:opacity-90"
                      style={{ backgroundColor: formIdentity.secondaryColor }}
                    >
                      Track Shipment
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#667085] block">CTA / Action Button</span>
                    <button
                      className="px-4 py-2 text-xs font-bold text-[#07182F] rounded-lg transition-all hover:opacity-90"
                      style={{ backgroundColor: formIdentity.accentColor }}
                    >
                      Pay Shipping Fee
                    </button>
                  </div>
                </div>
              </div>

              {/* UI Area 3: Invoice Document Simulation */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#667085]">Simulated Shipping Invoice Header</span>
                <div className="border border-[#E5E7EB] rounded-xl bg-white p-6 shadow-sm space-y-4 max-w-xl">
                  <div className="flex items-start justify-between border-b border-[#F1F5F9] pb-4">
                    <div className="space-y-2">
                      <BrandLogo
                        variant="full-dark"
                        primaryColor={formIdentity.primaryColor}
                        secondaryColor={formIdentity.secondaryColor}
                        accentColor={formIdentity.accentColor}
                        customImageUrl={settings?.invoiceLogoUrl || settings?.mainLogoUrl}
                        height={40}
                      />
                      <p className="text-[10px] text-[#667085] leading-relaxed">
                        {formIdentity.tagline}
                      </p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-sm font-black uppercase tracking-wider" style={{ color: formIdentity.primaryColor }}>INVOICE</h4>
                      <p className="text-xs font-mono font-bold text-gray-500 mt-1">#INV-2026-081</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-[#172236]">Billed To:</p>
                      <p className="text-[#667085]">John Doe (LMX8-00125)</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#172236]">Total Due:</p>
                      <p className="font-black text-sm" style={{ color: formIdentity.primaryColor }}>GHS 2,450.00</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export { AdminBrandingSettings };
