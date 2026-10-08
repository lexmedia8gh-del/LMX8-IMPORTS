"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { createBatchAction } from "@/app/actions";
import { 
  Package, Calendar, MapPin, RefreshCw, AlertCircle, Sparkles, Layers 
} from "lucide-react";

interface CreateBatchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const BATCH_INITIAL_STATUSES = [
  { value: "OPEN", label: "OPEN (Accepting Shipments)" },
  { value: "IN TRANSIT", label: "IN TRANSIT (Departed Origin)" },
  { value: "ARRIVED IN GHANA", label: "ARRIVED IN GHANA" },
  { value: "PROCESSING / COLLECTION", label: "PROCESSING / COLLECTION" },
];

export function CreateBatchDrawer({
  isOpen,
  onClose,
  onSuccess,
}: CreateBatchDrawerProps) {
  const generateBatchNumber = () => `BATCH-${Math.floor(Math.random() * 9000) + 1000}`;

  const [batchNumber, setBatchNumber] = useState<string>(generateBatchNumber());
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [origin, setOrigin] = useState<string>("Shenzhen, China");
  const [destination, setDestination] = useState<string>("Accra, Ghana");
  const [shippingMethod, setShippingMethod] = useState<string>("Sea Freight");
  const [departure, setDeparture] = useState<string>("");
  const [arrival, setArrival] = useState<string>("");
  const [status, setStatus] = useState<string>("OPEN");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBatchNumber(generateBatchNumber());
      setName("");
      setDescription("");
      setOrigin("Shenzhen, China");
      setDestination("Accra, Ghana");
      setShippingMethod("Sea Freight");
      setDeparture("");
      setArrival("");
      setStatus("OPEN");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const isDirty = useMemo(() => {
    return name.trim().length > 0 || 
           description.trim().length > 0 || 
           departure.length > 0 || 
           arrival.length > 0;
  }, [name, description, departure, arrival]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please provide a batch name or consignment title.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createBatchAction({
        name: name.trim(),
        description: description.trim() || `${shippingMethod} - ${name.trim()}`,
        departure: departure || null,
        arrival: arrival || null,
        status,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[CreateBatchDrawer] Error creating batch:", err);
      setErrorMessage(err?.message || "Unable to create batch. Please check required fields.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create Logistics Batch"
      description="Create a master consignment journey to group and synchronize customer shipments."
      icon={<Layers size={20} />}
      isDirty={isDirty}
      widthClassName="sm:max-w-lg md:max-w-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#172236] hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Creating Batch...</span>
              </>
            ) : (
              <>
                <Package size={14} />
                <span>Create Batch</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Batch creation failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ── SECTION 1: BATCH IDENTIFICATION ── */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] block">
            Batch Identification & Details
          </label>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#667085]">Batch Code (Identifier)</label>
              <button
                type="button"
                onClick={() => setBatchNumber(generateBatchNumber())}
                className="text-[11px] font-bold text-[#355DAF] hover:text-[#141B47] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={12} /> Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
              placeholder="e.g. BATCH-1049"
              className="w-full px-4 h-11 rounded-xl text-sm border font-mono font-bold tracking-wider text-[#141B47] bg-[#F7F9FC] border-[#E5E7EB] focus:bg-white focus:outline-hidden focus:border-[#F2901F] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Batch Name / Consignment Title *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. October Sea Freight Consignment #1"
              className="w-full px-3.5 h-11 rounded-xl text-xs font-medium border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Description / Cargo Summary</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Mixed consumer electronics, textiles, and bulk machinery from Shenzhen hub"
              className="w-full p-3 text-xs rounded-xl border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors resize-none leading-relaxed"
            />
          </div>
        </div>

        <hr className="border-[#F1F5F9]" />

        {/* ── SECTION 2: SHIPPING METHOD & ROUTE ── */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <MapPin size={14} className="text-[#355DAF]" /> Route & Logistics Method
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Shipping Freight Type</label>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
              className="w-full px-3.5 h-11 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors cursor-pointer"
            >
              <option value="Sea Freight">Sea Freight (Standard Consignment ~6-8 Weeks)</option>
              <option value="Air Freight">Air Freight (Express 7-14 Days Transit)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085]">Origin</label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Shenzhen, China"
                className="w-full px-3.5 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085]">Destination</label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Accra, Ghana"
                className="w-full px-3.5 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236]"
              />
            </div>
          </div>
        </div>

        <hr className="border-[#F1F5F9]" />

        {/* ── SECTION 3: SCHEDULE & INITIAL STAGE ── */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <Calendar size={14} className="text-[#355DAF]" /> Schedule & Operational Stage
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085]">Est. Departure</label>
              <input
                type="date"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                className="w-full px-3.5 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085]">Est. Arrival in Ghana</label>
              <input
                type="date"
                value={arrival}
                onChange={(e) => setArrival(e.target.value)}
                className="w-full px-3.5 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Initial Operational Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 h-10 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
            >
              {BATCH_INITIAL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </AdminDrawer>
  );
}
