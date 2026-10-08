"use client";

import React, { useState, useEffect } from "react";
import {
  Settings, Globe, Bell, ShieldCheck, Database, Save, RotateCcw,
  CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink, Activity
} from "lucide-react";
import {
  getSystemSettingsAction,
  updateSystemSettingsAction,
} from "@/app/actions/system-settings";
import { SystemSettingsType, DEFAULT_SYSTEM_SETTINGS } from "@/lib/system-settings-types";
import Link from "next/link";

export default function AdminSystemSettings() {
  const [settings, setSettings] = useState<SystemSettingsType>(DEFAULT_SYSTEM_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<SystemSettingsType>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSystemSettingsAction();
      setSettings(data);
      setInitialSettings(data);
    } catch (err: any) {
      console.error("Failed to load system settings:", err);
      setFeedback({ type: "error", text: "Failed to load persistent system settings from database." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const hasUnsavedChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await updateSystemSettingsAction(settings);
      if (res.error) {
        setFeedback({ type: "error", text: res.error });
      } else if (res.settings) {
        setSettings(res.settings);
        setInitialSettings(res.settings);
        setFeedback({ type: "success", text: "System settings saved successfully and applied server-wide." });
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to save settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(initialSettings);
    setFeedback(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center text-[#667085] border border-[#E5E7EB] shadow-sm flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-brand-navy" />
        <p className="text-sm font-medium">Loading persistent system settings from PostgreSQL...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
      {/* Sticky Top Bar for Unsaved Changes & Feedback */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <Settings size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#172236]">Configuration Controls</h3>
            <p className="text-xs text-[#667085]">
              {hasUnsavedChanges ? (
                <span className="text-amber-600 font-semibold">● You have unsaved changes</span>
              ) : (
                <span>All settings synchronized with database</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={14} /> Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !hasUnsavedChanges}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-secondary disabled:opacity-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm flex items-center gap-3 border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 1. General Settings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#F1F5F9]">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <Globe size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#172236]">General Operations</h3>
            <p className="text-xs text-[#667085]">Regional timezones, date formatting, and financial currency</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1.5">
              Default Timezone
            </label>
            <select
              value={settings.defaultTimezone}
              onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white text-[#172236] focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="Africa/Accra">Africa/Accra (GMT+0, Ghana)</option>
              <option value="Asia/Shanghai">Asia/Shanghai (GMT+8, China)</option>
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="Europe/London">Europe/London (GMT+0 / BST)</option>
              <option value="America/New_York">America/New_York (EST / EDT)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1.5">
              Date Display Format
            </label>
            <select
              value={settings.dateTimeFormat}
              onChange={(e) => setSettings({ ...settings, dateTimeFormat: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white text-[#172236] focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 25/10/2026)</option>
              <option value="MMM D, YYYY">MMM D, YYYY (e.g. Oct 25, 2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1.5">
              Primary Currency
            </label>
            <select
              value={settings.defaultCurrency}
              onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white text-[#172236] focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="GHS">GHS — Ghanaian Cedi (GH₵)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Notifications & Triggers */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#F1F5F9]">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Bell size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#172236]">Notification & Dispatch Settings</h3>
            <p className="text-xs text-[#667085]">Brevo transactional email dispatch rules and reminder frequency</p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Shipment Email Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div>
              <p className="text-sm font-semibold text-[#172236]">Automated Shipment Status Emails</p>
              <p className="text-xs text-[#667085]">
                Send email alerts when shipment timeline status progresses (Order Confirmed, Departed China, etc.)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.shipmentEmailEnabled}
                onChange={(e) => setSettings({ ...settings, shipmentEmailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Fee Reminder Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div>
              <p className="text-sm font-semibold text-[#172236]">Shipping Fee Reminders</p>
              <p className="text-xs text-[#667085]">
                Enable recurring automated reminders for shipments with unpaid balances at eligible stages.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.feeReminderEnabled}
                onChange={(e) => setSettings({ ...settings, feeReminderEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-[#172236] block mb-1">
                Fee Reminder Cadence Interval (Days)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={settings.feeReminderIntervalDays}
                onChange={(e) =>
                  setSettings({ ...settings, feeReminderIntervalDays: parseInt(e.target.value) || 3 })
                }
                className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
              <p className="text-[11px] text-[#667085] mt-1">
                Minimum interval required between automatic email reminders for the same unpaid shipment.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#172236] block mb-1">
                Failed Email Retry Attempts
              </label>
              <input
                type="number"
                min={0}
                max={10}
                value={settings.failedEmailRetryMax}
                onChange={(e) =>
                  setSettings({ ...settings, failedEmailRetryMax: parseInt(e.target.value) || 3 })
                }
                className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
              <p className="text-[11px] text-[#667085] mt-1">
                Maximum automatic retry attempts for transient Brevo API network issues.
              </p>
            </div>
          </div>

          {/* Business Rules Reference */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-[#1E3A8A] space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck size={14} /> Enforced Business Logic:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#1E3A8A]">
              <li><strong>Order Confirmed, Preparing for Shipment, Departed China:</strong> Informational status updates only (no payment prompts or fee reminder logs).</li>
              <li><strong>On the Way to Ghana:</strong> Fee reminder eligibility strictly begins if fee is unpaid.</li>
              <li><strong>Arrived in Ghana, Customs Clearance:</strong> Fee reminders continue if unpaid.</li>
              <li><strong>Out for Delivery:</strong> No automatic status update email; reminders continue only if fee remains unpaid.</li>
              <li><strong>Delivered:</strong> All fee reminders immediately stop. Verified payment stops reminders instantly.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Security & Access Control */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E5E7EB] space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[#F1F5F9]">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#172236]">Security & Sessions</h3>
            <p className="text-xs text-[#667085]">Authentication security, session timeouts, and lockout protection</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1">
              Admin Session Timeout (Minutes)
            </label>
            <input
              type="number"
              min={15}
              max={1440}
              value={settings.sessionTimeoutMinutes}
              onChange={(e) =>
                setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) || 60 })
              }
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
            <p className="text-[11px] text-[#667085] mt-1">Automatic session expiration threshold</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1">
              Max Login PIN Attempts
            </label>
            <input
              type="number"
              min={3}
              max={20}
              value={settings.maxLoginAttempts}
              onChange={(e) =>
                setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 5 })
              }
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
            <p className="text-[11px] text-[#667085] mt-1">Failed attempts before account lockout</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-[#172236] block mb-1">
              Lockout Duration (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.lockoutDurationMinutes}
              onChange={(e) =>
                setSettings({ ...settings, lockoutDurationMinutes: parseInt(e.target.value) || 15 })
              }
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
            <p className="text-[11px] text-[#667085] mt-1">Cooldown duration following locked status</p>
          </div>
        </div>
      </div>

      {/* 4. Live Integrations & Operations Jump Links */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/admin/live-sync"
          className="p-5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#141B47] transition-all flex items-center justify-between group shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Activity size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#172236] group-hover:text-brand-navy transition-colors">
                Live Sync Health Dashboard
              </h4>
              <p className="text-xs text-[#667085]">Monitor Brevo, Paystack, Storage & PostgreSQL</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/admin/data-management"
          className="p-5 rounded-2xl bg-white border border-[#E5E7EB] hover:border-[#141B47] transition-all flex items-center justify-between group shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#172236] group-hover:text-brand-navy transition-colors">
                Operational Data Reset Tool
              </h4>
              <p className="text-xs text-[#667085]">Clear operational periods while preserving infrastructure</p>
            </div>
          </div>
          <ArrowRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </form>
  );
}
