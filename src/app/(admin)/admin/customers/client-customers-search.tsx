"use client";

import { useState } from "react";
import { Search, User, Mail, Phone, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ClientCustomersSearch({ customers }: { customers: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="relative w-full max-w-sm">
        <input
          type="text"
          placeholder="Search by name, ID, phone or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 bg-white shadow-sm border-[#E5E7EB] text-[#172236]"
        />
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-2xl border border-[#E5E7EB] text-center">
            <User size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="font-bold text-lg text-[#172236]">No customers found</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-black text-xl text-[#122B4F] bg-[#F7F9FC] border border-[#E5E7EB] shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-[#172236] leading-tight line-clamp-1">{c.name}</p>
                    <p className="text-xs text-[#667085] mt-0.5">{c.id}</p>
                  </div>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.status === 'ACTIVE' ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEE2E2] text-[#991B1B]'}`}>
                  <CheckCircle2 size={12} /> {c.status}
                </span>
              </div>

              <div className="space-y-2.5 pb-5 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-2 text-sm text-[#667085]">
                  <Phone size={14} className="shrink-0 text-[#94A3B8]" /> {c.phone}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#667085]">
                  <Mail size={14} className="shrink-0 text-[#94A3B8]" /> <span className="truncate">{c.email}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-auto">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] mb-0.5">Sourcing Credits</p>
                <p className="font-bold text-[#172236]">{c.credits}</p>
              </div>
              <Link href={`/admin/shipments?customer=${c.id}`}>
                <button className="flex items-center gap-1.5 text-xs font-bold text-[#0B1F44] hover:text-[#FFB800] transition-colors">
                  View Shipments <ArrowRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
