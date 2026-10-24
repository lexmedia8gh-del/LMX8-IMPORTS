"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  getInvoiceByIdAction, 
  updateInvoiceAction, 
  InvoiceItemInput,
  getInvoiceClientShipmentsAction
} from "@/app/actions/invoices";
import { formatCurrency } from "@/lib/currency";
import { 
  ArrowLeft, Save, Plus, Trash2, AlertCircle, RefreshCw, 
  Truck, DollarSign, FileText, CheckCircle2 
} from "lucide-react";

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [items, setItems] = useState<InvoiceItemInput[]>([]);
  const [shippingCharges, setShippingCharges] = useState<number>(0);
  const [handlingCharges, setHandlingCharges] = useState<number>(0);
  const [customsCharges, setCustomsCharges] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [currency, setCurrency] = useState<string>("GHS");
  const [paymentInstructions, setPaymentInstructions] = useState<string>("");
  const [clientNotes, setClientNotes] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [purchaseOrderRef, setPurchaseOrderRef] = useState<string>("");
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("");
  const [clientShipments, setClientShipments] = useState<any[]>([]);

  useEffect(() => {
    getInvoiceByIdAction(resolvedParams.id).then((res) => {
      if (res.success && res.invoice) {
        const inv = res.invoice;
        setInvoice(inv);
        setItems(
          inv.items.map((it: any) => ({
            description: it.description,
            sku: it.sku || "",
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount || 0,
          }))
        );
        setShippingCharges(inv.shippingCharges || 0);
        setHandlingCharges(inv.handlingCharges || 0);
        setCustomsCharges(inv.customsCharges || 0);
        setOtherCharges(inv.otherCharges || 0);
        setDiscountAmount(inv.discountAmount || 0);
        setDiscountPercent(inv.discountPercent || 0);
        setTaxRate(inv.taxRate || 0);
        setDueDate(inv.dueDate.split("T")[0]);
        setCurrency(inv.currency || "GHS");
        setPaymentInstructions(inv.paymentInstructions || "");
        setClientNotes(inv.clientNotes || "");
        setInternalNotes(inv.internalNotes || "");
        setPurchaseOrderRef(inv.purchaseOrderRef || "");
        setSelectedShipmentId(inv.shipmentId || "");

        if (inv.customerId) {
          getInvoiceClientShipmentsAction(inv.customerId).then((sRes) => {
            if (sRes.success) setClientShipments(sRes.shipments || []);
          });
        }
      } else {
        setError(res.error || "Invoice not found.");
      }
      setLoading(false);
    });
  }, [resolvedParams.id]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await updateInvoiceAction({
        id: invoice.id,
        items,
        shippingCharges,
        handlingCharges,
        customsCharges,
        otherCharges,
        discountAmount: calculatedDiscount,
        discountPercent,
        taxRate,
        dueDate,
        currency,
        paymentInstructions,
        clientNotes,
        internalNotes,
        purchaseOrderRef,
        shipmentId: selectedShipmentId || null,
      });

      if (!res.success) {
        setError(res.error || "Failed to update invoice.");
      } else {
        router.push(`/admin/invoices/${invoice.id}`);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto py-24 text-center text-slate-500">
        <RefreshCw size={24} className="animate-spin mx-auto text-[#141B47] mb-2" />
        <p className="text-xs font-bold">Loading invoice for editing...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-8 max-w-md mx-auto py-20 text-center space-y-3">
        <div className="p-4 rounded-2xl bg-red-50 text-red-700 text-xs font-bold">{error || "Invoice not found."}</div>
        <Link href="/admin/invoices" className="text-xs text-[#141B47] underline">Back to Invoices</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/admin/invoices" className="hover:underline">Invoices</Link>
            <span>/</span>
            <Link href={`/admin/invoices/${invoice.id}`} className="hover:underline font-mono">#{invoice.invoiceNumber}</Link>
            <span>/</span>
            <span className="font-bold text-slate-800">Edit</span>
          </div>
          <h1 className="text-2xl font-black text-[#141B47] tracking-tight mt-1">
            Edit Invoice #{invoice.invoiceNumber}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Client: <strong>{invoice.customer?.name}</strong> · Status: {invoice.status}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/invoices/${invoice.id}`}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Save size={14} /> {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Linked Shipment Selection */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs text-xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Truck size={16} className="text-[#141B47]" /> Linked Shipment
          </h3>
          <select
            value={selectedShipmentId}
            onChange={(e) => setSelectedShipmentId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-xs"
          >
            <option value="">-- No shipment linked (Goods invoice only) --</option>
            {clientShipments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.trackingNumber} — {s.description} ({s.status})
              </option>
            ))}
          </select>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs text-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-sm">Goods &amp; Line Items</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const lineTotal = Math.max(0, (item.quantity * item.unitPrice) - (item.discount || 0));
              return (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                    <span>Item #{idx + 1}</span>
                    {items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="SKU"
                        value={item.sku || ""}
                        onChange={(e) => handleItemChange(idx, "sku", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 bg-white font-mono text-center"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1 text-right py-2 font-mono font-bold text-slate-800">
                      {formatCurrency(lineTotal, currency)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Charges & Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs text-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <DollarSign size={16} className="text-[#141B47]" /> Charges &amp; Discount
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Shipping Fee</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCharges}
                  onChange={(e) => setShippingCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Handling Fee</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={handlingCharges}
                  onChange={(e) => setHandlingCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Customs Fee</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={customsCharges}
                  onChange={(e) => setCustomsCharges(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Discount Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs text-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Terms &amp; Dates</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-red-600"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Client Notes</label>
                <textarea
                  rows={2}
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bottom */}
        <div className="flex justify-end gap-2 pt-4">
          <Link
            href={`/admin/invoices/${invoice.id}`}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] shadow-xs cursor-pointer"
          >
            {submitting ? "Updating..." : "Save Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
