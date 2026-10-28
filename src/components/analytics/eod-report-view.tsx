"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import {
  Calendar,
  Printer,
  Download,
  Save,
  Lock,
  Unlock,
  PlusCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  CreditCard,
  Truck,
  Receipt,
  Users,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ChevronDown,
  Info,
} from "lucide-react";
import {
  generateEodReportData,
  saveEodDraftAction,
  finalizeEodReportAction,
  reopenEodReportAction,
  deleteExpenseAction,
  recordExpenseAction,
  EodReportData,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
} from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

interface EodReportViewProps {
  onRefreshParent?: () => void;
}

export function EodReportView({ onRefreshParent }: EodReportViewProps) {
  // Today's date in Africa/Accra UTC+0
  const getTodayAccraStr = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  };

  const [businessDate, setBusinessDate] = useState<string>(getTodayAccraStr());
  const [report, setReport] = useState<EodReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();

  // Form states for EOD editing
  const [openingCash, setOpeningCash] = useState<number>(0);
  const [actualClosingCash, setActualClosingCash] = useState<string>("");
  const [reconciliationNotes, setReconciliationNotes] = useState<string>("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Expense modal states
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [expCategory, setExpCategory] = useState<string>("CUSTOMS_CLEARANCE");
  const [expDesc, setExpDesc] = useState<string>("");
  const [expAmount, setExpAmount] = useState<string>("");
  const [expMethod, setExpMethod] = useState<string>("CASH");
  const [expPayee, setExpPayee] = useState<string>("");
  const [expRef, setExpRef] = useState<string>("");
  const [expSaving, setExpSaving] = useState<boolean>(false);

  // Reopen prompt state
  const [showReopenPrompt, setShowReopenPrompt] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");

  const loadReport = useCallback(async (date: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await generateEodReportData(date);
      setReport(data);
      setOpeningCash(data.financialSummary.openingCash);
      setActualClosingCash(
        data.financialSummary.actualClosingCash !== null
          ? data.financialSummary.actualClosingCash.toString()
          : ""
      );
      setReconciliationNotes(data.dailyReconciliation.notes || "");
    } catch (err: any) {
      console.error("[EodReportView] Error loading report:", err);
      setMessage({ type: "error", text: err?.message || "Failed to load report for selected date." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(businessDate);
  }, [businessDate, loadReport]);

  const handleDateChange = (newDate: string) => {
    setBusinessDate(newDate);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    startTransition(async () => {
      try {
        const cashVal = actualClosingCash !== "" ? parseFloat(actualClosingCash) : null;
        const res = await saveEodDraftAction({
          businessDate,
          openingCash,
          actualClosingCash: cashVal,
          notes: reconciliationNotes,
        });
        setMessage({ type: "success", text: res.message });
        await loadReport(businessDate);
        if (onRefreshParent) onRefreshParent();
      } catch (err: any) {
        setMessage({ type: "error", text: err?.message || "Failed to save draft." });
      }
    });
  };

  // Finalize Report
  const handleFinalize = async () => {
    if (actualClosingCash === "") {
      setMessage({
        type: "error",
        text: "Please enter the actual cash counted before finalizing the report.",
      });
      return;
    }

    const confirmFinalize = window.confirm(
      "Are you sure you want to finalize and lock the End-of-Day report for " +
        businessDate +
        "? This creates an audited snapshot."
    );
    if (!confirmFinalize) return;

    startTransition(async () => {
      try {
        const res = await finalizeEodReportAction({
          businessDate,
          openingCash,
          actualClosingCash: parseFloat(actualClosingCash),
          notes: reconciliationNotes,
        });
        setMessage({ type: "success", text: res.message });
        await loadReport(businessDate);
        if (onRefreshParent) onRefreshParent();
      } catch (err: any) {
        setMessage({ type: "error", text: err?.message || "Failed to finalize report." });
      }
    });
  };

  // Reopen Report
  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      setMessage({ type: "error", text: "Please provide a reason for reopening this finalized report." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await reopenEodReportAction(businessDate, reopenReason);
        setMessage({ type: "success", text: res.message });
        setShowReopenPrompt(false);
        setReopenReason("");
        await loadReport(businessDate);
        if (onRefreshParent) onRefreshParent();
      } catch (err: any) {
        setMessage({ type: "error", text: err?.message || "Failed to reopen report." });
      }
    });
  };

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount || parseFloat(expAmount) <= 0) return;

    setExpSaving(true);
    try {
      await recordExpenseAction({
        category: expCategory,
        description: expDesc.trim(),
        amount: parseFloat(expAmount),
        paymentMethod: expMethod,
        payee: expPayee.trim() || undefined,
        reference: expRef.trim() || undefined,
        date: businessDate,
      });

      setShowExpenseModal(false);
      setExpDesc("");
      setExpAmount("");
      setExpPayee("");
      setExpRef("");
      setMessage({ type: "success", text: "Expense recorded successfully." });
      await loadReport(businessDate);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to record expense." });
    } finally {
      setExpSaving(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: string) => {
    if (report?.reportHeader.status === "FINALIZED") {
      alert("Cannot delete expenses on a finalized report. Reopen the report first.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;

    try {
      await deleteExpenseAction(id);
      setMessage({ type: "success", text: "Expense deleted." });
      await loadReport(businessDate);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to delete expense." });
    }
  };

  // Print Trigger
  const handlePrint = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!report) return;

    const rows: string[][] = [
      ["LMX8 IMPORTS - END-OF-DAY BUSINESS REPORT"],
      ["Report Number", report.reportHeader.reportNumber],
      ["Business Date", report.reportHeader.businessDate],
      ["Status", report.reportHeader.status],
      ["Prepared By", report.reportHeader.preparedBy],
      ["Generated At", report.reportHeader.generatedAt],
      [],
      ["--- FINANCIAL SUMMARY ---"],
      ["Opening Cash", report.financialSummary.openingCash.toFixed(2)],
      ["Total Invoiced", report.financialSummary.totalInvoiced.toFixed(2)],
      ["Total Collections", report.financialSummary.totalCollections.toFixed(2)],
      ["Total Expenses", report.financialSummary.totalExpenses.toFixed(2)],
      ["Net Cash Movement", report.financialSummary.netCashMovement.toFixed(2)],
      ["Expected Closing Cash", report.financialSummary.expectedClosingCash.toFixed(2)],
      ["Actual Closing Cash", report.financialSummary.actualClosingCash !== null ? report.financialSummary.actualClosingCash.toFixed(2) : "N/A"],
      ["Cash Variance", report.financialSummary.cashVariance.toFixed(2)],
      ["Total Receivables Outstanding", report.financialSummary.receivablesTotal.toFixed(2)],
      [],
      ["--- COLLECTIONS BY PAYMENT METHOD ---"],
      ["Payment Method", "Amount (GHS)"],
      ...Object.entries(report.financialSummary.collectionsByMethod).map(([m, amt]) => [
        PAYMENT_METHOD_LABELS[m] || m,
        amt.toFixed(2),
      ]),
      [],
      ["--- PAYMENT TRANSACTIONS LEDGER ---"],
      ["Time", "Type", "Reference", "Client Name", "Client ID", "Payment Method", "Transaction Ref", "Amount (GHS)", "Recorded By"],
      ...report.paymentLedger.map((p) => [
        new Date(p.time).toLocaleTimeString(),
        p.type,
        p.sourceRef,
        `"${p.clientName}"`,
        p.clientIdentifier,
        p.paymentMethodLabel,
        `"${p.reference}"`,
        p.amount.toFixed(2),
        `"${p.recordedBy}"`,
      ]),
      [],
      ["--- EXPENSES LEDGER ---"],
      ["Time", "Expense #", "Category", "Payee", "Description", "Payment Method", "Amount (GHS)", "Recorded By"],
      ...report.expenseLedger.map((e) => [
        new Date(e.time).toLocaleTimeString(),
        e.expenseNumber,
        e.categoryLabel,
        `"${e.payee}"`,
        `"${e.description.replace(/"/g, '""')}"`,
        e.paymentMethodLabel,
        e.amount.toFixed(2),
        `"${e.recordedBy}"`,
      ]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LMX8_EOD_${report.reportHeader.businessDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isFinalized = report?.reportHeader.status === "FINALIZED";

  // Calculate live expected cash based on inputs
  const calculatedExpectedCash = report
    ? openingCash +
      (report.financialSummary.collectionsByMethod["CASH"] || 0) -
      report.expenseLedger
        .filter((e) => e.paymentMethod === "CASH")
        .reduce((sum, e) => sum + e.amount, 0)
    : 0;

  const currentCountVal = actualClosingCash !== "" ? parseFloat(actualClosingCash) : null;
  const liveVariance = currentCountVal !== null ? currentCountVal - calculatedExpectedCash : 0;

  return (
    <div className="space-y-6">
      {/* ── TOP CONTROLS BAR (Hidden on Print) ── */}
      <div className="print:hidden bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Business Date Picker */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-blue-50 text-[#141B47]">
              <Calendar className="w-5 h-5 text-[#F2901F]" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                Select Business Date (Accra Timezone)
              </label>
              <input
                type="date"
                value={businessDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="mt-0.5 px-3 py-1.5 border border-[#CBD5E1] rounded-xl text-sm font-bold text-[#141B47] bg-[#F8FAFC] focus:bg-white focus:outline-hidden focus:border-[#355DAF]"
              />
            </div>
            <button
              onClick={() => loadReport(businessDate)}
              disabled={loading}
              className="p-2 mt-4 text-[#64748B] hover:text-[#141B47] hover:bg-[#F1F5F9] rounded-xl transition-colors cursor-pointer"
              title="Refresh report records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#355DAF]" : ""}`} />
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowExpenseModal(true)}
              className="px-3.5 py-2 text-xs font-bold text-[#141B47] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]"
            >
              <PlusCircle className="w-4 h-4 text-[#F2901F]" />
              <span>Record Expense</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={!report || loading}
              className="px-3.5 py-2 text-xs font-bold text-[#141B47] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px] disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-[#355DAF]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={!report || loading}
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#141B47] hover:bg-[#1C255E] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px] shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Status Alerts & Feedback */}
        {message && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : message.type === "error"
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Discrepancy warning if finalized but live records changed */}
        {report?.dailyReconciliation.hasRecordChangesSinceFinalization && (
          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold">Records Modified Since Finalization!</h5>
                <p className="mt-0.5 text-amber-800">
                  {report.dailyReconciliation.recordChangesDescription}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReopenPrompt(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 cursor-pointer"
            >
              Reopen &amp; Reconcile
            </button>
          </div>
        )}
      </div>

      {/* ── REOPEN PROMPT MODAL ── */}
      {showReopenPrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl border border-[#CBD5E1]">
            <div className="flex items-center gap-2 text-amber-600">
              <Unlock className="w-5 h-5" />
              <h3 className="font-bold text-base text-[#141B47]">Reopen Finalized Report</h3>
            </div>
            <p className="text-xs text-[#64748B]">
              This report was previously finalized. Please provide an administrative reason to
              unlock it for adjustments.
            </p>
            <div>
              <label className="text-xs font-bold text-[#141B47] block mb-1">Reason for Reopening</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Adding delayed clearance receipt voucher..."
                className="w-full h-20 p-2.5 border border-[#CBD5E1] rounded-xl text-xs font-medium focus:outline-hidden focus:border-[#355DAF]"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenPrompt(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-[#64748B] hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={isPending || !reopenReason.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {isPending ? "Unlocking..." : "Confirm Unlock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RECORD EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-[#CBD5E1]">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="font-bold text-base text-[#141B47] flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                Record Operational Expense
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5 text-xs text-[#141B47]">
              <div>
                <label className="font-bold block mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                >
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">Description / Details</label>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="e.g. Tema port terminal handling voucher"
                  required
                  className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Amount (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Payment Method</label>
                  <select
                    value={expMethod}
                    onChange={(e) => setExpMethod(e.target.value)}
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Payee / Vendor (Optional)</label>
                  <input
                    type="text"
                    value={expPayee}
                    onChange={(e) => setExpPayee(e.target.value)}
                    placeholder="e.g. Ghana Ports and Harbours"
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Receipt / Ref # (Optional)</label>
                  <input
                    type="text"
                    value={expRef}
                    onChange={(e) => setExpRef(e.target.value)}
                    placeholder="e.g. RCT-88492"
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#64748B] hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#141B47] hover:bg-[#1C255E] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {expSaving ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── THE PRINTABLE END-OF-DAY REPORT DOCUMENT ── */}
      {loading ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center text-gray-500 animate-pulse">
          Generating End-of-Day Report for {businessDate}...
        </div>
      ) : !report ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-12 text-center text-gray-500">
          Could not generate report for {businessDate}.
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-sm p-6 sm:p-8 space-y-8 print:p-0 print:border-none print:shadow-none">
          {/* ── SECTION 1: REPORT HEADER ── */}
          <div className="border-b-2 border-[#141B47] pb-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Brand Letterhead */}
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-[#141B47] tracking-tight">
                    LMX8 IMPORTS
                  </span>
                  <span className="text-xs font-bold px-2.5 py-1 bg-[#141B47] text-white rounded-md tracking-wider">
                    CTRL ROOM
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-1">
                  Freight Forwarding, Cargo Logistics &amp; Sourcing • Accra, Ghana
                </p>
              </div>

              {/* Status Badge */}
              <div className="text-left sm:text-right">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isFinalized
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {isFinalized ? (
                    <>
                      <Lock className="w-3.5 h-3.5" /> Finalized Report
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" /> Draft Report
                    </>
                  )}
                </span>
                <div className="text-[11px] text-[#94A3B8] mt-1 font-mono">
                  Ref: {report.reportHeader.reportNumber}
                </div>
              </div>
            </div>

            {/* Document Title & Meta Grid */}
            <div className="pt-2">
              <h2 className="text-xl sm:text-2xl font-black text-[#141B47] tracking-tight uppercase">
                End-of-Day Business Report
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
              <div>
                <span className="text-[#64748B] block font-medium">Business Date</span>
                <span className="font-bold text-[#141B47] font-mono text-sm">
                  {report.reportHeader.businessDate}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Prepared By</span>
                <span className="font-bold text-[#141B47]">
                  {report.reportHeader.preparedBy}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Generated At</span>
                <span className="font-semibold text-[#141B47]">
                  {new Date(report.reportHeader.generatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Sign-Off Status</span>
                <span className="font-bold text-[#141B47]">
                  {isFinalized
                    ? `Finalized by ${report.reportHeader.finalizedBy || "Admin"}`
                    : "Draft (Pending Final Count)"}
                </span>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: FINANCIAL SUMMARY ── */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#F2901F]" />
              1. Daily Financial Summary &amp; Cash Movement
            </h3>

            {/* Top Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Invoices Issued Today</span>
                <div className="text-xl font-black text-[#141B47]">
                  {formatCurrency(report.financialSummary.totalInvoiced)}
                </div>
                <span className="text-[10px] text-[#94A3B8]">
                  {report.invoiceReport.invoicesCreated.length} invoice(s) generated
                </span>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase">Collections Received</span>
                <div className="text-xl font-black text-emerald-700">
                  {formatCurrency(report.financialSummary.totalCollections)}
                </div>
                <span className="text-[10px] text-emerald-800">
                  {report.paymentLedger.length} transaction(s) settled
                </span>
              </div>

              <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-rose-800 uppercase">Operational Expenses</span>
                <div className="text-xl font-black text-rose-700">
                  {formatCurrency(report.financialSummary.totalExpenses)}
                </div>
                <span className="text-[10px] text-rose-800">
                  {report.expenseLedger.length} expense voucher(s)
                </span>
              </div>

              <div className="p-4 bg-[#141B47] text-white rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-blue-200 uppercase">Net Daily Cash Movement</span>
                <div className="text-xl font-black text-white">
                  {formatCurrency(report.financialSummary.netCashMovement)}
                </div>
                <span className="text-[10px] text-blue-300">
                  Collections minus Expenses
                </span>
              </div>
            </div>

            {/* Cash Drawer Reconciliation Box */}
            <div className="p-4 sm:p-5 bg-white border-2 border-[#141B47] rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h4 className="font-bold text-sm text-[#141B47] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Physical Cash Drawer Reconciliation
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Reconciliation of physical paper cash held in the office drawer.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#64748B]">Accounts Receivable as of EOD: </span>
                  <span className="text-xs font-black text-[#141B47]">
                    {formatCurrency(report.financialSummary.receivablesTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                {/* Opening Cash Input */}
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B]">Opening Cash (Morning)</label>
                  {isFinalized ? (
                    <div className="p-2 font-mono font-bold text-[#141B47] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg">
                      {formatCurrency(openingCash)}
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={openingCash}
                      onChange={(e) => setOpeningCash(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 font-mono font-bold text-[#141B47] border border-[#CBD5E1] rounded-lg bg-white"
                    />
                  )}
                </div>

                {/* Cash Collections & Outflows */}
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B]">Net Cash In/Out</label>
                  <div className="p-2 font-mono font-bold text-[#141B47] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg">
                    +{formatCurrency(report.financialSummary.collectionsByMethod["CASH"] || 0)} / -
                    {formatCurrency(
                      report.expenseLedger
                        .filter((e) => e.paymentMethod === "CASH")
                        .reduce((s, e) => s + e.amount, 0)
                    )}
                  </div>
                </div>

                {/* Expected Closing Cash */}
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B]">Expected Closing Cash</label>
                  <div className="p-2 font-mono font-black text-[#141B47] bg-blue-50/50 border border-blue-200 rounded-lg">
                    {formatCurrency(calculatedExpectedCash)}
                  </div>
                </div>

                {/* Actual Closing Cash Count */}
                <div className="space-y-1">
                  <label className="font-bold text-[#64748B]">Actual Physical Cash Count</label>
                  {isFinalized ? (
                    <div className="p-2 font-mono font-black text-[#141B47] bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg">
                      {actualClosingCash !== ""
                        ? formatCurrency(parseFloat(actualClosingCash))
                        : "Not recorded"}
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={actualClosingCash}
                      onChange={(e) => setActualClosingCash(e.target.value)}
                      placeholder="Counted cash..."
                      className="w-full p-2 font-mono font-black text-[#141B47] border border-[#CBD5E1] rounded-lg bg-white"
                    />
                  )}
                </div>
              </div>

              {/* Variance Indicator */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-[#F1F5F9] text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#64748B]">Cash Drawer Variance:</span>
                  {currentCountVal === null ? (
                    <span className="font-semibold text-gray-500">Awaiting actual count</span>
                  ) : Math.abs(liveVariance) < 0.01 ? (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Balanced (GH₵ 0.00 Variance)
                    </span>
                  ) : liveVariance > 0 ? (
                    <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Surplus: +{formatCurrency(liveVariance)}
                    </span>
                  ) : (
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Shortage: -{formatCurrency(Math.abs(liveVariance))}
                    </span>
                  )}
                </div>

                {/* Collections by Method Pills */}
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {Object.entries(report.financialSummary.collectionsByMethod)
                    .filter(([_, amt]) => amt > 0)
                    .map(([method, amt]) => (
                      <span
                        key={method}
                        className="px-2 py-0.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md font-semibold text-[#141B47]"
                      >
                        {PAYMENT_METHOD_LABELS[method] || method}: {formatCurrency(amt)}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 3: DETAILED PAYMENT LEDGER ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#355DAF]" />
                2. Payments &amp; Collections Ledger ({report.paymentLedger.length})
              </h3>
              <span className="text-xs font-black text-[#141B47]">
                Total: {formatCurrency(report.financialSummary.totalCollections)}
              </span>
            </div>

            {report.paymentLedger.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                No payment transactions recorded for this business date.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Reference / Bill</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Transaction Ref</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {report.paymentLedger.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/70">
                        <td className="py-2 px-3 font-mono text-[#64748B]">
                          {new Date(p.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-3 font-bold text-[#141B47]">{p.sourceRef}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-[#141B47]">{p.clientName}</span>
                          <span className="text-[10px] text-[#94A3B8] block">{p.clientIdentifier}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-semibold text-[#141B47]">
                            {p.paymentMethodLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[#64748B] text-[11px]">{p.reference}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-700">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="py-2 px-3 text-[#64748B] text-[11px]">{p.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 4: INVOICE REPORT ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#F2901F]" />
                3. Invoice Activity for the Day
              </h3>
              <span className="text-xs text-[#64748B]">
                {report.invoiceReport.invoicesCreated.length} issued •{" "}
                {report.invoiceReport.invoicesSettled.length} settled
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Invoices Created */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase">Invoices Issued Today</h4>
                {report.invoiceReport.invoicesCreated.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    No invoices generated today.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                        <tr>
                          <th className="p-2">Invoice #</th>
                          <th className="p-2">Client</th>
                          <th className="p-2 text-right">Total</th>
                          <th className="p-2 text-right">Balance Due</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {report.invoiceReport.invoicesCreated.map((inv) => (
                          <tr key={inv.id}>
                            <td className="p-2 font-bold text-[#141B47]">{inv.invoiceNumber}</td>
                            <td className="p-2 text-[#475569] truncate max-w-[120px]">{inv.clientName}</td>
                            <td className="p-2 text-right font-bold text-[#141B47]">
                              {formatCurrency(inv.totalAmount)}
                            </td>
                            <td className="p-2 text-right font-semibold text-amber-700">
                              {formatCurrency(inv.outstandingBalance)}
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-[#141B47]">
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Invoices Settled Today */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#64748B] uppercase">Invoices Fully Settled Today</h4>
                {report.invoiceReport.invoicesSettled.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    No invoices marked fully settled today.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                        <tr>
                          <th className="p-2">Invoice #</th>
                          <th className="p-2">Client</th>
                          <th className="p-2 text-right">Settled Amount</th>
                          <th className="p-2">Issued</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        {report.invoiceReport.invoicesSettled.map((inv) => (
                          <tr key={inv.id}>
                            <td className="p-2 font-bold text-[#141B47]">{inv.invoiceNumber}</td>
                            <td className="p-2 text-[#475569] truncate max-w-[120px]">{inv.clientName}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">
                              {formatCurrency(inv.totalAmount)}
                            </td>
                            <td className="p-2 text-[10px] text-[#64748B]">
                              {inv.isIssuedToday ? "Issued Today" : "Prior Invoice"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION 5: SHIPMENT & FREIGHT REPORT ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#355DAF]" />
                4. Shipment &amp; Cargo Freight Movement
              </h3>
              <div className="text-xs space-x-2">
                <span className="font-bold text-emerald-700">
                  Confirmed Freight: {formatCurrency(report.shipmentFreightReport.confirmedFreightRevenue)}
                </span>
                {report.shipmentFreightReport.pendingCargoCount > 0 && (
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {report.shipmentFreightReport.pendingCargoCount} Pending Cargo (Weighing Required)
                  </span>
                )}
              </div>
            </div>

            {report.shipmentFreightReport.shipmentsProcessed.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                No shipments processed or updated on this business date.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Tracking #</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Weight / Volume</th>
                      <th className="py-2.5 px-3 text-right">Freight Charge</th>
                      <th className="py-2.5 px-3">Freight Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {report.shipmentFreightReport.shipmentsProcessed.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/70">
                        <td className="py-2 px-3 font-mono font-bold text-[#141B47]">{s.trackingNumber}</td>
                        <td className="py-2 px-3 text-[#475569]">{s.clientName}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-[#141B47] font-semibold rounded text-[11px]">
                            {s.statusLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#64748B] text-[11px]">
                          {s.weight ? `${s.weight} kg` : "Pending wt."} •{" "}
                          {s.quantity ? `${s.quantity} pcs` : "1 pkg"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-[#141B47]">
                          {formatCurrency(s.freightCharge)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.freightStatus === "CONFIRMED"
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {s.freightStatus === "CONFIRMED" ? "Confirmed" : "Pending Measurement"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 6: OPERATIONAL EXPENSES REPORT ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                5. Operational Expenses ({report.expenseLedger.length})
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-rose-700">
                  Total: {formatCurrency(report.financialSummary.totalExpenses)}
                </span>
                {!isFinalized && (
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="print:hidden text-xs font-bold text-[#355DAF] hover:underline cursor-pointer"
                  >
                    + Add Expense
                  </button>
                )}
              </div>
            </div>

            {report.expenseLedger.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                No operational expenses recorded for this business date.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Voucher #</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Payee</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      {!isFinalized && <th className="py-2.5 px-3 print:hidden">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {report.expenseLedger.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50/70">
                        <td className="py-2 px-3 font-mono text-[#64748B]">
                          {new Date(exp.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-[#141B47]">{exp.expenseNumber}</td>
                        <td className="py-2 px-3 font-semibold text-[#141B47]">{exp.categoryLabel}</td>
                        <td className="py-2 px-3 text-[#475569]">{exp.description}</td>
                        <td className="py-2 px-3 text-[#64748B]">{exp.payee}</td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-semibold text-[#141B47]">
                            {exp.paymentMethodLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-rose-700">
                          {formatCurrency(exp.amount)}
                        </td>
                        {!isFinalized && (
                          <td className="py-2 px-3 print:hidden">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="text-gray-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── SECTION 7: CLIENT ACTIVITY ── */}
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-[#F2901F]" />
                6. Customer Activity
              </h3>
              <span className="text-xs font-semibold text-[#64748B]">
                {report.clientActivity.newClients.length} new client(s) •{" "}
                {report.clientActivity.activeClientsCount} active client(s) today
              </span>
            </div>

            {report.clientActivity.newClients.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                No new clients registered on this business date.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {report.clientActivity.newClients.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[#141B47]">{c.name}</span>
                      <span className="font-mono text-[10px] text-[#355DAF] bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                        {c.customerIdentifier}
                      </span>
                    </div>
                    <div className="text-[#64748B] text-[11px]">
                      {c.phone || "No phone"} • {c.email || "No email"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SECTION 8: RECONCILIATION NOTES & AUDIT TRAIL ── */}
          <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
            <h3 className="text-sm font-bold text-[#141B47] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              7. Daily Reconciliation &amp; Handover Notes
            </h3>

            {/* Handover comments */}
            <div>
              <label className="text-xs font-bold text-[#64748B] block mb-1">
                Shift Handover / Discrepancy Explanation Notes:
              </label>
              {isFinalized ? (
                <div className="p-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#141B47] min-h-[60px]">
                  {reconciliationNotes || "No specific handover notes recorded."}
                </div>
              ) : (
                <textarea
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  placeholder="Record any cash variance explanations, pending checks, or handover instructions for next shift..."
                  className="w-full p-3 border border-[#CBD5E1] rounded-xl text-xs font-medium text-[#141B47] bg-white focus:outline-hidden focus:border-[#355DAF] min-h-[70px]"
                />
              )}
            </div>

            {/* Audit Trail List */}
            {report.auditTrail && report.auditTrail.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <span className="text-[11px] font-bold text-[#64748B] uppercase">Report Audit Trail:</span>
                <div className="space-y-1 text-xs bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                  {report.auditTrail.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[#475569]">
                      <span className="font-mono text-[10px] text-[#94A3B8]">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      <span className="font-bold text-[#141B47]">[{item.action}]</span>
                      <span>by {item.user}:</span>
                      <span className="italic text-[#64748B]">{item.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FINALIZATION / DRAFT ACTION BUTTONS (Hidden on Print) ── */}
            <div className="print:hidden pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#F1F5F9]">
              <div className="text-xs text-[#64748B]">
                {isFinalized ? (
                  <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    <CheckCircle className="w-4 h-4" /> This report is finalized and audited.
                  </span>
                ) : (
                  <span>Ensure actual cash count is completed before finalizing.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isFinalized ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isPending}
                      className="px-4 py-2 text-xs font-bold text-[#141B47] bg-white border border-[#CBD5E1] hover:bg-[#F8FAFC] rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]"
                    >
                      <Save className="w-4 h-4 text-[#355DAF]" />
                      <span>{isPending ? "Saving..." : "Save Draft"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalize}
                      disabled={isPending}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px] shadow-xs"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isPending ? "Finalizing..." : "Finalize & Sign Off"}</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReopenPrompt(true)}
                    className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Reopen Report</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
