"use client";

import { useEffect, useState, useCallback } from "react";
import { getShipmentsAction, getCustomersAction, getBatchesAction } from "@/app/actions";
import { Shipment, Batch } from "@/lib/db";
import { ShipmentStatusBadge, STATUS_ORDER, ShipmentStatus, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";
import { getBatchCustomerLabel } from "@/lib/batch-status";
import { Search, Plus, Truck, Filter, Layers } from "lucide-react";
import { CreateShipmentDrawer } from "@/components/drawers/create-shipment-drawer";
import Link from "next/link";

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [customers, setCustomers] = useState<{id: string, name: string, phone?: string, email?: string}[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterBatch, setFilterBatch] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, custData, batchData] = await Promise.all([
        getShipmentsAction(),
        getCustomersAction(),
        getBatchesAction().catch(() => [] as Batch[])
      ]);
      setShipments(data);
      setCustomers(custData);
      setBatches(batchData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = shipments.filter(s => {
    const matchesSearch = s.id.toLowerCase().includes(search.toLowerCase()) || 
                          s.description.toLowerCase().includes(search.toLowerCase()) ||
                          s.customerId.toLowerCase().includes(search.toLowerCase()) ||
                          (s.batch && s.batch.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === "All" || s.status === filterStatus;
    const matchesBatch = filterBatch === "All" || s.batch === filterBatch || (!s.batch && filterBatch === "Unassigned");
    return matchesSearch && matchesStatus && matchesBatch;
  });

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#141B47]">Shipment Manager</h1>
          <p className="text-sm mt-1 text-[#667085]">Create, track, and manage all customer shipments linked to logistics batches.</p>
        </div>
        
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="px-5 py-2.5 text-sm font-bold rounded-xl transition-all hover:opacity-90 shadow-sm flex items-center justify-center gap-2 bg-[#FFB800] text-[#07182F] cursor-pointer"
        >
          <Plus size={16} /> Create Shipment
        </button>
      </div>

      {/* Create Shipment Right-Side Drawer */}
      <CreateShipmentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        customers={customers}
        batches={batches}
        onSuccess={loadData}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Search by Tracking ID, Description, Batch, Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 transition-colors bg-white shadow-sm border-[#E5E7EB] text-[#172236]"
          />
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        </div>
        
        {/* Batch filter */}
        <div className="relative w-full sm:w-48">
          <select 
            value={filterBatch}
            onChange={e => setFilterBatch(e.target.value)}
            className="w-full pl-9 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 transition-colors bg-white shadow-sm border-[#E5E7EB] text-[#172236] appearance-none cursor-pointer"
          >
            <option value="All">All Batches</option>
            <option value="Unassigned">Unassigned</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.name || b.id}</option>)}
          </select>
          <Layers size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        </div>

        {/* Status filter */}
        <div className="relative w-full sm:w-52">
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full pl-9 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-yellow-400 transition-colors bg-white shadow-sm border-[#E5E7EB] text-[#172236] appearance-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{SHIPMENT_STATUS_ADMIN_LABELS[s]}</option>)}
          </select>
          <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E5E7EB]">
        {loading ? (
          <div className="py-20 flex justify-center text-[#667085]">Loading shipments...</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <Truck size={48} className="mb-4 text-gray-200" />
            <p className="font-bold text-lg text-[#172236]">No shipments found</p>
            <p className="text-sm mt-1 mb-6 text-[#667085]">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#E5E7EB]">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Tracking ID</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Customer</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Details</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Batch (Journey)</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Effective Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right text-[#667085]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <Link href={`/admin/shipments/${s.id}`} className="font-bold text-sm text-[#0B1F44] hover:text-[#F2901F] transition-colors">
                          {s.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-[#172236]">{s.customerId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-[#172236] font-medium">{s.description}</p>
                        <p className="text-[11px] text-[#667085] mt-0.5">{s.origin} → {s.destination}</p>
                      </td>
                      <td className="px-6 py-4">
                        {s.batch ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-xs text-[#141B47] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Layers size={12} className="text-[#F2901F]" /> {s.batchName || s.batch}
                            </span>
                            {s.batchStageLabel && (
                              <p className="text-[10px] text-[#667085]">Stage: {s.batchStageLabel}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ShipmentStatusBadge status={s.status} adminMode />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/admin/shipments/${s.id}`}>
                          <button className="px-4 py-2 rounded-xl text-xs font-bold transition-colors bg-[#F1F5F9] text-[#0B1F44] hover:bg-[#E5E7EB]">
                            Manage
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Rows */}
            <div className="block md:hidden divide-y divide-[#F1F5F9]">
              {filtered.map(s => (
                <div key={s.id} className="p-4 space-y-3 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/admin/shipments/${s.id}`} className="font-bold text-sm text-[#0B1F44] hover:text-[#F2901F] transition-colors block">
                        {s.id}
                      </Link>
                      <span className="text-xs font-semibold text-[#667085]">Customer: {s.customerId}</span>
                    </div>
                    <ShipmentStatusBadge status={s.status} adminMode />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-[#172236]">{s.description}</p>
                    <p className="text-[11px] text-[#667085] mt-0.5">{s.origin} → {s.destination}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {s.batch ? (
                        <span className="text-[11px] font-semibold text-[#141B47] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {s.batchName || s.batch} · {s.batchStageLabel || s.batchStatus}
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic">Unassigned</span>
                      )}
                    </div>
                    <Link href={`/admin/shipments/${s.id}`}>
                      <button className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0B1F44] text-white hover:bg-[#355DAF] transition-colors min-h-[40px] flex items-center">
                        Manage Shipment
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
