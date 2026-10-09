"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminDrawer } from "@/components/admin-drawer";
import { createCustomerAction } from "@/app/actions/customers";
import { UserPlus, User, Phone, Mail, Lock, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface CreateCustomerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateCustomerDrawer({
  isOpen,
  onClose,
  onSuccess,
}: CreateCustomerDrawerProps) {
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [confirmPin, setConfirmPin] = useState<string>("");
  const [status, setStatus] = useState<string>("ACTIVE");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setPhone("");
      setEmail("");
      setPin("");
      setConfirmPin("");
      setStatus("ACTIVE");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const isDirty = useMemo(() => {
    return name.trim().length > 0 || phone.trim().length > 0 || pin.length > 0;
  }, [name, phone, pin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !phone.trim() || !pin || !confirmPin) {
      setErrorMessage("Full Name, Phone Number, and Customer PIN are required.");
      return;
    }

    if (pin !== confirmPin) {
      setErrorMessage("PIN and Confirmation PIN do not match.");
      return;
    }

    if (pin.length < 6 || pin.length > 8 || !/^\d+$/.test(pin)) {
      setErrorMessage("PIN must be between 6 and 8 numeric digits.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      formData.append("email", email.trim());
      formData.append("pin", pin);
      formData.append("confirmPin", confirmPin);
      formData.append("status", status);

      const res = await createCustomerAction(formData);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error("[CreateCustomerDrawer] Error creating customer:", err);
      // If Next.js redirect threw NEXT_REDIRECT, handle gracefully
      if (err?.message?.includes("NEXT_REDIRECT")) {
        if (onSuccess) onSuccess();
        onClose();
        return;
      }
      setErrorMessage(err?.message || "Failed to create customer account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Create Customer Account"
      description="Register a new customer account with customer identifier and portal PIN."
      icon={<UserPlus size={20} />}
      isDirty={isDirty}
      widthClassName="sm:max-w-md md:max-w-lg"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <UserPlus size={14} />
                <span>Create Customer</span>
              </>
            )}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Registration failed</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <User size={14} className="text-[#355DAF]" /> Full Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Mensah"
            className="w-full px-3.5 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <Phone size={14} className="text-[#355DAF]" /> Phone Number *
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0541234567"
            className="w-full px-3.5 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
            <Mail size={14} className="text-[#355DAF]" /> Email Address (Optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. alex@example.com"
            className="w-full px-3.5 h-11 rounded-xl text-xs border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#F1F5F9]">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
              <Lock size={13} className="text-[#F2901F]" /> 6-8 Digit PIN *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              className="w-full px-3.5 h-11 rounded-xl text-xs font-mono tracking-widest text-center border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#141B47] flex items-center gap-1.5">
              <Lock size={13} className="text-[#F2901F]" /> Confirm PIN *
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              required
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="••••••"
              className="w-full px-3.5 h-11 rounded-xl text-xs font-mono tracking-widest text-center border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236]"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900 flex items-start gap-2">
          <CheckCircle2 size={14} className="text-blue-600 shrink-0 mt-0.5" />
          <span>This Login PIN will be automatically included in the official account credentials email sent to the client upon creation.</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#141B47]">Account Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3.5 h-11 rounded-xl text-xs font-semibold border border-[#E5E7EB] bg-white focus:outline-hidden focus:border-[#F2901F] text-[#172236] cursor-pointer"
          >
            <option value="ACTIVE">ACTIVE (Access Granted)</option>
            <option value="INACTIVE">INACTIVE (Access Suspended)</option>
          </select>
        </div>
      </form>
    </AdminDrawer>
  );
}
