"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { 
  CreditCard, Search, DollarSign, Calendar, User, Package, FileText, 
  CheckCircle2, AlertCircle, AlertTriangle, ShieldCheck, ChevronDown, Check,
  RotateCcw, ArrowRight, Printer, Sparkles, Tag
} from "lucide-react";
import { 
  recordOfflinePaymentAction, 
  getCustomersForPaymentAction, 
  getCustomerShipmentsForPaymentAction,
  RecordOfflinePaymentInput
} from "@/app/actions/admin-payments";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import { formatCurrency } from "@/lib/currency";

export interface CustomerOption {
  id: string; // internal UUID
  customerIdentifier: string; // LMX8-XXXXX
  name: string;
  phone?: string;
  email?: string;
}

export interface ShipmentOption {
  id: string;
  trackingNumber: string;
  description: string;
  status: string;
  batch?: string | null;
  batchName?: string | null;
  fee: number;
  originalFee?: number;
  discountPercent?: number;
  discountAmount?: number;
  paidAmount: number;
  outstanding: number;
  isPaid: boolean;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

interface RecordPaymentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedCustomerId?: string; // id or customerIdentifier
  preselectedCustomerName?: string;
  preselectedShipmentId?: string; // id or trackingNumber
  preselectedAmount?: number;
  onSuccess?: (payment: any) => void;
}

export function RecordPaymentDrawer({
  isOpen,
  onClose,
  preselectedCustomerId,
  preselectedCustomerName,
  preselectedShipmentId,
  preselectedAmount,
  onSuccess,
}: RecordPaymentDrawerProps) {
  const [isPending, startTransition] = useTransition();

  // Customer state
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState<boolean>(false);
  const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);

  // Shipment state
  const [customerShipments, setCustomerShipments] = useState<ShipmentOption[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("");
  const [loadingShipments, setLoadingShipments] = useState<boolean>(false);

  // Form Fields
  const [amountInput, setAmountInput] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "MTN_MOMO" | "TELECEL_CASH" | "AT_MONEY" | "BANK_TRANSFER" | "OTHER"
  >("CASH");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [payerName, setPayerName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [allowOverpayment, setAllowOverpayment] = useState<boolean>(false);
  const [requiresOverpaymentConfirm, setRequiresOverpaymentConfirm] = useState<boolean>(false);

  // Submission & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayment, setSuccessPayment] = useState<any | null>(null);

  // Load customer list
  useEffect(() => {
    if (isOpen) {
      setLoadingCustomers(true);
      getCustomersForPaymentAction()
        .then((list) => {
          setCustomers(list);
          if (preselectedCustomerId) {
            const found = list.find(
              (c) =>
                c.id === preselectedCustomerId ||
                c.customerIdentifier.toLowerCase() === preselectedCustomerId.toLowerCase()
            );
            if (found) {
              setSelectedCustomerId(found.id);
            } else {
              setSelectedCustomerId(preselectedCustomerId);
            }
          } else if (list.length > 0) {
            setSelectedCustomerId((prev) => prev || list[0].id);
          }
        })
        .catch((err) => console.error("Error fetching customers:", err))
        .finally(() => setLoadingCustomers(false));
    }
  }, [isOpen, preselectedCustomerId]);

  // Load shipments when customer changes
  useEffect(() => {
    if (isOpen && selectedCustomerId) {
      setLoadingShipments(true);
      getCustomerShipmentsForPaymentAction(selectedCustomerId)
        .then((shipments) => {
          setCustomerShipments(shipments);

          // If preselected shipment or single shipment with outstanding balance, choose it
          if (preselectedShipmentId) {
            const match = shipments.find(
              (s) =>
                s.id === preselectedShipmentId ||
                s.trackingNumber.toLowerCase() === preselectedShipmentId.toLowerCase()
            );
            if (match) {
              setSelectedShipmentId(match.id);
              if (preselectedAmount != null && preselectedAmount > 0) {
                setAmountInput(preselectedAmount.toFixed(2));
              } else if (match.outstanding > 0) {
                setAmountInput(match.outstanding.toFixed(2));
              }
            }
          } else if (shipments.length > 0) {
            // Pick first outstanding shipment if available
            const firstOutstanding = shipments.find((s) => !s.isPaid && s.outstanding > 0);
            if (firstOutstanding) {
              setSelectedShipmentId(firstOutstanding.id);
              setAmountInput((prev) => (!prev ? firstOutstanding.outstanding.toFixed(2) : prev));
            } else {
              setSelectedShipmentId(shipments[0].id);
            }
          }
        })
        .catch((err) => console.error("Error fetching customer shipments:", err))
        .finally(() => setLoadingShipments(false));
    } else {
      setCustomerShipments([]);
    }
  }, [isOpen, selectedCustomerId, preselectedShipmentId, preselectedAmount]);

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setPaymentMethod("CASH");
      setReceiptNumber("");
      setPayerName("");
      setNotes("");
      setAllowOverpayment(false);
      setRequiresOverpaymentConfirm(false);
      setErrorMessage(null);
      setSuccessPayment(null);
      setCustomerSearch("");
      setIsCustomerDropdownOpen(false);
      if (preselectedAmount) {
        setAmountInput(preselectedAmount.toFixed(2));
      }
    }
  }, [isOpen, preselectedAmount]);

  // Selected customer object
  const currentCustomer = useMemo(() => {
    return customers.find(
      (c) =>
        c.id === selectedCustomerId ||
        c.customerIdentifier.toLowerCase() === selectedCustomerId.toLowerCase()
    );
  }, [customers, selectedCustomerId]);

  // Selected shipment object
  const currentShipment = useMemo(() => {
    return customerShipments.find(
      (s) =>
        s.id === selectedShipmentId ||
        s.trackingNumber.toLowerCase() === selectedShipmentId.toLowerCase()
    );
  }, [customerShipments, selectedShipmentId]);

  // Handle shipment selection and auto-fill amount
  const handleSelectShipment = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setRequiresOverpaymentConfirm(false);
    setErrorMessage(null);
    const chosen = customerShipments.find((s) => s.id === shipmentId);
    if (chosen && chosen.outstanding > 0) {
      setAmountInput(chosen.outstanding.toFixed(2));
    }
  };

  // Numerical calculations for live preview
  const numAmount = parseFloat(amountInput) || 0;
  const isAmountValid = !isNaN(numAmount) && numAmount > 0;

  const currentShipmentFee = currentShipment?.fee ?? 0;
  const currentPreviousPaid = currentShipment?.paidAmount ?? 0;
  const currentRemaining = currentShipment ? Math.max(0, currentShipment.outstanding) : 0;
  const calculatedNewRemaining = currentShipment ? Math.max(0, currentRemaining - numAmount) : 0;
  const isOverpayment = currentShipment && currentRemaining > 0 && numAmount > currentRemaining;

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const term = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.customerIdentifier.toLowerCase().includes(term) ||
        (c.phone && c.phone.toLowerCase().includes(term))
    );
  }, [customers, customerSearch]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedCustomerId) {
      setErrorMessage("Please select a customer.");
      return;
    }

    if (!isAmountValid) {
      setErrorMessage("Please enter a valid amount greater than zero.");
      return;
    }

    if (isOverpayment && !allowOverpayment) {
      setRequiresOverpaymentConfirm(true);
      setErrorMessage(
        `Amount (GHS ${numAmount.toFixed(2)}) exceeds remaining balance (GHS ${currentRemaining.toFixed(2)}). Please check the amount or authorize overpayment.`
      );
      return;
    }

    const payload: RecordOfflinePaymentInput = {
      customerId: selectedCustomerId,
      shipmentId: selectedShipmentId || null,
      amount: numAmount,
      paymentMethod,
      paymentDate,
      receiptNumber: receiptNumber.trim() || undefined,
      payerName: payerName.trim() || undefined,
      notes: notes.trim() || undefined,
      allowOverpayment,
    };

    startTransition(async () => {
      try {
        const res = await recordOfflinePaymentAction(payload);
        if (res.error) {
          if (res.requiresOverpaymentConfirm) {
            setRequiresOverpaymentConfirm(true);
          }
          setErrorMessage(res.error);
        } else if (res.success && res.payment) {
          setSuccessPayment(res.payment);
          if (onSuccess) {
            onSuccess(res.payment);
          }
        }
      } catch (err: any) {
        console.error("Submission error:", err);
        setErrorMessage(err?.message || "An unexpected error occurred while recording payment.");
      }
    });
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Record Offline Payment"
      description="Manually record payments received via Cash, Mobile Money, or Bank Transfer."
      icon={<CreditCard size={20} className="text-[#F2901F]" />}
      badge={
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
          Admin Manual Entry
        </span>
      }
      widthClassName="sm:max-w-xl md:max-w-2xl"
    >
      {/* If payment recorded successfully, show rich confirmation & receipt CTA */}
      {successPayment ? (
        <div className="py-6 space-y-6">
          <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-950">Payment Recorded Successfully</h3>
              <p className="text-xs text-emerald-800 mt-1">
                The offline payment has been verified, recorded, and reflected across account balances and audit logs.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-100 shadow-2xs space-y-2 text-xs text-left max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Reference:</span>
                <span className="font-mono font-bold text-[#141B47]">{successPayment.reference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Customer:</span>
                <span className="font-semibold text-[#172236]">{successPayment.customer?.name} ({successPayment.customer?.id})</span>
              </div>
              {successPayment.shipment && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Shipment:</span>
                  <span className="font-mono font-bold text-[#141B47]">{successPayment.shipment.trackingNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#64748B]">Method:</span>
                <span className="font-bold text-emerald-700">{successPayment.paymentMethodLabel}</span>
              </div>
              <div className="flex justify-between text-sm font-black pt-2 border-t border-emerald-100 text-[#141B47]">
                <span>Amount Paid:</span>
                <span className="font-mono text-emerald-700">{formatCurrency(successPayment.amount)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSuccessPayment(null);
                setAmountInput("");
                setReceiptNumber("");
                setNotes("");
              }}
              className="w-full sm:flex-1 h-11 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-gray-50 text-[#172236] flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <RotateCcw size={14} /> Record Another Payment
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 h-11 rounded-xl text-xs font-bold bg-[#141B47] hover:bg-[#202B6D] text-white flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              Done &amp; Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 pb-6">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Payment Error</p>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Customer Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
              Customer Account *
            </label>

            {preselectedCustomerId && currentCustomer ? (
              <div className="p-3 rounded-xl bg-gray-50 border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#172236]">{currentCustomer.name}</p>
                  <p className="text-[11px] font-mono text-[#667085] mt-0.5">
                    {currentCustomer.customerIdentifier} {currentCustomer.phone ? `· ${currentCustomer.phone}` : ""}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Pre-selected
                </span>
              </div>
            ) : (
              <div className="relative">
                <div
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white flex items-center justify-between cursor-pointer hover:border-gray-300 transition-colors"
                >
                  {currentCustomer ? (
                    <div>
                      <span className="font-bold text-[#172236] mr-2">{currentCustomer.name}</span>
                      <span className="font-mono text-xs text-[#667085]">({currentCustomer.customerIdentifier})</span>
                    </div>
                  ) : (
                    <span className="text-[#94A3B8]">Select a customer...</span>
                  )}
                  <ChevronDown size={16} className="text-[#667085]" />
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-[#E5E7EB] p-2 z-30 max-h-60 overflow-y-auto">
                    <div className="relative mb-2">
                      <input
                        type="text"
                        placeholder="Search customer name or ID..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 h-9 rounded-lg text-xs border border-[#E5E7EB] focus:outline-none focus:border-[#F2901F]"
                        autoFocus
                      />
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                    </div>

                    <div className="divide-y divide-gray-100">
                      {filteredCustomers.length === 0 ? (
                        <p className="text-xs text-[#667085] py-3 text-center">No matching customers found.</p>
                      ) : (
                        filteredCustomers.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-colors ${
                              c.id === selectedCustomerId ? "bg-amber-50 text-[#141B47]" : "hover:bg-gray-50"
                            }`}
                          >
                            <div>
                              <p className="font-bold text-[#172236]">{c.name}</p>
                              <p className="text-[11px] font-mono text-[#667085]">{c.customerIdentifier} {c.phone ? `· ${c.phone}` : ""}</p>
                            </div>
                            {c.id === selectedCustomerId && <Check size={14} className="text-amber-600 font-bold" />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shipment / Invoice Link */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Shipment / Invoice (Optional)
              </label>
              {customerShipments.length > 0 && (
                <span className="text-[11px] text-[#667085]">
                  {customerShipments.length} shipment(s) on file
                </span>
              )}
            </div>

            {loadingShipments ? (
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-[#667085] flex items-center gap-2">
                <span className="animate-spin text-amber-500">⏳</span> Loading customer consignments...
              </div>
            ) : customerShipments.length === 0 ? (
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-[#667085]">
                No shipments found for this customer. Payment will be recorded as a general account payment.
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedShipmentId}
                  onChange={(e) => handleSelectShipment(e.target.value)}
                  className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] font-mono cursor-pointer"
                >
                  <option value="">-- No specific shipment (General Account Payment) --</option>
                  {customerShipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.trackingNumber} — Fee: GHS {s.fee.toFixed(2)} | Outstanding: GHS {s.outstanding.toFixed(2)} {s.isPaid ? "(Paid)" : ""}
                    </option>
                  ))}
                </select>

                {/* Selected Shipment Summary Card */}
                {currentShipment && (
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#141B47] flex items-center gap-1.5 font-mono">
                        <Package size={14} className="text-[#64748B]" /> {currentShipment.trackingNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        currentShipment.isPaid
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : currentShipment.paidAmount > 0
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-red-100 text-red-800 border border-red-200"
                      }`}>
                        {currentShipment.isPaid ? "Settled" : currentShipment.paidAmount > 0 ? "Partially Paid" : "Unpaid"}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#64748B] line-clamp-1">{currentShipment.description}</p>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase font-bold">Total Fee</p>
                        <p className="font-mono font-bold text-[#172236]">GHS {currentShipment.fee.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase font-bold">Already Paid</p>
                        <p className="font-mono font-bold text-emerald-600">GHS {currentShipment.paidAmount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase font-bold">Outstanding</p>
                        <p className="font-mono font-extrabold text-[#141B47]">GHS {currentShipment.outstanding.toFixed(2)}</p>
                      </div>
                    </div>

                    {currentShipment.outstanding > 0 && amountInput !== currentShipment.outstanding.toFixed(2) && (
                      <button
                        type="button"
                        onClick={() => setAmountInput(currentShipment.outstanding.toFixed(2))}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer pt-1"
                      >
                        <Sparkles size={12} /> Auto-fill full balance: GHS {currentShipment.outstanding.toFixed(2)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Amount & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount Received */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Amount Received (GH₵) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#667085]">
                  GHS
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-12 pr-4 h-11 rounded-xl text-sm border focus:outline-none focus:border-[#F2901F] transition-colors bg-white font-mono font-bold text-[#172236] border-[#E5E7EB]"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] font-semibold cursor-pointer"
              >
                <option value="CASH">Cash (Warehouse / Desk)</option>
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="TELECEL_CASH">Telecel Cash</option>
                <option value="AT_MONEY">AT Money</option>
                <option value="BANK_TRANSFER">Bank Transfer / Deposit</option>
                <option value="OTHER">Other Offline Channel</option>
              </select>
            </div>
          </div>

          {/* Payment Date & Reference Slip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Payment Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] cursor-pointer"
                  required
                />
              </div>
            </div>

            {/* Transaction Ref / Receipt Number */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Receipt / Slip # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. MOMO-98231 / SLIP-0042"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236] font-mono"
              />
            </div>
          </div>

          {/* Payer Name & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Payer&apos;s Name (If different)
              </label>
              <input
                type="text"
                placeholder={currentCustomer ? currentCustomer.name : "Payer Name"}
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#667085]">
                Internal Notes / Description
              </label>
              <input
                type="text"
                placeholder="e.g. Paid in cash at Accra warehouse desk"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
            </div>
          </div>

          {/* Overpayment Warning & Authorization Checkbox */}
          {isOverpayment && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2.5">
              <div className="flex items-start gap-2 text-amber-900 font-bold">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <span>Overpayment Warning</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                The entered amount (<strong>GHS {numAmount.toFixed(2)}</strong>) exceeds the remaining balance of (<strong>GHS {currentRemaining.toFixed(2)}</strong>) by <strong>GHS {(numAmount - currentRemaining).toFixed(2)}</strong>.
              </p>
              <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-amber-950">
                <input
                  type="checkbox"
                  checked={allowOverpayment}
                  onChange={(e) => setAllowOverpayment(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                />
                <span>I authorize this overpayment recording.</span>
              </label>
            </div>
          )}

          {/* Live Balance Impact Preview */}
          {currentShipment && isAmountValid && (
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Balance Impact Preview
              </span>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[#64748B]">Remaining before payment:</span>
                <span className="font-mono font-bold text-[#141B47]">GHS {currentRemaining.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#64748B]">This payment:</span>
                <span className="font-mono font-bold text-emerald-600">−GHS {numAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                <span className="font-extrabold text-[#141B47]">New remaining balance:</span>
                <span className={`font-mono font-black text-sm ${calculatedNewRemaining === 0 ? "text-emerald-700" : "text-[#141B47]"}`}>
                  GHS {calculatedNewRemaining.toFixed(2)}
                  {calculatedNewRemaining === 0 && (
                    <span className="ml-2 text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Settled
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 h-11 rounded-xl text-xs font-bold text-[#667085] hover:text-[#172236] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !isAmountValid || (isOverpayment && !allowOverpayment)}
              className="px-6 h-11 rounded-xl text-xs sm:text-sm font-bold bg-[#141B47] hover:bg-[#202B6D] text-white flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>Recording Payment...</>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Record Payment (GHS {numAmount > 0 ? numAmount.toFixed(2) : "0.00"})
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </AdminDrawer>
  );
}
