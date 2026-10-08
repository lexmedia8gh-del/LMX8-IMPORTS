"use client";

import React, { useState } from "react";
import { Settings, Globe, Bell, Database, ShieldCheck, Paintbrush, Users } from "lucide-react";
import AdminSystemSettings from "@/components/admin-system-settings";
import AdminSecuritySettings from "@/components/admin-security-settings";
import AdminBrandingSettings from "@/components/admin-branding-settings";
import AdminCustomerSettings from "@/components/admin-customer-settings";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"system" | "branding" | "customers" | "security">("system");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "branding" || tab === "security" || tab === "system" || tab === "customers") {
        setActiveTab(tab as any);
      }
    }
  }, []);

  return (
    <div className="space-y-7 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#141B47]">Platform Settings</h1>
        <p className="text-sm mt-1 text-[#667085]">Configure LMX8 IMPORTS visual configurations and portal controls.</p>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex border-b border-[#E5E7EB] gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("system")}
          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "system"
              ? "border-[#F2901F] text-[#141B47]"
              : "border-transparent text-[#667085] hover:text-[#141B47]"
          }`}
        >
          <Database size={16} /> System Settings
        </button>
        <button
          onClick={() => setActiveTab("branding")}
          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "branding"
              ? "border-[#F2901F] text-[#141B47]"
              : "border-transparent text-[#667085] hover:text-[#141B47]"
          }`}
        >
          <Paintbrush size={16} /> Branding & Logos
        </button>
        <button
          onClick={() => setActiveTab("customers")}
          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "customers"
              ? "border-[#F2901F] text-[#141B47]"
              : "border-transparent text-[#667085] hover:text-[#141B47]"
          }`}
        >
          <Users size={16} /> Customers
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={`px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "security"
              ? "border-[#F2901F] text-[#141B47]"
              : "border-transparent text-[#667085] hover:text-[#141B47]"
          }`}
        >
          <ShieldCheck size={16} /> Admin Security
        </button>
        <a
          href="/admin/data-management"
          className="px-5 py-3 text-sm font-bold flex items-center gap-2 border-b-2 border-transparent text-[#355DAF] hover:text-[#141B47] transition-colors"
        >
          <Database size={16} /> Data Management &rarr;
        </a>
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "system" && (
          <AdminSystemSettings />
        )}

        {activeTab === "branding" && (
          <div className="space-y-5">
            <AdminBrandingSettings />
          </div>
        )}

        {activeTab === "customers" && (
          <div className="space-y-5">
            <AdminCustomerSettings />
          </div>
        )}

        {activeTab === "security" && (
          <div className="max-w-xl">
            <AdminSecuritySettings />
          </div>
        )}
      </div>
    </div>
  );
}
