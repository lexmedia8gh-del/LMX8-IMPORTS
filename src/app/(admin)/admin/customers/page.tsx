import AdminCustomerSettings from "@/components/admin-customer-settings";

export default function AdminCustomersPage() {
  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Customer Accounts</h1>
        <p className="text-sm mt-1 text-[#667085]">View and manage registered customers.</p>
      </div>

      <AdminCustomerSettings />
    </div>
  );
}
