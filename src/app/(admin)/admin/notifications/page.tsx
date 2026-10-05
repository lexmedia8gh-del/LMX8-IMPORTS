import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";
import { Bell, Truck, CreditCard, Info } from "lucide-react";

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-7 max-w-4xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">System Notifications</h1>
        <p className="text-sm mt-1 text-[#667085]">Platform-wide activity and alerts.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        <div className="px-6 py-5 border-b border-[#F1F5F9]">
          <h2 className="font-semibold text-base text-[#172236]">Recent Activity</h2>
        </div>
        <div className="divide-y divide-[#F1F5F9]">
          {MOCK_NOTIFICATIONS.map((n, i) => {
            const Icon = n.type === "Shipment" ? Truck : n.type === "Invoice" ? CreditCard : Bell;
            const colors: Record<string, { bg: string; icon: string }> = {
              Shipment: { bg: "#DBEAFE", icon: "#1E40AF" },
              Invoice:  { bg: "#D1FAE5", icon: "#065F46" },
              default:  { bg: "#F1F5F9", icon: "#475569" },
            };
            const c = colors[n.type] || colors.default;
            return (
              <div key={n.id} className={`flex items-start gap-4 px-6 py-5 hover:bg-gray-50/50 transition-colors ${!n.read ? "bg-blue-50/20" : ""}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: c.bg }}>
                  <Icon size={18} style={{ color: c.icon }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-sm text-[#172236]">{n.type} Update</h4>
                    <span className="text-[11px] text-[#94A3B8] shrink-0">{n.date}</span>
                  </div>
                  <p className="text-sm text-[#667085] leading-relaxed">{n.message}</p>
                </div>
                {!n.read && <div className="w-2.5 h-2.5 rounded-full bg-[#FFB800] shrink-0 mt-1.5" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
