import { verifyPaymentAction } from "@/app/actions/payments";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, ArrowRight, ShieldAlert, LogIn, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";

export default async function PaymentVerificationPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}) {
  const resolved = props.searchParams ? await Promise.resolve(props.searchParams) : {};

  // Extract reference from any of the standard Paystack callback query parameters
  const rawRef = resolved.reference ?? resolved.trxref ?? resolved.ref ?? resolved.payment_reference;
  const reference = Array.isArray(rawRef) 
    ? rawRef[0]?.trim() 
    : (typeof rawRef === "string" ? rawRef.trim() : "");

  // Missing reference: customer navigated directly or reference was not supplied
  if (!reference) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-xl font-bold text-[#172236]">Invalid Request</h2>
          <p className="text-sm text-[#667085] mt-2 mb-6">
            No payment reference was provided with this verification request.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/portal/payments">
              <button className="w-full sm:w-auto px-6 py-2.5 bg-[#141B47] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
                View My Payments
              </button>
            </Link>
            <Link href="/portal">
              <button className="w-full sm:w-auto px-6 py-2.5 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
                Return to Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Attempt server-side verification and processing
  const result = await verifyPaymentAction(reference);

  // If customer is not authenticated, prompt to sign in and redirect back with reference
  if (result.unauthorized) {
    const returnUrl = `/portal/payments/verify?reference=${encodeURIComponent(reference)}`;
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <LogIn size={28} />
          </div>
          <h2 className="text-xl font-bold text-[#172236]">Sign In to Confirm Payment</h2>
          <p className="text-sm text-[#667085] mt-2 mb-4">
            Your transaction was received with reference:
          </p>
          <p className="font-mono text-xs bg-gray-100 text-gray-700 py-1.5 px-3 rounded-lg inline-block mb-6 font-semibold">
            {reference}
          </p>
          <p className="text-xs text-[#667085] mb-6">
            Please sign in to link this payment to your customer account.
          </p>
          <Link href={`/login?redirect=${encodeURIComponent(returnUrl)}`}>
            <button className="w-full px-6 py-3 bg-[#141B47] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2">
              Sign In to Complete Verification <ArrowRight size={16} />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Payment Verification Error
  if (result.error && result.status !== "SUCCESS") {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-[#172236]">Payment Could Not Be Confirmed</h2>
          <p className="text-sm text-[#667085] mt-2 mb-4">
            {result.error}
          </p>
          <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 text-left text-xs text-[#667085] mb-6 space-y-1">
            <div className="flex justify-between">
              <span>Reference:</span>
              <span className="font-mono font-semibold text-[#172236]">{reference}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="font-semibold text-red-600 uppercase">{result.status || "Failed"}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/portal/payments">
              <button className="w-full sm:w-auto px-6 py-2.5 bg-[#141B47] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
                View Payments
              </button>
            </Link>
            <Link href="/contact">
              <button className="w-full sm:w-auto px-6 py-2.5 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
                Contact Support
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Payment SUCCESS
  if (result.status === "SUCCESS") {
    const payment = result.payment;
    const isCredit = payment?.type === "CREDIT_PURCHASE";

    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <CheckCircle2 size={36} />
          </div>
          <h1 className="text-2xl font-bold text-[#172236]">Payment Successful</h1>
          <p className="text-sm text-[#667085] mt-1.5 mb-6">
            Your payment has been confirmed and verified.
          </p>

          {/* Receipt Breakdown Card */}
          <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-[#E2E8F0] text-left mb-6 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">Payment Status</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                Completed
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">Transaction Reference</span>
              <span className="font-mono font-semibold text-[#172236] text-xs">
                {payment?.reference || reference}
              </span>
            </div>

            {payment?.amount && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Amount Paid</span>
                <span className="font-bold text-base text-[#141B47]">
                  {formatCurrency(payment.amount)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#667085]">Payment Type</span>
              <span className="font-semibold text-[#172236]">
                {isCredit ? "Sourcing Credit Purchase" : "Shipping Fee Payment"}
              </span>
            </div>

            {payment?.shipmentTrackingNumber && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">Shipment Tracking</span>
                <span className="font-semibold text-[#141B47]">
                  {payment.shipmentTrackingNumber}
                </span>
              </div>
            )}
          </div>

          {/* Type-Specific Confirmation Message */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 text-xs mb-8 text-left">
            {isCredit ? (
              <p>
                <strong>Credits added successfully:</strong> Your new sourcing credits have been credited to your account and are ready to use.
              </p>
            ) : (
              <p>
                <strong>Shipping fee confirmed:</strong> Cargo payment recorded. Your shipment status will update as clearance and dispatch continue.
              </p>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isCredit ? (
              <Link href="/portal/credits">
                <button 
                  className="w-full sm:w-auto px-6 py-3 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  style={{ background: "#F2901F" }}
                >
                  View My Credits <ArrowRight size={16} />
                </button>
              </Link>
            ) : (
              <Link href="/portal/shipments">
                <button 
                  className="w-full sm:w-auto px-6 py-3 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  style={{ background: "#F2901F" }}
                >
                  View My Shipments <ArrowRight size={16} />
                </button>
              </Link>
            )}

            <Link href="/portal/payments">
              <button className="w-full sm:w-auto px-6 py-3 bg-[#141B47] text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity cursor-pointer">
                Payment History
              </button>
            </Link>

            <Link href="/portal">
              <button className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-[#172236] text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors cursor-pointer">
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Pending / Processing State
  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] shadow-sm text-center">
        <Loader2 size={40} className="text-[#355DAF] mb-4 animate-spin mx-auto" />
        <h2 className="text-xl font-bold text-[#172236]">Payment Processing</h2>
        <p className="text-sm text-[#667085] mt-2 mb-6">
          Your payment is still being processed by the network. Please allow a few moments or check your payments list.
        </p>
        <Link href="/portal/payments">
          <button className="px-6 py-2.5 bg-[#141B47] text-white text-sm font-bold rounded-xl hover:opacity-90 cursor-pointer">
            Check Payment Status
          </button>
        </Link>
      </div>
    </div>
  );
}
