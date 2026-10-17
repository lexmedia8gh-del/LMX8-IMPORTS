import { getAllPaymentsAction } from "@/app/actions/admin-payments";
import { AdminPaymentsClient } from "./admin-payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const payments = await getAllPaymentsAction();

  return <AdminPaymentsClient initialPayments={payments as any} />;
}
