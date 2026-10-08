"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, Database, HardDrive, CreditCard, Mail, Clock, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, HelpCircle, Shield, ArrowUpRight,
  Loader2, Wifi, Zap, Check
} from "lucide-react";
import {
  getLiveSyncReportAction,
  checkSingleIntegrationAction,
} from "@/app/actions/live-sync";
import type { LiveSyncReport, IntegrationCheckResult, HealthStatus } from "@/lib/live-sync-types";
import Link from "next/link";

const STATUS_CONFIG: Record<
  HealthStatus,
  { label: string; bg: string; text: string; border: string; icon: any; dot: string }
> = {
  OPERATIONAL: {
    label: "Operational",
    bg: "#ECFDF5",
    text: "#065F46",
    border: "#A7F3D0",
    icon: CheckCircle2,
    dot: "#10B981",
  },
  DEGRADED: {
    label: "Degraded",
    bg: "#FFFBEB",
    text: "#92400E",
    border: "#FDE68A",
    icon: AlertTriangle,
    dot: "#F59E0B",
  },
  DOWN: {
    label: "Down",
    bg: "#FEF2F2",
    text: "#991B1B",
    border: "#FECACA",
    icon: XCircle,
    dot: "#EF4444",
  },
  NOT_CONFIGURED: {
    label: "Not Configured",
    bg: "#F1F5F9",
    text: "#475569",
    border: "#CBD5E1",
    icon: HelpCircle,
    dot: "#94A3B8",
  },
  UNKNOWN: {
    label: "Unknown",
    bg: "#F8FAFC",
    text: "#64748B",
    border: "#E2E8F0",
    icon: HelpCircle,
    dot: "#94A3B8",
  },
};

export default function AdminLiveSyncPage() {
  const [report, setReport] = useState<LiveSyncReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchReport = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);

    try {
      const data = await getLiveSyncReportAction();
      setReport(data);
      setCountdown(30);
    } catch (err) {
      console.error("Live Sync poll error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchReport(true);
  }, [fetchReport]);

  // 30s Auto-refresh timer with pause on hidden tab
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = setInterval(() => {
      if (document.hidden) return; // Avoid polling when tab inactive

      setCountdown((prev) => {
        if (prev <= 1) {
          fetchReport(false);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, fetchReport]);

  const handleCheckSingle = async (id: string) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const result = await checkSingleIntegrationAction(id);
      setReport((prev) => {
        if (!prev) return null;
        const updatedChecks = prev.checks.map((c) => (c.id === id ? result : c));
        let overall: HealthStatus = "OPERATIONAL";
        if (updatedChecks.some((c) => c.status === "DOWN")) overall = "DOWN";
        else if (updatedChecks.some((c) => c.status === "DEGRADED" || c.status === "NOT_CONFIGURED"))
          overall = "DEGRADED";

        return {
          ...prev,
          overallStatus: overall,
          timestamp: new Date().toISOString(),
          checks: updatedChecks,
        };
      });
    } catch (err) {
      console.error(`Check failed for ${id}:`, err);
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "database":
        return <Database size={20} className="text-blue-600" />;
      case "storage":
        return <HardDrive size={20} className="text-indigo-600" />;
      case "payment":
        return <CreditCard size={20} className="text-emerald-600" />;
      case "email":
        return <Mail size={20} className="text-amber-600" />;
      case "cron":
        return <Clock size={20} className="text-purple-600" />;
      default:
        return <Activity size={20} className="text-gray-600" />;
    }
  };

  const overallCfg = report ? STATUS_CONFIG[report.overallStatus] : STATUS_CONFIG.UNKNOWN;
  const OverallIcon = overallCfg.icon;

  return (
    <div className="space-y-7 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center shadow-xs">
              <Activity size={18} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#172236]">Live Sync</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
              Live Monitor
            </span>
          </div>
          <p className="text-sm text-[#667085]">
            Real-time backend integration health, database connectivity, and provider telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer ${
              autoRefreshEnabled
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${autoRefreshEnabled ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}
            />
            {autoRefreshEnabled ? `Auto-Refresh: ${countdown}s` : "Auto-Refresh: Paused"}
          </button>

          <button
            onClick={() => fetchReport(false)}
            disabled={refreshing || loading}
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:bg-gray-50 text-[#172236] transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Checking..." : "Refresh All"}
          </button>
        </div>
      </div>

      {/* Overall Health Status Banner */}
      <div
        className="rounded-3xl p-6 sm:p-7 border shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
        style={{ backgroundColor: overallCfg.bg, borderColor: overallCfg.border }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ backgroundColor: "white", color: overallCfg.text }}
          >
            <OverallIcon size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                System Health Summary
              </span>
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: overallCfg.dot }}
              />
            </div>
            <h2 className="text-2xl font-black tracking-tight" style={{ color: overallCfg.text }}>
              {overallCfg.label}
            </h2>
            <p className="text-xs sm:text-sm mt-0.5 text-[#475569]">
              {report?.overallStatus === "OPERATIONAL"
                ? "All registered backend services and external APIs are communicating normally."
                : report?.overallStatus === "DEGRADED"
                ? "One or more integrations are not configured or experiencing latency."
                : "Critical service outage detected. Check individual service cards below."}
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0 text-xs text-[#64748B]">
          <p>
            Last full check:{" "}
            <strong className="text-[#172236] font-mono">
              {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : "--"}
            </strong>
          </p>
          <p className="mt-0.5">Active services monitored: <strong>{report?.checks?.length || 6}</strong></p>
        </div>
      </div>

      {/* Integration Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center text-[#667085] border border-[#E5E7EB] shadow-sm flex flex-col items-center justify-center gap-3">
          <Loader2 size={36} className="animate-spin text-brand-navy" />
          <p className="text-sm font-semibold text-[#172236]">Running diagnostic health checks...</p>
          <p className="text-xs text-[#667085]">Connecting to PostgreSQL, Paystack, Brevo, and Storage...</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {report?.checks.map((check) => {
            const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.UNKNOWN;
            const StatusIcon = cfg.icon;
            const isChecking = checkingIds.has(check.id);

            return (
              <div
                key={check.id}
                className="bg-white rounded-2xl p-5 border border-[#E5E7EB] hover:border-gray-300 transition-all shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Top: Icon + Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                      {getCategoryIcon(check.category)}
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 border"
                      style={{
                        backgroundColor: cfg.bg,
                        color: cfg.text,
                        borderColor: cfg.border,
                      }}
                    >
                      <StatusIcon size={12} />
                      {cfg.label}
                    </span>
                  </div>

                  {/* Title & Latency */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#172236]">{check.name}</h3>
                      {typeof check.latencyMs === "number" && (
                        <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                          {check.latencyMs}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed min-h-[38px]">
                      {check.message}
                    </p>
                  </div>
                </div>

                {/* Footer: Last checked & Check Now button */}
                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span className="font-mono truncate">
                    {check.lastChecked
                      ? `Checked ${new Date(check.lastChecked).toLocaleTimeString()}`
                      : "--"}
                  </span>
                  <button
                    onClick={() => handleCheckSingle(check.id)}
                    disabled={isChecking || refreshing}
                    className="px-2.5 py-1 text-xs font-bold text-[#141B47] hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isChecking ? (
                      <Loader2 size={12} className="animate-spin text-[#141B47]" />
                    ) : (
                      <Zap size={12} />
                    )}
                    Check Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Helpful Operational Resources Box */}
      <div className="p-6 bg-white rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-sm text-[#172236]">Transactional Email History</h4>
          <p className="text-xs text-[#667085] mt-0.5">
            View historical Brevo email delivery logs, status events, and dispatch records.
          </p>
        </div>
        <Link
          href="/admin/emails"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F8FAFC] border border-[#E5E7EB] text-[#141B47] hover:bg-gray-100 transition-colors flex items-center gap-1.5 shrink-0"
        >
          View Email Logs <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>
  );
}
