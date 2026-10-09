import { getCurrentCustomerAction } from "@/app/actions";
import { User, Mail, Phone, MapPin, ShieldCheck, CheckCircle2, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { CustomerChangePinCard } from "@/components/customer-change-pin-card";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let customer = null;
  try {
    customer = await getCurrentCustomerAction();
  } catch (error) {
    console.error("[ProfilePage] Failed to fetch customer:", error);
  }

  if (!customer) {
    redirect("/login");
  }

  const initial = (customer.name || customer.id || "C").trim().charAt(0).toUpperCase() || "C";
  const displayName = customer.name && customer.name !== "undefined" && customer.name !== "null"
    ? customer.name.trim()
    : "Valued Customer";
  const customerId = customer.id || customer.customerIdentifier || "LMX8-CUSTOMER";
  const displayEmail = customer.email?.trim() || "Not provided";
  const displayPhone = customer.phone?.trim() || "Not provided";
  const credits = customer.credits ?? 0;

  return (
    <div className="space-y-7 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>My Profile</h1>
        <p className="text-sm mt-1" style={{ color: "#667085" }}>Manage your account details and preferences.</p>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid #E5E7EB" }}>
        {/* Profile Header */}
        <div className="px-6 py-8 flex flex-col md:flex-row items-center gap-6" style={{ borderBottom: "1px solid #F1F5F9" }}>
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black shadow-inner" style={{ background: "#F7F9FC", color: "var(--primary)", border: "4px solid #F1F5F9" }}>
            {initial}
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-xl font-bold" style={{ color: "#172236" }}>{displayName}</h2>
            <p className="text-sm font-medium mt-1" style={{ color: "#667085" }}>Customer ID: <span className="font-bold text-gray-800">{customerId}</span></p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#D1FAE5", color: "#065F46" }}>
                <CheckCircle2 size={14} /> Active Account
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "#FEF9C3", color: "#854D0E" }}>
                <ShieldCheck size={14} /> Verified
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0FDF4] text-[#10B981]">
                <Wallet size={14} /> {credits} Credits
              </span>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 md:p-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#667085" }}>
                <User size={12} /> Full Name
              </label>
              <div className="px-4 h-12 rounded-xl text-sm flex items-center bg-gray-50/50" style={{ border: "1px solid #E5E7EB", color: "#172236" }}>
                {displayName}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#667085" }}>
                <Mail size={12} /> Email Address
              </label>
              <div className="px-4 h-12 rounded-xl text-sm flex items-center bg-gray-50/50" style={{ border: "1px solid #E5E7EB", color: "#172236" }}>
                {displayEmail}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#667085" }}>
                <Phone size={12} /> Phone Number
              </label>
              <div className="px-4 h-12 rounded-xl text-sm flex items-center bg-gray-50/50" style={{ border: "1px solid #E5E7EB", color: "#172236" }}>
                {displayPhone}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "#667085" }}>
                <MapPin size={12} /> Delivery Region
              </label>
              <div className="px-4 h-12 rounded-xl text-sm flex items-center bg-gray-50/50" style={{ border: "1px solid #E5E7EB", color: "#172236" }}>
                Accra, Ghana
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <a 
              href="mailto:support@lmx8.com?subject=Update Profile Request"
              className="px-6 py-2.5 text-sm font-bold rounded-xl transition-all hover:opacity-90 shadow-sm text-white" style={{ background: "var(--accent)" }}
            >
              Contact to Edit Details
            </a>
          </div>
        </div>
      </div>

      {/* Security & PIN Management Section */}
      <CustomerChangePinCard />
    </div>
  );
}
