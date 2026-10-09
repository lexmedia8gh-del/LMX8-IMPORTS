"use client";

import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { changeCustomerPinAction } from "@/app/actions/customer-pin";

export function CustomerChangePinCard() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Client-side quick validation
    if (!currentPin || !newPin || !confirmPin) {
      setError("Please complete all three PIN fields.");
      return;
    }

    if (newPin !== confirmPin) {
      setError("New PIN and Confirm PIN do not match.");
      return;
    }

    if (newPin.length < 6 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      setError("New PIN must be between 6 and 8 numbers (digits only).");
      return;
    }

    if (currentPin === newPin) {
      setError("Your new PIN cannot be the same as your current PIN.");
      return;
    }

    setLoading(true);

    try {
      const res = await changeCustomerPinAction(currentPin, newPin, confirmPin);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(res.message || "Your PIN was updated successfully!");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to update PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xs overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#F1F5F9] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F2901F] flex items-center justify-center shrink-0 border border-amber-200">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#172236]">Security PIN</h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Change your 6-digit access PIN for portal login.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck size={14} /> Encrypted
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
        {/* Error Feedback */}
        {error && (
          <div className="p-3.5 rounded-xl text-xs font-semibold bg-red-50 text-red-800 border border-red-200 flex items-start gap-2.5">
            <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Feedback */}
        {success && (
          <div className="p-3.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Current PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#172236] block">
              Current PIN
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                required
                placeholder="Enter current PIN"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full h-12 pl-4 pr-12 rounded-xl text-sm font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                aria-label={showCurrent ? "Hide current PIN" : "Show current PIN"}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New PIN & Confirm PIN Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* New PIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#172236] block">
                New PIN (6-8 digits)
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="6-8 numbers"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full h-12 pl-4 pr-12 rounded-xl text-sm font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                  aria-label={showNew ? "Hide new PIN" : "Show new PIN"}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm New PIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#172236] block">
                Confirm New PIN
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  required
                  placeholder="Re-enter new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full h-12 pl-4 pr-12 rounded-xl text-sm font-mono tracking-widest border border-[#E5E7EB] bg-white focus:outline-none focus:border-[#F2901F] text-[#172236]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                  aria-label={showConfirm ? "Hide confirm PIN" : "Show confirm PIN"}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Validation hint */}
        <p className="text-[11px] text-[#667085] leading-relaxed">
          PIN must be 6 to 8 numeric digits. For security, never use common sequences like 123456 or your date of birth.
        </p>

        {/* Submit Button */}
        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={loading || !currentPin || !newPin || !confirmPin}
            className="w-full sm:w-auto px-6 h-12 rounded-xl text-xs font-bold text-white bg-[#141B47] hover:bg-[#355DAF] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2"
          >
            <Lock size={15} />
            {loading ? "Updating PIN..." : "Update Security PIN"}
          </button>
        </div>
      </form>
    </div>
  );
}
