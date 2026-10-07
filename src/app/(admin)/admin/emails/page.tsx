"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  getEmailDiagnosticsAction,
  sendTestEmailAction,
  retryEmailLogAction,
} from "@/app/actions/email-diagnostics";
import {
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Search,
  Filter,
  Terminal,
  Activity,
} from "lucide-react";

export default function AdminEmailsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; messageId?: string; error?: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadDiagnostics = async () => {
    setLoading(true);
    const res = await getEmailDiagnosticsAction();
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) return;

    setTestSending(true);
    setTestResult(null);
    try {
      const res = await sendTestEmailAction(testEmail.trim());
      setTestResult(res);
      if (res.success) {
        loadDiagnostics();
      }
    } catch (err: any) {
      setTestResult({ error: err?.message || "Failed to dispatch test email." });
    } finally {
      setTestSending(false);
    }
  };

  const handleRetry = async (logId: string) => {
    startTransition(async () => {
      const res = await retryEmailLogAction(logId);
      if (res.error) {
        alert(res.error);
      }
      loadDiagnostics();
    });
  };

  const filteredLogs = (data?.logs || []).filter((log: any) => {
    const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      log.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.trackingNumber && log.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#141B47] flex items-center gap-3">
            <Mail className="text-[#FFB800]" size={32} /> Brevo Diagnostics & Email Logs
          </h1>
          <p className="text-sm text-[#667085] mt-1">
            Centralized email delivery tracking, API diagnostics, and error reporting.
          </p>
        </div>
        <button
          onClick={loadDiagnostics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#E5E7EB] text-[#141B47] hover:bg-gray-50 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* ── SECTION 1: CONFIGURATION & STATS CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* API Config Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#141B47] flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" /> API Authentication
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                data?.config?.BREVO_API_KEY === "configured"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {data?.config?.BREVO_API_KEY || "Checking..."}
            </span>
          </div>
          <div className="space-y-2 text-xs text-[#667085]">
            <div className="flex justify-between">
              <span>Sender Name:</span>
              <span className="font-semibold text-[#172236]">{data?.config?.BREVO_SENDER_NAME || "LEXMEDIA.GH"}</span>
            </div>
            <div className="flex justify-between">
              <span>Sender Email:</span>
              <span className="font-semibold text-[#172236] truncate max-w-[200px]" title={data?.config?.senderEmailValue}>
                {data?.config?.senderEmailValue || "notifications@lmx8imports.com"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Delivery Stats */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-xs border border-[#E5E7EB] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-[#141B47] flex items-center gap-2">
              <Activity size={18} className="text-[#355DAF]" /> Delivery Statistics
            </h3>
            <span className="text-xs font-semibold text-[#667085]">Last 150 events</span>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">Total</p>
              <p className="text-xl font-black text-[#141B47] mt-1">{data?.stats?.total ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Sent</p>
              <p className="text-xl font-black text-emerald-800 mt-1">{data?.stats?.sent ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Failed</p>
              <p className="text-xl font-black text-red-800 mt-1">{data?.stats?.failed ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Skipped</p>
              <p className="text-xl font-black text-amber-800 mt-1">{data?.stats?.skipped ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: TEST EMAIL DISPATCHER ── */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#E5E7EB] space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#141B47] flex items-center gap-2">
            <Terminal size={18} className="text-[#FFB800]" /> Send Diagnostic Test Email
          </h2>
          <p className="text-xs text-[#667085]">
            Test Brevo REST API connectivity immediately by dispatching a live transactional test email.
          </p>
        </div>

        <form onSubmit={handleSendTest} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="Enter recipient email address..."
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 px-4 h-11 rounded-xl text-xs sm:text-sm border border-[#E5E7EB] focus:outline-none focus:border-[#FFB800] bg-white text-[#172236]"
          />
          <button
            type="submit"
            disabled={testSending || !testEmail.trim()}
            className="px-6 h-11 rounded-xl text-xs font-bold text-[#07182F] bg-[#FFB800] hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {testSending ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Sending Test...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Dispatch Test Email</span>
              </>
            )}
          </button>
        </form>

        {testResult && (
          <div
            className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
              testResult.success
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">
                {testResult.success ? "Test Email Accepted by Brevo" : "Brevo API Dispatch Failed"}
              </p>
              {testResult.success ? (
                <p className="font-mono text-[11px] text-emerald-700">
                  Message ID: {testResult.messageId}
                </p>
              ) : (
                <p className="font-mono text-[11px] text-red-700 bg-red-100/60 p-2 rounded-lg border border-red-200">
                  {testResult.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 3: CENTRALIZED EMAIL LOGS & ERROR CODES ── */}
      <div className="bg-white rounded-2xl shadow-xs border border-[#E5E7EB] overflow-hidden space-y-4">
        <div className="p-6 pb-4 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#141B47]">Transaction Email Audit Trail</h2>
            <p className="text-xs text-[#667085]">
              Inspecting provider status, message IDs, and exact HTTP error responses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search recipient or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 h-9 rounded-lg text-xs border border-[#E5E7EB] bg-white text-[#172236] focus:outline-none focus:border-[#FFB800] w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg text-xs border border-[#E5E7EB] bg-white text-[#172236] font-semibold focus:outline-none focus:border-[#FFB800] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="SENT">Sent</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#667085]">Loading email audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#667085]">No email logs found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Event Type</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Recipient</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Subject / Details</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085]">Message ID / Error</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085] text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] text-xs">
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          log.status === "SENT"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : log.status === "FAILED"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : log.status === "SKIPPED"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}
                      >
                        {log.status === "SENT" && <CheckCircle2 size={11} className="text-emerald-600" />}
                        {log.status === "FAILED" && <XCircle size={11} className="text-red-600" />}
                        {log.status === "PENDING" && <Clock size={11} className="text-gray-500" />}
                        <span>{log.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-bold text-[#141B47]">
                      {log.eventType}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#172236]">{log.recipient}</div>
                      {log.customerName && (
                        <div className="text-[11px] text-[#667085]">
                          {log.customerName} ({log.customerIdentifier})
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate">
                      <div className="font-medium text-[#172236]">{log.subject}</div>
                      {log.trackingNumber && (
                        <span className="font-mono text-[10px] text-[#355DAF] bg-blue-50 px-1.5 py-0.5 rounded-md">
                          {log.trackingNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 max-w-sm">
                      {log.status === "SENT" && log.providerMessageId ? (
                        <span className="font-mono text-[10px] bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200 block truncate">
                          ID: {log.providerMessageId}
                        </span>
                      ) : log.status === "FAILED" ? (
                        <div className="space-y-1">
                          <span className="font-mono text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-200 block break-words">
                            {log.errorMessage || "Unknown transmission failure"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRetry(log.id)}
                            disabled={isPending}
                            className="text-[10px] font-bold text-[#355DAF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw size={10} /> Retry Sending
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No provider ID</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-[#667085]">
                      {new Date(log.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
