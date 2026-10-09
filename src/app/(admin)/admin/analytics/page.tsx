import { AdminCustomerAnalytics } from "@/components/admin-customer-analytics";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer Analytics | LMX8 CTRL ROOM",
  description: "Monitor customer logins, page views, and activity across the customer portal.",
};

export default async function AdminAnalyticsPage() {
  await requireAdminSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AdminCustomerAnalytics />
    </div>
  );
}
