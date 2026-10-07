import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { verifyPaymentAction } from "@/app/actions/payments";
import { getBrandSettingsAction } from "@/app/actions/branding";
import { BrandLogo } from "@/components/brand-logo";

export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}) {
  const resolved = props.searchParams ? await Promise.resolve(props.searchParams) : {};

  // Retrieve admin branding data dynamically
  const branding = await getBrandSettingsAction().catch(() => null);
  const primaryColor = branding?.primaryColor || "#141B47";
  const accentColor = branding?.accentColor || "#F2901F";
  const businessName = branding?.businessName || "LMX8 IMPORTS";
  const tagline = branding?.tagline || "Your Goods. Our Priority.";

  // Extract reference from query parameters
  const rawRef = resolved.reference ?? resolved.trxref ?? resolved.ref ?? resolved.payment_reference;
  const reference = Array.isArray(rawRef)
    ? rawRef[0]?.trim()
    : typeof rawRef === "string"
    ? rawRef.trim()
    : "";

  // Helper for layout frame wrapper
  const renderFrame = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between py-10 px-4 sm:px-6 antialiased">
      {/* Top Branding Navigation Bar */}
      <header className="max-w-2xl mx-auto w-full flex items-center justify-between pb-8">
        <Link href="/" className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
          <BrandLogo variant="main" branding={branding} height={42} />
        </Link>
        <Link
          href="/portal"
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs hover:bg-gray-50 transition-colors"
          style={{ color: primaryColor }}
        >
          Portal Login
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto w-full my-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#E2E8F0] shadow-sm text-center overflow-hidden">
          {content}
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="max-w-2xl mx-auto w-full pt-8 text-center text-xs text-[#64748B]">
        <p className="font-semibold" style={{ color: primaryColor }}>
          {businessName}
        </p>
        <p className="mt-1">{tagline}</p>
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          © {new Date().getFullYear()} {businessName}. All rights reserved. Secure transaction processed server-side.
        </p>
      </footer>
    </div>
  );

  // 1. MISSING REFERENCE
  if (!reference) {
    return renderFrame(
      <div className="space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#172236]">Payment Status Unavailable</h1>
          <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
            No payment reference was provided with this request. If you recently completed a payment, please check your payments list in your portal.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/portal/payments">
            <button
              className="w-full sm:w-auto px-6 py-3 text-white text-sm font-bold rounded-xl transition-opacity cursor-pointer shadow-xs"
              style={{ background: primaryColor }}
            >
              View My Payments
            </button>
          </Link>
          <Link href="/portal">
            <button className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
              Return to Portal
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // 2. ATTEMPT SERVER-SIDE PAYMENT VERIFICATION
  const result = await verifyPaymentAction(reference);

  // 3. FAILED / ERROR STATE
  if (result.error && result.status !== "SUCCESS") {
    const isCancelled = (result.status as string) === "CANCELLED" || result.error?.toLowerCase().includes("cancel");
    return renderFrame(
      <div className="space-y-6">
        <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${isCancelled ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
          {isCancelled ? <AlertCircle size={32} /> : <XCircle size={32} />}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#172236]">
            {isCancelled ? "Payment Cancelled" : "Payment Failed"}
          </h1>
          <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
            {isCancelled
              ? "Your transaction was cancelled before completion. No charges were made."
              : result.error || "We could not confirm this payment. Please verify your payment details and try again."}
          </p>
        </div>

        {/* Reference details box */}
        <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0] text-left text-xs text-[#64748B] space-y-2">
          <div className="flex justify-between items-center">
            <span>Payment Reference:</span>
            <span className="font-mono font-semibold text-[#172236] break-all">{reference}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Status:</span>
            <span className={`font-bold uppercase ${isCancelled ? "text-amber-600" : "text-red-600"}`}>
              {result.status || (isCancelled ? "Cancelled" : "Failed")}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link href="/portal/payments">
            <button
              className="w-full sm:w-auto px-6 py-3 text-white text-sm font-bold rounded-xl transition-opacity cursor-pointer shadow-xs"
              style={{ background: primaryColor }}
            >
              Return to Payments
            </button>
          </Link>
          <Link href="/contact">
            <button className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
              Contact Support
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // 4. VERIFIED SUCCESS STATE
  if (result.status === "SUCCESS") {
    const payment = result.payment;
    const isCredit = payment?.type === "CREDIT_PURCHASE";

    const formattedAmount = payment?.amount ? formatCurrency(payment.amount) : "GH₵ 0.00";
    const trackingNumber = payment?.shipmentTrackingNumber;
    const createdDate = payment?.createdAt
      ? new Date(payment.createdAt).toLocaleDateString("en-GH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-GH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

    return renderFrame(
      <div className="space-y-6">
        {/* Success Icon */}
        <div className="w-20 h-20 shadow-xs mx-auto rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center p-4">
          <CheckCircle2 size={48} strokeWidth={2.2} />
        </div>

        {/* Headline and Message */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172236] tracking-tight">
            Payment Received
          </h1>
          <p className="text-sm sm:text-base text-[#475569] font-medium mt-2">
            Thank you. Your payment has been received successfully.
          </p>
        </div>

        {/* Amount Paid Spotlight */}
        <div
          className="p-5 rounded-2xl text-center border"
          style={{
            backgroundColor: "#F8FAFC",
            borderColor: "#E2E8F0",
          }}
        >
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-1">
            Total Amount Verified
          </span>
          <span className="text-3xl sm:text-4xl font-black" style={{ color: primaryColor }}>
            {formattedAmount}
          </span>
        </div>

        {/* Payment Information Receipt Breakdown */}
        <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] text-left space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Status</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
              Payment Received
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#64748B]">Payment Reference</span>
            <span className="font-mono font-bold text-[#172236] text-xs sm:text-sm break-all">
              {payment?.reference || reference}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#64748B]">Payment Type</span>
            <span className="font-semibold text-[#172236]">
              {isCredit ? "Credit Purchase" : "Shipping Fee Payment"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-[#64748B]">Date</span>
            <span className="font-medium text-[#172236]">{createdDate}</span>
          </div>

          {trackingNumber && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#64748B]">Shipment Tracking</span>
              <span className="font-mono font-bold" style={{ color: primaryColor }}>
                {trackingNumber}
              </span>
            </div>
          )}

          {isCredit && typeof payment?.verifiedCreditBalance === "number" && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-[#E2E8F0]">
              <span className="text-[#64748B]">Verified Credit Balance</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {payment.verifiedCreditBalance} Credits
              </span>
            </div>
          )}
        </div>

        {/* Contextual Supporting Message */}
        <div className="p-4 rounded-xl text-xs sm:text-sm text-left bg-blue-50/80 border border-blue-100 text-blue-950 font-medium">
          {isCredit ? (
            <p>
              Your credit purchase has been received successfully. Your account balance will reflect the payment shortly.
            </p>
          ) : (
            <p>
              Your shipping fee payment has been received successfully. Your shipment will continue through the next stage of processing.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {trackingNumber ? (
            <Link href={`/portal/shipments/${encodeURIComponent(trackingNumber)}`}>
              <button
                className="w-full sm:w-auto px-6 py-3.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                style={{ background: accentColor }}
              >
                VIEW SHIPMENT <ArrowRight size={16} />
              </button>
            </Link>
          ) : isCredit ? (
            <Link href="/portal/credits">
              <button
                className="w-full sm:w-auto px-6 py-3.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                style={{ background: accentColor }}
              >
                VIEW MY ACCOUNT <ArrowRight size={16} />
              </button>
            </Link>
          ) : (
            <Link href="/portal/shipments">
              <button
                className="w-full sm:w-auto px-6 py-3.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                style={{ background: accentColor }}
              >
                VIEW MY SHIPMENTS <ArrowRight size={16} />
              </button>
            </Link>
          )}

          <Link href="/portal/payments">
            <button
              className="w-full sm:w-auto px-6 py-3.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: primaryColor }}
            >
              VIEW PAYMENTS
            </button>
          </Link>

          <Link href="/portal">
            <button className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
              RETURN TO PORTAL
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // 5. PENDING / PROCESSING STATE
  return renderFrame(
    <div className="space-y-6">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
        <Loader2 size={36} className="animate-spin" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#172236]">Payment Pending</h1>
        <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
          Your payment is still being verified by the payment network. Please allow a few moments or refresh to check status.
        </p>
      </div>

      <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-[#E2E8F0] text-left text-xs text-[#64748B] space-y-2">
        <div className="flex justify-between items-center">
          <span>Reference:</span>
          <span className="font-mono font-semibold text-[#172236] break-all">{reference}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Status:</span>
          <span className="font-bold text-blue-600 uppercase">Verification Pending</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Link href={`/payment/success?reference=${encodeURIComponent(reference)}`}>
          <button
            className="w-full sm:w-auto px-6 py-3 text-white text-sm font-bold rounded-xl transition-opacity cursor-pointer shadow-xs"
            style={{ background: primaryColor }}
          >
            Check Status Again
          </button>
        </Link>
        <Link href="/portal/payments">
          <button className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
            View Payments
          </button>
        </Link>
      </div>
    </div>
  );
}
