import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/mock-data";
import { getShipmentForCheckoutAction } from "@/app/actions/customer-payments";
import { ShippingPayNowButton } from "@/components/shipping-pay-now-button";
import { BrandLogo } from "@/components/brand-logo";

export const dynamic = "force-dynamic";

export default async function PaymentCheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shipment = await getShipmentForCheckoutAction(id);

  if (!shipment) return notFound();

  const paidAmount = shipment.paidAmount;
  const outstanding = shipment.outstanding;
  const isPaid = shipment.isPaid;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <Link
        href="/portal/payments"
        className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-white"
        style={{ color: "#94A3B8" }}
      >
        <ArrowLeft size={16} /> Back to Payments
      </Link>

      <div
        className="bg-white rounded-2xl overflow-hidden shadow-sm"
        style={{ border: "1px solid #E5E7EB" }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#172236" }}>
              Shipping Payment
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#667085" }}>
              Complete payment to release cargo.
            </p>
          </div>
          <BrandLogo variant="symbol" height={36} />
        </div>

        {/* Shipment details */}
        <div className="p-6 space-y-6">
          <div
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl"
            style={{ background: "#F7F9FC", border: "1px solid #E5E7EB" }}
          >
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Shipment
              </p>
              <p className="font-bold text-sm" style={{ color: "#172236" }}>
                {shipment.trackingNumber}
              </p>
            </div>
            <div className="hidden md:block w-px h-8 bg-gray-200" />
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: "#667085" }}
              >
                Description
              </p>
              <p className="font-semibold text-sm" style={{ color: "#172236" }}>
                {shipment.description}
              </p>
            </div>
            {paidAmount > 0 && (
              <>
                <div className="hidden md:block w-px h-8 bg-gray-200" />
                <div>
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider mb-1"
                    style={{ color: "#667085" }}
                  >
                    Already Paid
                  </p>
                  <p className="font-semibold text-sm text-green-600">
                    {formatCurrency(paidAmount)}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: "#172236" }}>
              Fee breakdown
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: "#667085" }}>Shipping fee</span>
              <span className="font-medium" style={{ color: "#172236" }}>
                {formatCurrency(shipment.fee)}
              </span>
            </div>
            {paidAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: "#667085" }}>Previously paid</span>
                <span className="font-medium text-green-600">
                  − {formatCurrency(paidAmount)}
                </span>
              </div>
            )}
            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: "1px dashed #E5E7EB" }}
            >
              <span className="font-bold text-base" style={{ color: "#172236" }}>
                TOTAL DUE
              </span>
              <span className="font-black text-xl" style={{ color: "#141B47" }}>
                {formatCurrency(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="px-6 pb-6 pt-2">
          {isPaid ? (
            <div
              className="w-full py-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2"
              style={{ background: "#D1FAE5", color: "#065F46" }}
            >
              <CheckCircle2 size={18} /> Payment Complete
            </div>
          ) : (
            <div className="space-y-4">
              <ShippingPayNowButton shipmentId={shipment.id} />
              <p
                className="flex items-center justify-center gap-2 text-xs font-medium"
                style={{ color: "#667085" }}
              >
                <Lock size={12} /> Secure payment verified by Paystack
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
