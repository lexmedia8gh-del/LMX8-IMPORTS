"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getInvoiceEligibleClientsAction, 
  getInvoiceClientShipmentsAction, 
  createInvoiceAction,
  InvoiceItemInput
} from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/currency";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { 
  User, Truck, Package, DollarSign, FileText, CheckCircle2, 
  ArrowRight, ArrowLeft, Plus, Trash2, Search, AlertCircle, ShieldCheck,
  Building, Phone, Mail, HelpCircle, Save, Send
} from "lucide-react";

export default function NewInvoicePage() {
  const router = useRouter();

  // Wizard Step (1 to 6)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Clients & Shipments
  const [clients, setClients] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const [clientShipments, setClientShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [shipmentSearch, setShipmentSearch] = useState<string>("");

  // Items State
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { description: "", sku: "", quantity: 1, unitPrice: 0, discount: 0 },
  ]);

  // Financial Charges & Adjustments
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [handlingCharges, setHandlingCharges] = useState<number>(0);
  const [customsCharges, setCustomsCharges] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);

  // Invoice Details
  const [currency, setCurrency] = useState<string>("GHS");
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);
  const [dueDate, setDueDate] = useState<string>(defaultDueDate.toISOString().split("T")[0]);
  const [purchaseOrderRef, setPurchaseOrderRef] = useState<string>("");
  const [paymentInstructions, setPaymentInstructions] = useState<string>(
    "Bank: Stanbic Bank Ghana\nAccount Name: LexMedia Imports Ltd\nAccount Number: 9040008392183\nBranch: Tema Main\nMobile Money: 024 123 4567 (MTN MoMo - LexMedia)"
  );
  const [clientNotes, setClientNotes] = useState<string>("Thank you for doing business with LMX8 Imports. All cargo is processed subject to standard freight terms.");
  const [internalNotes, setInternalNotes] = useState<string>("");

  // Load clients on mount
  useEffect(() => {
    setLoading(true);
    getInvoiceEligibleClientsAction()
      .then((res) => {
        if (res.success) setClients(res.clients || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // When selectedClient changes, load their shipments
  useEffect(() => {
    if (selectedClient?.id) {
      getInvoiceClientShipmentsAction(selectedClient.id).then((res) => {
        if (res.success) {
          setClientShipments(res.shipments || []);
        } else {
          setClientShipments([]);
        }
      });
      setSelectedShipment(null);
    } else {
      setClientShipments([]);
      setSelectedShipment(null);
    }
  }, [selectedClient]);

  // Calculations
  const subtotal = items.reduce((acc, it) => {
    const q = Math.max(1, it.quantity || 1);
    const p = Math.max(0, it.unitPrice || 0);
    const d = Math.max(0, it.discount || 0);
    return acc + Math.max(0, q * p - d);
  }, 0);

  const calculatedDiscount = discountPercent > 0 && discountAmount === 0
    ? Math.round((subtotal * (discountPercent / 100)) * 100) / 100
    : discountAmount;

  const baseAfterDiscount = Math.max(0, subtotal - calculatedDiscount);
  const totalCharges = shippingCharges + handlingCharges + customsCharges + otherCharges;
  const taxAmount = taxRate > 0 ? Math.round((baseAfterDiscount * (taxRate / 100)) * 100) / 100 : 0;
  const totalAmount = Math.round((baseAfterDiscount + totalCharges + taxAmount) * 100) / 100;

  // Item helpers
  const handleAddItem = () => {
    setItems([...items, { description: "", sku: "", quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItemInput, val: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    setItems(updated);
  };

  // Step Validation
  const canProceed = () => {
    if (currentStep === 1) return Boolean(selectedClient);
    if (currentStep === 3) {
      return items.length > 0 && items.every((it) => it.description.trim().length > 0 && it.unitPrice >= 0);
    }
    if (currentStep === 5) return Boolean(dueDate);
    return true;
  };

  const handleFinalSubmit = async (status: "DRAFT" | "ISSUED") => {
    if (!selectedClient) {
      setError("Please select a client.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const res = await createInvoiceAction({
        customerId: selectedClient.id,
        shipmentId: selectedShipment?.id || null,
        issueDate,
        dueDate,
        currency,
        items,
        discountAmount: calculatedDiscount,
        discountPercent,
        shippingCharges,
        handlingCharges,
        customsCharges,
        otherCharges,
        taxRate,
        paymentInstructions,
        clientNotes,
        internalNotes,
        purchaseOrderRef,
        status,
      });

      if (!res.success) {
        setError(res.error || "Failed to create invoice.");
      } else {
        router.push(`/admin/invoices/${res.invoiceId}`);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.customerIdentifier && c.customerIdentifier.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const filteredShipments = clientShipments.filter((s) => {
    const q = shipmentSearch.toLowerCase();
    return (
      s.trackingNumber.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/admin/invoices" className="hover:text-[#141B47] hover:underline">
            Invoices
          </Link>
          <span>/</span>
          <span className="text-slate-800 font-bold">New Invoice</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#141B47] tracking-tight mt-1">
          Create Client Invoice
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Follow the guided steps to generate a professional branded invoice for goods and freight services
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Stepper Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs overflow-x-auto scrollbar-thin">
        <div className="flex items-center min-w-[620px] justify-between">
          {[
            { step: 1, title: "1. Client", icon: <User size={14} /> },
            { step: 2, title: "2. Shipment", icon: <Truck size={14} /> },
            { step: 3, title: "3. Items", icon: <Package size={14} /> },
            { step: 4, title: "4. Charges", icon: <DollarSign size={14} /> },
            { step: 5, title: "5. Details", icon: <FileText size={14} /> },
            { step: 6, title: "6. Preview & Confirm", icon: <CheckCircle2 size={14} /> },
          ].map((s) => (
            <button
              key={s.step}
              onClick={() => {
                if (s.step < currentStep || canProceed()) {
                  setCurrentStep(s.step);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                currentStep === s.step
                  ? "bg-[#141B47] text-white shadow-xs"
                  : currentStep > s.step
                  ? "text-emerald-700 hover:bg-emerald-50"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {s.icon}
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: SELECT A CLIENT */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
              <User size={18} className="text-[#F2901F]" /> Step 1: Select Client
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose an existing client from the database as the source of truth for this invoice
            </p>
          </div>

          {/* Search clients */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client name, client ID (e.g. LMX8-00125), phone, or email..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#141B47]"
            />
          </div>

          {/* Clients List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center col-span-2">Loading clients...</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center col-span-2">No matching clients found.</p>
            ) : (
              filteredClients.map((client) => {
                const isSelected = selectedClient?.id === client.id;
                return (
                  <div
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                      isSelected
                        ? "border-[#141B47] bg-slate-50 ring-2 ring-[#141B47]/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900 text-sm">{client.name}</p>
                      {client.customerIdentifier && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {client.customerIdentifier}
                        </span>
                      )}
                    </div>
                    {client.phone && (
                      <p className="text-slate-600 flex items-center gap-1 font-mono">
                        <Phone size={12} className="text-slate-400" /> {client.phone}
                      </p>
                    )}
                    {client.email && (
                      <p className="text-slate-600 flex items-center gap-1">
                        <Mail size={12} className="text-slate-400" /> {client.email}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Client Summary Box */}
          {selectedClient && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                  Selected Client
                </span>
                <p className="font-bold text-slate-900 text-sm">{selectedClient.name}</p>
                <p className="text-slate-600 font-mono text-[11px]">
                  ID: {selectedClient.customerIdentifier || selectedClient.id} · {selectedClient.phone || "No phone"} · {selectedClient.email || "No email"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs"
              >
                Continue to Shipment <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: LINK TO SHIPMENT (OPTIONAL) */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
                <Truck size={18} className="text-[#F2901F]" /> Step 2: Link to Shipment (Optional)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Link this invoice to an existing cargo consignment belonging to <strong>{selectedClient?.name}</strong>, or skip to bill for goods without a shipment
              </p>
            </div>
            {selectedShipment && (
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="text-xs text-red-600 hover:underline font-bold"
              >
                Unlink Shipment
              </button>
            )}
          </div>

          {/* Search Client's Shipments */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search client's shipments by tracking number or description..."
              value={shipmentSearch}
              onChange={(e) => setShipmentSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#141B47]"
            />
          </div>

          {/* Shipments List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {clientShipments.length === 0 ? (
              <div className="col-span-2 p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-1">
                <p className="font-semibold">No existing shipments recorded for this client.</p>
                <p className="text-[11px] text-slate-400">
                  You can proceed without linking a shipment; invoices can be created for goods prior to cargo assignment.
                </p>
              </div>
            ) : filteredShipments.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center col-span-2">No matching shipments found.</p>
            ) : (
              filteredShipments.map((shipment) => {
                const isSelected = selectedShipment?.id === shipment.id;
                return (
                  <div
                    key={shipment.id}
                    onClick={() => setSelectedShipment(shipment)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                      isSelected
                        ? "border-[#141B47] bg-slate-50 ring-2 ring-[#141B47]/20 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold text-slate-900">{shipment.trackingNumber}</p>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {shipment.status}
                      </span>
                    </div>
                    <p className="text-slate-600 line-clamp-2">{shipment.description}</p>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Created: {new Date(shipment.createdAt).toLocaleDateString()}</span>
                      <span className="font-mono font-bold text-slate-700">Fee: {formatCurrency(shipment.fee)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary / Step Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 rounded-xl font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs"
            >
              {selectedShipment ? "Continue with Linked Shipment" : "Skip Shipment & Continue"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: GOODS & INVOICE ITEMS */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
                <Package size={18} className="text-[#F2901F]" /> Step 3: Add Goods &amp; Line Items
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Itemize the goods, products, quantities, and unit pricing for this invoice
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          {/* Items Form Table */}
          <div className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = Math.max(0, (item.quantity * item.unitPrice) - (item.discount || 0));
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-600">Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove Item"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Goods Description *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Industrial Sewing Machine - Model X8"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        SKU / Code
                      </label>
                      <input
                        type="text"
                        placeholder="SKU-102"
                        value={item.sku || ""}
                        onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white font-mono text-center"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Unit Price ({currency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white font-mono"
                      />
                    </div>

                    <div className="sm:col-span-1 text-right">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Total
                      </label>
                      <p className="font-mono font-bold text-slate-900 py-2">
                        {formatCurrency(lineTotal, currency)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal Banner */}
          <div className="p-4 rounded-xl bg-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Items Subtotal:</span>
            <span className="font-mono text-base font-black text-slate-900">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              disabled={!canProceed()}
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 rounded-xl font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              Continue to Charges <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CHARGES & ADJUSTMENTS */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
              <DollarSign size={18} className="text-[#F2901F]" /> Step 4: Freight Charges &amp; Adjustments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add optional freight, customs, handling, or discounts applicable to this invoice
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Shipping & Freight */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <label className="block font-bold text-slate-700">Shipping / Freight Charge ({currency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={shippingCharges}
                onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>

            {/* Handling */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <label className="block font-bold text-slate-700">Handling &amp; Packaging ({currency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={handlingCharges}
                onChange={(e) => setHandlingCharges(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>

            {/* Customs */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <label className="block font-bold text-slate-700">Customs Clearance / Port Tariffs ({currency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customsCharges}
                onChange={(e) => setCustomsCharges(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>

            {/* Other Services */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <label className="block font-bold text-slate-700">Other Services / Delivery ({currency})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={otherCharges}
                onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>

            {/* Discount */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <label className="block font-bold text-slate-700">Discount Amount / %</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={`Flat (${currency})`}
                  value={discountAmount}
                  onChange={(e) => {
                    setDiscountAmount(parseFloat(e.target.value) || 0);
                    if (parseFloat(e.target.value) > 0) setDiscountPercent(0);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                />
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  placeholder="Percent (%)"
                  value={discountPercent}
                  onChange={(e) => {
                    setDiscountPercent(parseFloat(e.target.value) || 0);
                    if (parseFloat(e.target.value) > 0) setDiscountAmount(0);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                />
              </div>
            </div>

            {/* Tax */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <label className="block font-bold text-slate-700">Tax Rate (% - Optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="0% (Tax exempt / not applicable)"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono bg-white"
              />
            </div>
          </div>

          {/* Financial Breakdown Preview Box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2 max-w-md ml-auto">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal:</span>
              <span className="font-mono font-bold">{formatCurrency(subtotal, currency)}</span>
            </div>
            {calculatedDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount:</span>
                <span className="font-mono">-{formatCurrency(calculatedDiscount, currency)}</span>
              </div>
            )}
            {totalCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Additional Charges:</span>
                <span className="font-mono">+{formatCurrency(totalCharges, currency)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxRate}%):</span>
                <span className="font-mono">+{formatCurrency(taxAmount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
              <span>Total Invoiced:</span>
              <span className="font-mono text-[#141B47] text-base">{formatCurrency(totalAmount, currency)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="px-5 py-2.5 rounded-xl font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs"
            >
              Continue to Details <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: INVOICE DETAILS */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
              <FileText size={18} className="text-[#F2901F]" /> Step 5: Terms &amp; Settlement Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify dates, payment instructions, client notices, and internal administrative notes
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold"
              >
                <option value="GHS">GHS (Ghanaian Cedi - GH₵)</option>
                <option value="USD">USD (US Dollar - $)</option>
                <option value="EUR">EUR (Euro - €)</option>
                <option value="GBP">GBP (British Pound - £)</option>
                <option value="CNY">CNY (Chinese Yuan - ¥)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-red-600"
              />
            </div>
          </div>

          <div className="text-xs space-y-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Purchase Order / Client Reference (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. PO-88219"
                value={purchaseOrderRef}
                onChange={(e) => setPurchaseOrderRef(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Payment Instructions (Printed on invoice &amp; sent in email)
              </label>
              <textarea
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 leading-relaxed font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Client Notes (Printed on invoice footer)
              </label>
              <textarea
                rows={2}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 leading-relaxed"
              />
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200">
              <label className="block font-bold text-amber-900 mb-1">
                Internal Administrative Notes (STRICTLY CONFIDENTIAL — NEVER EXPOSED TO CLIENT)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Sourced via supplier Liu in Guangzhou; warehouse release authorized upon 50% deposit"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white leading-relaxed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(6)}
              className="px-5 py-2.5 rounded-xl font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs"
            >
              Review Live Preview <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: PREVIEW & CONFIRM */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#141B47] flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-500" /> Step 6: Review Live Invoice Document
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect the final document layout. You can save as a draft to edit later or officially issue it now.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinalSubmit("DRAFT")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5"
              >
                <Save size={14} /> Save Draft
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFinalSubmit("ISSUED")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-sm"
              >
                <Send size={14} /> {submitting ? "Finalizing..." : "Issue Invoice Officially"}
              </button>
            </div>
          </div>

          {/* Render Actual Invoice Document Preview */}
          <InvoiceDocument
            invoice={{
              invoiceNumber: "PREVIEW-PENDING",
              status: "DRAFT",
              issueDate,
              dueDate,
              currency,
              subtotal,
              discountAmount: calculatedDiscount,
              discountPercent,
              shippingCharges,
              handlingCharges,
              customsCharges,
              otherCharges,
              taxRate,
              taxAmount,
              totalAmount,
              amountPaid: 0,
              outstandingBalance: totalAmount,
              paymentInstructions,
              clientNotes,
              purchaseOrderRef,
              customer: selectedClient,
              shipment: selectedShipment,
              items: items.map((it) => ({
                description: it.description || "Line Item",
                sku: it.sku,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                discount: it.discount,
                lineTotal: Math.max(0, it.quantity * it.unitPrice - (it.discount || 0)),
              })),
            }}
          />
        </div>
      )}
    </div>
  );
}
