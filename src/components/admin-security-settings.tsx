"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Eye, EyeOff, CheckCircle } from "lucide-react";
import { changeAdminPinAction } from "@/app/actions/admin-pin";

export default function AdminSecuritySettings() {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    const currentPin = formData.get("currentPin") as string;
    const newPin = formData.get("newPin") as string;
    const confirmPin = formData.get("confirmPin") as string;

    startTransition(async () => {
      const result = await changeAdminPinAction(currentPin, newPin, confirmPin);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB]">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#F7F9FC] flex items-center justify-center border border-[#E5E7EB]">
          <ShieldCheck size={20} className="text-[#8B5CF6]" />
        </div>
        <div>
          <h3 className="font-bold text-base text-[#172236]">Security — Change Admin PIN</h3>
          <p className="text-xs text-[#667085]">Update your CTRL ROOM administrator PIN.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        {(["currentPin", "newPin", "confirmPin"] as const).map((field, i) => {
          const labels = ["Current PIN", "New PIN", "Confirm New PIN"];
          const shows = [showCurrent, showNew, showConfirm];
          const setShows = [setShowCurrent, setShowNew, setShowConfirm];
          return (
            <div key={field} className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#667085]">
                {labels[i]}
              </label>
              <div className="relative">
                <input
                  type={shows[i] ? "text" : "password"}
                  name={field}
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="off"
                  maxLength={8}
                  required
                  placeholder="• • • • • •"
                  className="w-full px-4 pr-11 h-11 rounded-xl text-center tracking-[0.4em] font-mono text-base border focus:outline-none focus:border-yellow-400 transition-all bg-white border-[#E5E7EB]"
                />
                <button
                  type="button"
                  onClick={() => setShows[i](!shows[i])}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#667085]"
                >
                  {shows[i] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}

        {error && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-100 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            PIN changed successfully.
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-11 rounded-xl text-sm font-bold transition-all hover:opacity-90 shadow-sm disabled:opacity-50"
          style={{ background: "#0B1F44", color: "white" }}
        >
          {isPending ? "Updating..." : "Update PIN"}
        </button>
      </form>
    </div>
  );
}
