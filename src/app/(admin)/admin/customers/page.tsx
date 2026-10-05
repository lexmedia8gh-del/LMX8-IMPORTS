import { getAdminCustomersAction } from "@/app/actions/customers";
import { Search, User, Mail, Phone, CheckCircle2, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import ClientCustomersSearch from "./client-customers-search";

export default async function AdminCustomersPage() {
  const customers = await getAdminCustomersAction();

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Customer Accounts</h1>
          <p className="text-sm mt-1 text-[#667085]">View and manage all registered customers.</p>
        </div>
        <div className="flex items-center gap-3 w-full max-w-sm">
          <Link href="/admin/customers/add" className="shrink-0 flex items-center justify-center gap-2 h-11 px-4 rounded-xl text-sm font-bold shadow-sm transition-all hover:opacity-90 bg-[#FFB800] text-[#07182F]">
            <Plus size={16} /> <span className="hidden sm:inline">Add Customer</span>
          </Link>
        </div>
      </div>

      <ClientCustomersSearch customers={customers} />
    </div>
  );
}
