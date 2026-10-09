"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, UserPlus, CheckCircle } from "lucide-react";
import { createCustomerAction } from "@/app/actions/customers";

export default function AddCustomerPage() {
  const [error, setError] = useState<string | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<{
    customerIdentifier: string;
    pin: string;
  } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    
    startTransition(async () => {
      const result = await createCustomerAction(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.customerIdentifier && result?.pin) {
        setCreatedCustomer({
          customerIdentifier: result.customerIdentifier,
          pin: result.pin,
        });
      }
    });
  };

  const handleCopyPin = () => {
    if (createdCustomer?.pin) {
      navigator.clipboard.writeText(createdCustomer.pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2500);
    }
  };

  if (createdCustomer) {
    return (
      <div className="max-w-2xl mx-auto space-y-7">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/customers"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#172236] hover:border-[#172236] transition-all"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#172236]">Customer Created Successfully</h1>
            <p className="text-sm text-[#667085] mt-1">Official credentials and Login PIN have been established.</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-[#E5E7EB] space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle size={32} />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-[#172236]">Account Ready &amp; Credentials Generated</h2>
            <p className="text-xs sm:text-sm text-[#667085] max-w-md mx-auto">
              The welcome email containing these credentials and the Login PIN has been queued for delivery.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs uppercase font-bold text-[#64748B]">Customer ID</span>
              <span className="font-mono font-extrabold text-[#141B47] text-base">
                {createdCustomer.customerIdentifier}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-[#64748B] block">Initial Login PIN</span>
                <span className="text-[11px] text-emerald-700 font-medium">Included in customer welcome notice</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-[#F2901F] text-lg bg-[#07182F] px-3.5 py-1.5 rounded-lg tracking-widest">
                  {createdCustomer.pin}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[#172236] cursor-pointer"
                >
                  {copiedPin ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setCreatedCustomer(null);
                setError(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-[#172236] hover:bg-slate-50 cursor-pointer"
            >
              Add Another Customer
            </button>
            <Link
              href="/admin/customers"
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#355DAF] transition-colors cursor-pointer text-center"
            >
              Back to Customers List →
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

          <div className="pt-4 flex flex-col sm:flex-row justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto h-12 px-6 sm:px-8 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 shadow-sm disabled:opacity-50 bg-[#0B1F44] text-white"
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
