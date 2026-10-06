import { DashboardStatCard } from "@/components/dashboard-stat-card";
import { Users, Truck, Search, CreditCard, Box, MoreHorizontal, ChevronRight, PackageX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShipmentStatusBadge } from "@/components/shipment-status";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getShipmentsAction, getCustomersAction } from "@/app/actions";
import { getAllPaymentsAction } from "@/app/actions/admin-payments";
import { getAllSourcingRequestsAction } from "@/app/actions/sourcing-credits";
import { formatCurrency } from "@/lib/mock-data";

export default async function AdminDashboard() {
  const [shipments, customers, payments, sourcingRequests] = await Promise.all([
    getShipmentsAction(),
    getCustomersAction(),
    getAllPaymentsAction().catch(() => []),
    getAllSourcingRequestsAction().catch(() => [])
  ]);

  const pendingInvoices = payments.filter((p: any) => p.status === "PENDING" || p.status === "FAILED");
  const pendingAmount = pendingInvoices.reduce((acc: number, inv: any) => acc + inv.amount, 0);
  
  const activeShipments = shipments.filter(s => s.status !== "DELIVERED" && s.status !== "ON_HOLD");
  const inTransit = shipments.filter(s => s.status === "IN_TRANSIT").length;
  
  const pendingSourcing = sourcingRequests.filter((r: any) => r.status === "PENDING" || r.status === "Awaiting Review").length;

  return (
    <div className="space-y-8 page-fade">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pb-4 border-b border-[#E2E8F0]">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight" style={{ color: "#0B1F44" }}>Control Center</h2>
          <p className="font-medium" style={{ color: "#667085" }}>Logistics Overview</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Link href="/admin/shipments" className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-secondary font-semibold shadow-sm transition-colors">
            Manage Shipments
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard title="Total Customers" value={customers.length} icon={<Users className="h-5 w-5" />} trend="neutral" />
        <DashboardStatCard title="Active Shipments" value={activeShipments.length} icon={<Box className="h-5 w-5" />} trend="neutral" />
        <DashboardStatCard title="In Transit" value={inTransit} icon={<Truck className="h-5 w-5" />} trend="neutral" />
        <DashboardStatCard title="Pending Payments" value={formatCurrency(pendingAmount)} icon={<CreditCard className="h-5 w-5" />} trend={pendingAmount > 0 ? "down" : "neutral"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-[#E2E8F0] pb-4 rounded-t-xl">
            <div>
              <CardTitle className="text-lg" style={{ color: "#0B1F44" }}>Recent Shipments</CardTitle>
              <CardDescription>Latest logistics updates</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#E2E8F0]">
              {shipments.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center" style={{ color: "#667085" }}>
                  <PackageX className="w-10 h-10 mb-3 opacity-20" />
                  <p className="font-medium" style={{ color: "#0B1F44" }}>No shipments found</p>
                </div>
              ) : (
                shipments.slice(0, 5).map(shipment => (
                  <Link href={`/admin/shipments/${shipment.id}`} key={shipment.id} className="flex justify-between items-center p-4 hover:bg-[#F8FAFC] transition-colors group cursor-pointer">
                    <div className="space-y-1">
                      <p className="font-semibold transition-colors group-hover:text-brand-navy" style={{ color: "#0B1F44" }}>{shipment.id}</p>
                      <p className="text-xs font-medium" style={{ color: "#667085" }}>{shipment.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <ShipmentStatusBadge status={shipment.status} adminMode />
                      <ChevronRight className="w-4 h-4 transition-colors hidden sm:block" style={{ color: "#94A3B8" }} />
                    </div>
                  </Link>
                ))
              )}
            </div>
            {shipments.length > 0 && (
              <div className="p-3 border-t border-[#E2E8F0] bg-white rounded-b-xl text-center">
                <Link href="/admin/shipments" className="w-full inline-block font-semibold hover:underline" style={{ color: "#0B1F44" }}>View All</Link>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="border-[#E2E8F0] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-[#E2E8F0] pb-4 rounded-t-xl">
            <div>
              <CardTitle className="text-lg" style={{ color: "#0B1F44" }}>Action Required</CardTitle>
              <CardDescription>Sourcing requests awaiting review</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[#E2E8F0]">
              {sourcingRequests.filter((r: any) => r.status === "PENDING" || r.status === "Awaiting Review").slice(0, 5).map((req: any) => (
                <div key={req.id} className="flex justify-between items-center p-4 hover:bg-[#F8FAFC] transition-colors group">
                  <div className="space-y-1">
                    <p className="font-semibold" style={{ color: "#0B1F44" }}>{req.productDetails}</p>
                    <p className="text-xs font-medium" style={{ color: "#667085" }}>Qty: {req.quantity}</p>
                  </div>
                  <Link href="/admin/sourcing" className="px-3 py-1.5 text-xs rounded-lg font-bold shadow-sm transition-colors bg-[#F1F5F9] text-[#0B1F44] hover:bg-[#E2E8F0]">
                    Review
                  </Link>
                </div>
              ))}
              {pendingSourcing === 0 && (
                <div className="flex flex-col items-center justify-center p-6 sm:p-10 text-center" style={{ color: "#667085" }}>
                  <Search className="w-10 h-10 mb-3 opacity-20" />
                  <p className="font-medium" style={{ color: "#0B1F44" }}>All caught up!</p>
                  <p className="text-sm mt-1">No pending sourcing requests.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
