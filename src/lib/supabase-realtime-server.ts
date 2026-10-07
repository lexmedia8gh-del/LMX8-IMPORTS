import { getSupabaseAdminClient } from "@/lib/storage";
import { Shipment as UIShipment } from "@/lib/db";

/**
 * Broadcasts a real-time shipment status/timeline update across Supabase Realtime channels.
 * Scoped specifically to the affected shipment ID and tracking number.
 */
export async function broadcastShipmentUpdate(params: {
  shipmentId: string;
  trackingNumber: string;
  status: string;
  shipment?: UIShipment | null;
  source?: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return;
    }

    const payload = {
      shipmentId: params.shipmentId,
      trackingNumber: params.trackingNumber,
      status: params.status,
      timestamp: new Date().toISOString(),
      source: params.source || "server_action",
      shipment: params.shipment || null,
    };

    // 1. Broadcast to primary shipment ID channel
    const idChannel = supabase.channel(`shipment:${params.shipmentId}`);
    await idChannel.send({
      type: "broadcast",
      event: "shipment_updated",
      payload,
    });

    // 2. Broadcast to tracking number channel if distinct
    if (
      params.trackingNumber &&
      params.trackingNumber.toUpperCase() !== params.shipmentId.toUpperCase()
    ) {
      const trackChannel = supabase.channel(`shipment:${params.trackingNumber}`);
      await trackChannel.send({
        type: "broadcast",
        event: "shipment_updated",
        payload,
      });
    }
  } catch (err) {
    // Non-blocking catch to ensure core database mutations never fail if realtime socket encounters a transient network issue
    console.warn("[Supabase Realtime] Broadcast notice:", err);
  }
}
