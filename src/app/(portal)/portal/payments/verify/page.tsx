import { verifyPaymentAction } from "@/app/actions/payments";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default async function PaymentVerificationPage({
  searchParams,
}: {
  searchParams: { reference?: string };
}) {
  const reference = searchParams.reference;

  if (!reference) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
        <XCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-[#172236]">Invalid Request</h2>
        <p className="text-sm text-[#667085] mt-2 mb-6">No payment reference provided.</p>
        <Link href="/portal/credits">
          <button className="px-6 py-2.5 bg-[#0B1F44] text-white text-sm font-bold rounded-xl hover:opacity-90">
            Return to Credits
          </button>
        </Link>
      </div>
    );
  }

  const result = await verifyPaymentAction(reference);

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
        <XCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-[#172236]">Verification Failed</h2>
        <p className="text-sm text-[#667085] mt-2 mb-6">{result.error}</p>
        <Link href="/portal/credits">
          <button className="px-6 py-2.5 bg-[#0B1F44] text-white text-sm font-bold rounded-xl hover:opacity-90">
            Return to Credits
          </button>
        </Link>
      </div>
    );
  }

  if (result.status === "SUCCESS") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
        <CheckCircle2 size={48} className="text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-[#172236]">Payment Successful</h2>
        <p className="text-sm text-[#667085] mt-2 mb-6">Your payment has been verified and processed successfully.</p>
        <div className="flex gap-4">
          <Link href="/portal/credits">
            <button className="px-6 py-2.5 bg-[#0B1F44] text-white text-sm font-bold rounded-xl hover:opacity-90">
              View Credits
            </button>
          </Link>
          <Link href="/portal/payments">
            <button className="px-6 py-2.5 bg-gray-100 text-[#172236] text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors">
              View Payments
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (result.status === "FAILED") {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
        <XCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-[#172236]">Payment Failed</h2>
        <p className="text-sm text-[#667085] mt-2 mb-6">Your payment could not be completed.</p>
        <Link href="/portal/credits">
          <button className="px-6 py-2.5 bg-[#0B1F44] text-white text-sm font-bold rounded-xl hover:opacity-90">
            Try Again
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
      <Loader2 size={48} className="text-blue-500 mb-4 animate-spin" />
      <h2 className="text-xl font-bold text-[#172236]">Payment Processing</h2>
      <p className="text-sm text-[#667085] mt-2 mb-6">Your payment is still being processed. Please check back later.</p>
      <Link href="/portal/credits">
        <button className="px-6 py-2.5 bg-gray-100 text-[#172236] text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors">
          Return to Dashboard
        </button>
      </Link>
    </div>
  );
}
