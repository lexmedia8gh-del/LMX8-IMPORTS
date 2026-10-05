"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { ShipmentStatusBadge, STATUS_ORDER, ShipmentStatus, SHIPMENT_STATUS_ADMIN_LABELS } from "@/components/shipment-status";
import { getBatchCustomerLabel } from "@/lib/batch-status";
import { createShipmentAction } from "@/app/actions";
import { 
  Truck, Search, Check, RefreshCw, Layers, User, Calendar, MapPin, 
  Sparkles, AlertCircle, Info, ChevronDown
} from "lucide-react";

interface CustomerOption {
  id: string; // identifier e.g. LMX8-00001
  name: string;
  phone?: string;
  email?: string;
}

interface BatchOption {
  id: string; // batchNumber e.g. BATCH-1049
  dbId?: string;
  name: string;
  description?: string;
  status: string;
  arrival?: string;
  departure?: string;
}

interface CreateShipmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  batches: BatchOption[];
  onSuccess?: () => void;
  preselectedCustomerId?: string;
  preselectedBatchId?: string;
}

export function CreateShipmentDrawer({
  isOpen,
  onClose,
  customers,
  batches,
  onSuccess,
  preselectedCustomerId,
  preselectedBatchId,
}: CreateShipmentDrawerProps) {
  // Generate tracking number helper
  const generateTrackingNumber = () => `SHP-${Math.floor(Math.random() * 90000) + 10000}`;

  // Form State
  const [customerId, setCustomerId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState<string>(generateTrackingNumber());
  const [description, setDescription] = useState<string>("");
  const [origin, setOrigin] = useState<string>("Shenzhen, China");
  const [destination, setDestination] = useState<string>("Accra, Ghana");
  const [shippingMethod, setShippingMethod] = useState<string>("Sea Freight");
  const [estimatedArrival, setEstimatedArrival] = useState<string>("");
  const [status, setStatus] = useState<ShipmentStatus>("SHIPMENT_CREATED");

  // Combobox & UI States
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [batchSearch, setBatchSearch] = useState<string>("");
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize/reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTrackingNumber(generateTrackingNumber());
      setCustomerId(preselectedCustomerId || (customers.length > 0 ? customers[0].id : ""));
      setBatchId(preselectedBatchId || "");
      setDescription("");
      setOrigin("Shenzhen, China");
      setDestination("Accra, Ghana");
      setShippingMethod("Sea Freight");
      setEstimatedArrival("");
      setStatus("SHIPMENT_CREATED");
      setCustomerSearch("");
      setBatchSearch("");
      setIsCustomerDropdownOpen(false);
      setIsBatchDropdownOpen(false);
      setErrorMessage(null);

      // If preselected batch, auto-fill from it
      if (preselectedBatchId) {
        const foundBatch = batches.find(b => b.id === preselectedBatchId || b.dbId === preselectedBatchId);
        if (foundBatch) {
          if (foundBatch.arrival) setEstimatedArrival(foundBatch.arrival);
          if (foundBatch.description?.toLowerCase().includes("air")) setShippingMethod("Air Freight");
        }
      }
    }
  }, [isOpen, preselectedCustomerId, preselectedBatchId, customers, batches]);

  // Selected Entities
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === customerId);
  }, [customers, customerId]);

  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === batchId || b.dbId === batchId);
  }, [batches, batchId]);

  // Filtered Customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter(c => 
      c.name.toLowerCase().includes(term) ||
      c.id.toLowerCase().includes(term) ||
      (c.phone && c.phone.toLowerCase().includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term))
    );
  }, [customers, customerSearch]);

  // Filtered Batches
  const activeBatches = useMemo(() => {
    return batches.filter(b => b.status !== "CLOSED");
  }, [batches]);

  const filteredBatches = useMemo(() => {
    if (!batchSearch.trim()) return activeBatches;
    const term = batchSearch.toLowerCase();
    return activeBatches.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.id.toLowerCase().includes(term) ||
      (b.description && b.description.toLowerCase().includes(term))
    );
  }, [activeBatches, batchSearch]);

  // Auto-fill when batch is selected
  const handleSelectBatch = (b: BatchOption | null) => {
    if (b) {
      setBatchId(b.id);
      if (b.arrival) {
        setEstimatedArrival(b.arrival);
      }
      if (b.description?.toLowerCase().includes("air")) {
        setShippingMethod("Air Freight");
      }
    } else {
      setBatchId("");
    }
    setIsBatchDropdownOpen(false);
  };

  // Determine if form has unsaved modifications
  const isDirty = useMemo(() => {
    return description.trim().length > 0 || 
           estimatedArrival.length > 0 || 
           batchId.length > 0 ||
           origin !== "Shenzhen, China" ||
           destination !== "Accra, Ghana";
  }, [description, estimatedArrival, batchId, origin, destination]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!customerId) {
      setErrorMessage("Please select a customer for this shipment.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Please enter a description or contents for this shipment.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createShipmentAction({
        customerId,
        batchId: batchId || null,
        trackingNumber,
        description: description.trim(),
        origin: origin.trim(),
        destination: destination.trim(),
        shippingMethod,
        estimatedArrival: estimatedArrival || null,
        status,
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[CreateShipmentDrawer] Error creating shipment:", err);
      setErrorMessage(err?.message || "Unable to create shipment. Please check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create Shipment"
      description="Add a shipment to a customer account and assign to a logistics batch."
      icon={<Truck size={20} />}
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
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-[#07182F] bg-[#F2901F] hover:bg-[#E08215] transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Creating Shipment...</span>
              </>
            ) : (
              <>
                <Truck size={14} />
                <span>Create Shipment</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Shipment creation failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ── SECTION 1: CUSTOMER ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
              <User size={14} className="text-[#355DAF]" /> Customer Account *
            </label>
            <span className="text-[11px] text-[#667085]">Required</span>
          </div>

          {/* Customer Search Combobox */}
          <div className="relative">
            <div
              onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#355DAF] focus-within:border-[#F2901F] transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-xs"
            >
              {selectedCustomer ? (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#141B47] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#172236] truncate">{selectedCustomer.name}</p>
                    <p className="text-[11px] text-[#667085] font-mono">{selectedCustomer.id} {selectedCustomer.phone ? `· ${selectedCustomer.phone}` : ""}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-[#94A3B8]">Select a customer account...</span>
              )}
              <ChevronDown size={16} className="text-[#94A3B8] shrink-0" />
            </div>

            {/* Dropdown Menu */}
            {isCustomerDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-[#E5E7EB] z-30 max-h-64 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-2.5 border-b border-[#F1F5F9] bg-[#F7F9FC]">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search customer by name, ID or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F]"
                    />
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  </div>
                </div>

                <div className="overflow-y-auto divide-y divide-[#F1F5F9] max-h-48">
                  {filteredCustomers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#667085]">No matching customers found.</div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setIsCustomerDropdownOpen(false);
                          setCustomerSearch("");
                        }}
                        className={`p-3 text-xs hover:bg-[#F7F9FC] cursor-pointer flex items-center justify-between transition-colors ${
                          customerId === c.id ? "bg-amber-50/70 font-semibold" : ""
                        }`}
                      >
                        <div>
                          <p className="font-bold text-[#172236]">{c.name}</p>
                          <p className="text-[11px] text-[#667085] font-mono mt-0.5">{c.id} {c.phone ? `· ${c.phone}` : ""}</p>
                        </div>
                        {customerId === c.id && <Check size={16} className="text-[#F2901F] shrink-0" />}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <hr className="border-[#F1F5F9]" />

        {/* ── SECTION 2: BATCH LINKING ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
              <Layers size={14} className="text-[#F2901F]" /> Logistics Batch Assignment
            </label>
            <span className="text-[11px] text-[#667085]">Optional / Recommended</span>
          </div>

          <div className="relative">
            <div
              onClick={() => setIsBatchDropdownOpen(!isBatchDropdownOpen)}
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] bg-white hover:border-[#355DAF] focus-within:border-[#F2901F] transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-xs"
            >
              {selectedBatch ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#141B47] text-white uppercase shrink-0">
                    {selectedBatch.id}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#172236] truncate">{selectedBatch.name}</p>
                    <p className="text-[11px] text-[#355DAF]">{getBatchCustomerLabel(selectedBatch.status)}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-[#667085]">Unassigned (Standalone Shipment)</span>
              )}
              <ChevronDown size={16} className="text-[#94A3B8] shrink-0" />
            </div>

            {/* Dropdown Menu */}
            {isBatchDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-[#E5E7EB] z-30 max-h-64 flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-2.5 border-b border-[#F1F5F9] bg-[#F7F9FC]">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search active batches..."
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      autoFocus
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F]"
                    />
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  </div>
                </div>

                <div className="overflow-y-auto divide-y divide-[#F1F5F9] max-h-48">
                  <div
                    onClick={() => handleSelectBatch(null)}
                    className={`p-3 text-xs hover:bg-[#F7F9FC] cursor-pointer flex items-center justify-between text-[#667085] ${
                      !batchId ? "bg-amber-50/70 font-semibold text-[#141B47]" : ""
                    }`}
                  >
                    <span>Unassigned (Standalone Shipment)</span>
                    {!batchId && <Check size={16} className="text-[#F2901F] shrink-0" />}
                  </div>

                  {filteredBatches.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBatch(b)}
                      className={`p-3 text-xs hover:bg-[#F7F9FC] cursor-pointer flex items-center justify-between transition-colors ${
                        batchId === b.id ? "bg-amber-50/70 font-semibold" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#141B47]">{b.id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            {getBatchCustomerLabel(b.status)}
                          </span>
                        </div>
                        <p className="text-xs text-[#172236] mt-0.5">{b.name}</p>
                        {b.arrival && <p className="text-[10px] text-[#667085]">ETA: {b.arrival}</p>}
                      </div>
                      {batchId === b.id && <Check size={16} className="text-[#F2901F] shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {selectedBatch && (
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
              <Info size={16} className="text-[#355DAF] shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <p className="font-semibold text-[#141B47]">Master Journey Synchronization</p>
                <p className="text-[11px] text-[#475569]">
                  Tracking timeline will automatically synchronize as <strong>{selectedBatch.name}</strong> updates its logistics stage.
                </p>
              </div>
            </div>
          )}
        </div>

        <hr className="border-[#F1F5F9]" />

        {/* ── SECTION 3: SHIPMENT DETAILS ── */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] block">
            Shipment Identification & Contents
          </label>

          {/* Tracking Number */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#667085]">Tracking Number</label>
              <button
                type="button"
                onClick={() => setTrackingNumber(generateTrackingNumber())}
                className="text-[11px] font-bold text-[#355DAF] hover:text-[#141B47] flex items-center gap-1 cursor-pointer"
              >
                <Sparkles size={12} /> Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
              placeholder="e.g. SHP-51473"
              className="w-full px-4 h-11 rounded-xl text-sm border font-mono font-bold tracking-wider text-[#141B47] bg-[#F7F9FC] border-[#E5E7EB] focus:bg-white focus:outline-hidden focus:border-[#F2901F] transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Description / Cargo Items *</label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 5x Cartons of Accessories and Smart Watches"
              className="w-full p-3 text-xs rounded-xl border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Shipping Method */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#667085]">Shipping Method</label>
            <select
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
              className="w-full px-3.5 h-11 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors cursor-pointer"
            >
              <option value="Sea Freight">Sea Freight (Bulk Consignment)</option>
              <option value="Air Freight">Air Freight (Express 7-14 Days)</option>
            </select>
          </div>
        </div>

        <hr className="border-[#F1F5F9]" />

        {/* ── SECTION 4: ROUTE & SCHEDULE ── */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <MapPin size={14} className="text-[#355DAF]" /> Route & Estimated Arrival
          </label>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085] flex items-center gap-1">
                <Calendar size={13} /> Estimated Arrival
              </label>
              <input
                type="date"
                value={estimatedArrival}
                onChange={(e) => setEstimatedArrival(e.target.value)}
                className="w-full px-3.5 h-10 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#667085]">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
                className="w-full px-3.5 h-10 rounded-xl text-xs font-medium border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SHIPMENT_STATUS_ADMIN_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </form>
    </AdminDrawer>
  );
}
