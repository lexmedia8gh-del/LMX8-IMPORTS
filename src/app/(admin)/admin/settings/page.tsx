"use client";

import React, { useState } from "react";
import { Settings, Globe, Bell, Database, ShieldCheck, Paintbrush } from "lucide-react";
import AdminSecuritySettings from "@/components/admin-security-settings";
import AdminBrandingSettings from "@/components/admin-branding-settings";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"system" | "branding" | "security">("system");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "branding" || tab === "security" || tab === "system") {
        setActiveTab(tab);
      }
    }
  }, []);

  const systemSections = [
    {
      icon: <Globe size={20} className="text-[#3B82F6]" />,
      title: "General Settings",
      desc: "Business name, country, and operational contact coordinates.",
      fields: [
        { label: "Business Name", value: "LMX8 IMPORTS" },
        { label: "Country", value: "Ghana" },
        { label: "Support Email", value: "support@lmx8.com" },
      ]
    },
    {
      icon: <Bell size={20} className="text-[#FFB800]" />,
      title: "Notification Settings",
      desc: "Configure standard system trigger communications.",
      fields: [
        { label: "Shipment Updates", value: "Enabled" },
        { label: "Payment Alerts", value: "Enabled" },
        { label: "Sourcing Updates", value: "Enabled" },
      ]
    },
    {
      icon: <Database size={20} className="text-[#10B981]" />,
      title: "Storage & Backend",
      desc: "Platform datastore status and credentials profile.",
      fields: [
        { label: "Database", value: "Supabase PostgreSQL" },
        { label: "Image Storage", value: "Supabase Private Storage" },
        { label: "Payments", value: "Paystack (Active)" },
      ]
    },
  ];

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
          <div className="space-y-5 max-w-3xl">
            {systemSections.map((section) => (
              <div key={section.title} className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#F7F9FC] flex items-center justify-center border border-[#E5E7EB]">
                    {section.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#172236]">{section.title}</h3>
                    <p className="text-xs text-[#667085]">{section.desc}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {section.fields.map((f) => (
                    <div key={f.label} className="flex items-start justify-between gap-4">
                      <label className="text-xs font-semibold text-[#667085] w-40 shrink-0">{f.label}</label>
                      <p className="text-sm font-medium text-[#172236] text-right">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "branding" && (
          <div className="space-y-5">
            <AdminBrandingSettings />
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
