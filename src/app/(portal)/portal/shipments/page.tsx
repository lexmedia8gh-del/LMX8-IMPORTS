"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getShipmentsAction } from "@/app/actions";
import { ShipmentStatusBadge } from "@/components/shipment-status";
import { ArrowRight, PackageX, Search } from "lucide-react";
import { Shipment } from "@/lib/db";
import { useBrandSettings } from "@/components/brand-provider";

export default function ShipmentsPage() {
  const [myShipments, setMyShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const brandContext = useBrandSettings();
  const branding = brandContext?.branding;
  const accentColor = branding?.accentColor || "var(--accent)";

  useEffect(() => {
    getShipmentsAction()
      .then((all) => {
        setMyShipments(all);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  const filtered = myShipments.filter(
    (s) =>
      s.id.toLowerCase().includes(query.toLowerCase()) ||
      s.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "#172236" }}>
            My Shipments
          </h1>
          <p className="text-sm mt-1" style={{ color: "#667085" }}>
            Track and manage all your imported goods.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder="Search by ID or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl text-sm border focus:outline-none transition-colors bg-white shadow-sm"
            style={{ borderColor: "#E5E7EB", color: "#172236" }}
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 flex flex-col items-center gap-3" style={{ border: "1px solid #E5E7EB" }}>
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accentColor} transparent ${accentColor} ${accentColor}` }} />
          <p className="text-sm text-[#667085]">Loading shipments…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl py-16 flex flex-col items-center text-center" style={{ border: "1px solid #E5E7EB" }}>
          <PackageX size={48} className="mb-4 text-gray-200" />
          <p className="font-bold text-lg" style={{ color: "#172236" }}>
            {myShipments.length === 0 ? "No shipments yet." : "No results found."}
          </p>
          <p className="text-sm mt-1 mb-6" style={{ color: "#667085" }}>
            {myShipments.length === 0
              ? "Start your first shipment with LMX8 Imports."
              : "Try a different search term."}
          </p>
          {myShipments.length === 0 && (
            <Link href="/portal/sourcing">
              <button
                className="px-6 py-2.5 text-sm font-bold rounded-xl transition-all hover:opacity-90 shadow-sm cursor-pointer text-white"
                style={{ background: accentColor }}
              >
                Request Sourcing
              </button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => (
              <Link key={s.id} href={`/portal/shipments/${s.id}`}>
                <div
                  className="bg-white rounded-2xl p-4 shadow-sm active:opacity-80 transition-opacity"
                  style={{ border: "1px solid #E5E7EB" }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "#172236" }}>
                        {s.id}
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#667085" }}>
                        {s.description}
                      </p>
                    </div>
                    <ShipmentStatusBadge status={s.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: "#94A3B8" }}>
                    <span>Registered: {s.registeredDate}</span>
                    <span className="flex items-center gap-1 font-semibold" style={{ color: accentColor }}>
                      Track <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div
            className="hidden md:block bg-white rounded-2xl overflow-hidden shadow-sm"
            style={{ border: "1px solid #E5E7EB" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "#F7F9FC", borderBottom: "1px solid #E5E7EB" }}>
                    {["Shipment ID", "Description", "Date", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: "#667085" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-sm" style={{ color: "#172236" }}>
                          {s.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <span className="text-sm line-clamp-2" style={{ color: "#667085" }}>
                          {s.description}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm whitespace-nowrap" style={{ color: "#667085" }}>
                          {s.registeredDate}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ShipmentStatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/portal/shipments/${s.id}`}>
                          <button
                            className="inline-flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            style={{ color: "var(--primary)" }}
                          >
                            <ArrowRight size={16} />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
