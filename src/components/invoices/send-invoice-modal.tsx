"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { sendInvoiceEmailAction, prepareInvoiceWhatsAppMessageAction } from "@/app/actions/invoices";
import { X, Mail, MessageSquare, CheckCircle2, AlertCircle, Copy, ExternalLink, Send, ArrowRight } from "lucide-react";

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    amountPaid: number;
    outstandingBalance: number;
    currency: string;
    customer?: {
      name?: string;
      email?: string | null;
      phone?: string | null;
    } | null;
  };
}

export function SendInvoiceModal({ isOpen, onClose, onSuccess, invoice }: SendInvoiceModalProps) {
  const [activeTab, setActiveTab] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [customEmailNote, setCustomEmailNote] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // WhatsApp prepared state
  const [whatsAppData, setWhatsAppData] = useState<{
    whatsappUrl?: string;
    messageText?: string;
    recipientPhone?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSendEmail = async () => {
    setStatusMessage(null);
    if (!invoice.customer?.email) {
      setStatusMessage({ type: "error", text: "Client has no registered email address." });
      return;
    }

    setLoading(true);
    try {
      const res = await sendInvoiceEmailAction(invoice.id, customEmailNote.trim() || undefined);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Invoice #${invoice.invoiceNumber} successfully dispatched to ${invoice.customer.email} via Brevo!`,
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to send email through Brevo." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handlePrepareWhatsApp = async () => {
    setStatusMessage(null);
    if (!invoice.customer?.phone) {
      setStatusMessage({ type: "error", text: "Client has no registered phone number." });
      return;
    }

    setLoading(true);
    try {
      const res = await prepareInvoiceWhatsAppMessageAction(invoice.id);
      if (res.success) {
        setWhatsAppData({
          whatsappUrl: res.whatsappUrl,
          messageText: res.messageText,
          recipientPhone: res.recipientPhone,
        });
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to prepare WhatsApp message." });
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err?.message || "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (whatsAppData?.messageText) {
      navigator.clipboard.writeText(whatsAppData.messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-[#141B47] text-white flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F2901F]">
              CLIENT DISPATCH
            </span>
            <h3 className="text-xl font-black mt-0.5">Send Invoice #{invoice.invoiceNumber}</h3>
            <p className="text-xs text-white/70 font-mono mt-0.5">
              Client: {invoice.customer?.name || "Client"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setActiveTab("EMAIL");
              setStatusMessage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "EMAIL"
                ? "bg-white text-[#141B47] shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Mail size={15} /> Brevo Official Email
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("WHATSAPP");
              setStatusMessage(null);
              if (!whatsAppData) handlePrepareWhatsApp();
            }}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === "WHATSAPP"
                ? "bg-white text-emerald-800 shadow-xs border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare size={15} /> WhatsApp Desk
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === "EMAIL" ? (
            /* EMAIL DISPATCH */
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Recipient Email</span>
                <p className="font-semibold text-slate-900 text-sm">
                  {invoice.customer?.email || (
                    <span className="text-red-500 font-normal">No email registered for client</span>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Optional Note to Client (Appended to Email)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Please confirm payment once transfer is complete so we can release your cargo."
                  value={customEmailNote}
                  onChange={(e) => setCustomEmailNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:border-[#141B47]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-slate-600 text-[11px] leading-relaxed">
                This email uses the official LMX8 Imports layout sent via Brevo transactional pipeline. It includes the complete invoice summary, payment instructions, and a secure client link to download the PDF.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  disabled={loading || !invoice.customer?.email}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141B47] text-white hover:bg-[#1E2968] flex items-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Send size={14} />
                  {loading ? "Sending via Brevo..." : "Dispatch Email"}
                </button>
              </div>
            </div>
          ) : (
            /* WHATSAPP DISPATCH */
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">WhatsApp Destination</span>
                <p className="font-semibold text-emerald-950 font-mono text-sm">
                  {invoice.customer?.phone || (
                    <span className="text-red-500 font-sans font-normal">No phone number registered</span>
                  )}
                </p>
              </div>

              {whatsAppData ? (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-slate-700">Message Preview</label>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="text-[11px] text-[#141B47] hover:underline font-bold flex items-center gap-1"
                      >
                        <Copy size={12} /> {copied ? "Copied!" : "Copy Text"}
                      </button>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {whatsAppData.messageText}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed italic">
                    Pressing <strong>Open WhatsApp</strong> opens WhatsApp Web or the WhatsApp desktop/mobile app with this client and prefilled message ready to send.
                  </p>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Close
                    </button>
                    <a
                      href={whatsAppData.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        onSuccess();
                        onClose();
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-xs"
                    >
                      <MessageSquare size={14} /> Open in WhatsApp <ExternalLink size={12} />
                    </a>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <button
                    type="button"
                    onClick={handlePrepareWhatsApp}
                    disabled={loading || !invoice.customer?.phone}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {loading ? "Preparing message..." : "Generate WhatsApp Message"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
