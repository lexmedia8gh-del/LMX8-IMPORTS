import { AnalyticsHub } from "@/components/analytics/analytics-hub";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Business Intelligence, Live Reports & EOD | LMX8 CTRL ROOM",
  description:
    "Monitor live financial revenue, end-of-day reconciliation, cargo shipment milestones, and operational disbursements.",
};

export default async function AdminAnalyticsPage() {
  await requireAdminSession();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <AnalyticsHub />
    </div>
  );
}
