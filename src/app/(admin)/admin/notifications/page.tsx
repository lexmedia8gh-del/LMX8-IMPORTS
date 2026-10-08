import { getAdminNotificationsAndAuditAction } from "@/app/actions/notifications";
import { Bell, Truck, CreditCard, Shield, Clock, Info, CheckCircle2, AlertTriangle, Layers, FileText } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const data = await getAdminNotificationsAndAuditAction().catch(() => ({
    notifications: [],
    auditLogs: [],
  }));

  const { notifications, auditLogs } = data;

  const getTypeStyle = (type: string) => {
    switch (type) {
      case "SHIPMENT":
        return { bg: "#DBEAFE", icon: Truck, color: "#1E40AF" };
      case "PAYMENT":
        return { bg: "#D1FAE5", icon: CreditCard, color: "#065F46" };
      case "ACCOUNT":
        return { bg: "#FEF9C3", icon: Shield, color: "#854D0E" };
      default:
        return { bg: "#F1F5F9", icon: Bell, color: "#475569" };
    }
  };

  return (
    <div className="space-y-7 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">System Activity & Notifications</h1>
        <p className="text-sm mt-1 text-[#667085]">
          Live platform communications and administrator audit log from PostgreSQL.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Customer Notification Broadcasts */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB] flex flex-col">
          <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base text-[#172236]">Customer Notifications</h2>
              <p className="text-xs text-[#667085]">Persisted automated and milestone notifications</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-800">
              {notifications.length} Records
            </span>
          </div>

          <div className="divide-y divide-[#F1F5F9] max-h-[520px] overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-16 px-6 text-center text-[#667085] flex flex-col items-center gap-2">
                <Bell size={36} className="opacity-20 text-brand-navy" />
                <p className="font-semibold text-sm text-[#172236]">No customer notifications yet</p>
                <p className="text-xs max-w-xs">
                  Automated notifications triggered by shipment updates and payments will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const style = getTypeStyle(n.type);
                const Icon = style.icon;
                const formattedDate = new Date(n.createdAt).toLocaleDateString("en-GH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors ${
                      !n.read ? "bg-blue-50/20" : ""
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: style.bg }}
                    >
                      <Icon size={18} style={{ color: style.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-[#172236] truncate">{n.title}</h4>
                        <span className="text-[11px] text-[#94A3B8] shrink-0 font-mono">{formattedDate}</span>
                      </div>
                      <p className="text-xs text-[#667085] leading-relaxed mb-1">{n.message}</p>
                      {n.customer && (
                        <p className="text-[11px] font-medium text-brand-navy">
                          Recipient: {n.customer.name} ({n.customer.customerIdentifier})
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Administrator Audit Trail */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB] flex flex-col">
          <div className="px-6 py-5 border-b border-[#F1F5F9] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base text-[#172236]">Administrative Audit Trail</h2>
              <p className="text-xs text-[#667085]">Recorded operational changes and security events</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800">
              {auditLogs.length} Events
            </span>
          </div>

          <div className="divide-y divide-[#F1F5F9] max-h-[520px] overflow-y-auto flex-1">
            {auditLogs.length === 0 ? (
              <div className="py-16 px-6 text-center text-[#667085] flex flex-col items-center gap-2">
                <Shield size={36} className="opacity-20 text-brand-navy" />
                <p className="font-semibold text-sm text-[#172236]">No audit log entries recorded</p>
                <p className="text-xs max-w-xs">
                  Administrative actions such as tracking changes, fee updates, and resets will be logged here.
                </p>
              </div>
            ) : (
              auditLogs.map((log) => {
                const formattedDate = new Date(log.timestamp).toLocaleDateString("en-GH", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={log.id} className="p-4 px-6 hover:bg-gray-50/50 transition-colors space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#172236] px-2 py-0.5 rounded-md bg-gray-100 font-mono">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-[#94A3B8] font-mono">{formattedDate}</span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{log.description}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[#64748B] pt-0.5">
                      <span>By: <strong className="text-[#172236]">{log.adminName}</strong></span>
                      <span>·</span>
                      <span className="font-mono">{log.entityType}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
