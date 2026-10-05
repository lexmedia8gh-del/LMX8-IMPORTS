"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, CheckCircle } from "lucide-react";
import { createCustomerAction } from "@/app/actions/customers";

export default function AddCustomerPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const result = await createCustomerAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        // Redirection happens in action on success, but if not:
        setSuccess(true);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <div className="flex items-center gap-4">
        <Link href="/admin/customers" className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#172236] hover:border-[#172236] transition-all">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#172236]">Create Customer</h1>
          <p className="text-sm text-[#667085] mt-1">Add a new customer to the platform.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Customer ID</label>
            <input
              type="text"
              disabled
              placeholder="[ AUTO-GENERATED ON CREATION ]"
              className="w-full px-4 h-11 rounded-xl text-sm border bg-[#F7F9FC] border-[#E5E7EB] text-[#94A3B8] font-mono tracking-wide"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Full Name *</label>
              <input
                type="text"
                name="name"
                required
                className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236]"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                required
                className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Email (Optional)</label>
            <input
              type="email"
              name="email"
              className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236]"
            />
          </div>

          <div className="pt-4 border-t border-[#F1F5F9] grid md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Customer PIN *</label>
              <input
                type="password"
                name="pin"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="new-password"
                maxLength={8}
                required
                placeholder="6-8 digits"
                className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236] font-mono tracking-widest text-center"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Confirm PIN *</label>
              <input
                type="password"
                name="confirmPin"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="new-password"
                maxLength={8}
                required
                placeholder="6-8 digits"
                className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236] font-mono tracking-widest text-center"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">Account Status</label>
            <select
              name="status"
              className="w-full px-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white border-[#E5E7EB] text-[#172236] cursor-pointer"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="h-12 px-8 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm disabled:opacity-50 bg-[#0B1F44] text-white"
            >
              <UserPlus size={18} />
              {isPending ? "Creating..." : "CREATE CUSTOMER"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
