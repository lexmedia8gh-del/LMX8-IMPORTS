"use client";

import React, { useState, useEffect } from "react";
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  Trash2,
  Calendar,
  CreditCard,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import {
  recordExpenseAction,
  deleteExpenseAction,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_LABELS,
} from "@/app/actions/analytics";
import { formatCurrency } from "@/lib/currency";

interface ExpensesManagerProps {
  onRefreshParent?: () => void;
}

export function ExpensesManager({ onRefreshParent }: ExpensesManagerProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [showModal, setShowModal] = useState(false);

  // New expense form states
  const [category, setCategory] = useState("CUSTOMS_CLEARANCE");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [payee, setPayee] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Query expenses using a lightweight internal loader
  const loadExpenses = async () => {
    setLoading(true);
    try {
      // In server action we can query last 100 expenses or from API
      const res = await fetch("/api/admin/expenses").then((r) => r.json()).catch(() => null);
      if (res && res.expenses) {
        setExpenses(res.expenses);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc || !amount) return;

    setSaving(true);
    try {
      await recordExpenseAction({
        category,
        description: desc,
        amount: parseFloat(amount),
        paymentMethod,
        payee: payee || undefined,
        reference: ref || undefined,
        notes: notes || undefined,
        date,
      });

      setShowModal(false);
      setDesc("");
      setAmount("");
      setPayee("");
      setRef("");
      setNotes("");
      setMsg("Expense recorded successfully.");
      await loadExpenses();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err?.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense record?")) return;
    try {
      await deleteExpenseAction(id);
      await loadExpenses();
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err?.message || "Failed to delete expense.");
    }
  };

  const filtered = expenses.filter((e) => {
    const matchSearch =
      (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.payee || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.expenseNumber || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "ALL" ? true : e.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const totalFiltered = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-2xs space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
        <div>
          <h3 className="font-bold text-base text-[#141B47] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-rose-600" />
            Operational Expense Tracking &amp; Ledgers
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Log, categorize, and audit freight handling, port clearance, and office operational disbursements.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-[#141B47] hover:bg-[#1C255E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs min-h-[38px]"
          >
            <PlusCircle className="w-4 h-4 text-[#F2901F]" />
            <span>Record New Expense</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses, payee, or ref..."
              className="w-full pl-8 pr-3 py-1.5 border border-[#CBD5E1] rounded-xl focus:outline-hidden focus:border-[#355DAF]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([cat, label]) => (
              <option key={cat} value={cat}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-[#64748B]">Total Displayed: </span>
          <span className="text-sm font-black text-rose-700">{formatCurrency(totalFiltered)}</span>
        </div>
      </div>

      {/* Expenses Table */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] animate-pulse">
          Loading expense records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
          No recorded expenses match your filters. Click &quot;Record New Expense&quot; to log an outflow.
        </div>
      ) : (
        <div className="overflow-x-auto border border-[#E2E8F0] rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Expense #</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Payee / Vendor</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3 text-right">Amount</th>
                <th className="py-2.5 px-3">Recorded By</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {filtered.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50/70">
                  <td className="py-2 px-3 font-mono text-[#64748B]">
                    {new Date(exp.date).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-[#141B47]">
                    {exp.expenseNumber}
                  </td>
                  <td className="py-2 px-3 font-semibold text-[#141B47]">
                    {EXPENSE_CATEGORIES[exp.category] || exp.category}
                  </td>
                  <td className="py-2 px-3 text-[#475569]">{exp.description}</td>
                  <td className="py-2 px-3 text-[#64748B]">{exp.payee || "—"}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[11px] font-semibold text-[#141B47]">
                      {PAYMENT_METHOD_LABELS[exp.paymentMethod] || exp.paymentMethod}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-black text-rose-700">
                    {formatCurrency(exp.amount)}
                  </td>
                  <td className="py-2 px-3 text-[#64748B] text-[11px]">{exp.recordedByName || "Admin"}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-[#CBD5E1]">
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="font-bold text-base text-[#141B47] flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                Record Operational Expense
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs text-[#141B47]">
              <div>
                <label className="font-bold block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  required
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
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
                <label className="font-bold block mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
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
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
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
                  <label className="font-bold block mb-1">Payee / Authority</label>
                  <input
                    type="text"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    placeholder="e.g. Ghana Revenue Authority"
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Receipt / Voucher #</label>
                  <input
                    type="text"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="e.g. VCH-0029"
                    className="w-full p-2 border border-[#CBD5E1] rounded-xl font-medium focus:outline-hidden focus:border-[#355DAF]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#64748B] hover:bg-gray-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#141B47] hover:bg-[#1C255E] rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
