import { Settings, Globe, Bell, Database } from "lucide-react";
import AdminSecuritySettings from "@/components/admin-security-settings";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Platform Settings</h1>
        <p className="text-sm mt-1 text-[#667085]">Configure LMX8 IMPORTS platform settings.</p>
      </div>

      <div className="space-y-5">
        {[
          {
            icon: <Globe size={20} className="text-[#3B82F6]" />,
            title: "General Settings",
            desc: "Business name, address, contact, and operating information.",
            fields: [
              { label: "Business Name", value: "LMX8 IMPORTS" },
              { label: "Country", value: "Ghana" },
              { label: "Support Email", value: "[Configure in production]" },
            ]
          },
          {
            icon: <Bell size={20} className="text-[#FFB800]" />,
            title: "Notification Settings",
            desc: "Configure when and how customers receive notifications.",
            fields: [
              { label: "Shipment Updates", value: "Enabled" },
              { label: "Payment Alerts", value: "Enabled" },
              { label: "Sourcing Updates", value: "Enabled" },
            ]
          },
          {
            icon: <Database size={20} className="text-[#10B981]" />,
            title: "Storage & Backend",
            desc: "Current data layer status and connection info.",
            fields: [
              { label: "Database", value: "Supabase PostgreSQL" },
              { label: "Image Storage", value: "Supabase Private Storage" },
              { label: "Payments", value: "Paystack (Configured)" },
            ]
          },
        ].map(section => (
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
              {section.fields.map(f => (
                <div key={f.label} className="flex items-start justify-between gap-4">
                  <label className="text-xs font-semibold text-[#667085] w-40 shrink-0">{f.label}</label>
                  <p className="text-sm font-medium text-[#172236] text-right">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Security — Change Admin PIN */}
        <AdminSecuritySettings />
      </div>
    </div>
  );
}
