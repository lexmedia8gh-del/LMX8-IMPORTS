import { AdminCustomerAnalytics } from "@/components/admin-customer-analytics";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live Analytics & Revenue | LMX8 CTRL ROOM",
  description: "Monitor live customer metrics, financial revenue, shipment milestones, and portal activity.",
};

export default async function AdminAnalyticsPage() {
  await requireAdminSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AdminCustomerAnalytics />
    </div>
  );
}
