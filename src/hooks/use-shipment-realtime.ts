"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { Shipment as UIShipment } from "@/lib/db";
import { getShipmentByIdAction, getPublicShipmentAction } from "@/app/actions";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseShipmentRealtimeOptions {
  initialShipment?: UIShipment | null;
  shipmentIdOrTrackingNumber?: string | null;
  onUpdate?: (updatedShipment: UIShipment) => void;
  enabled?: boolean;
  isPublic?: boolean;
}

export function useShipmentRealtime({
  initialShipment = null,
  shipmentIdOrTrackingNumber = null,
  onUpdate,
  enabled = true,
  isPublic = false,
}: UseShipmentRealtimeOptions) {
  const [shipment, setShipment] = useState<UIShipment | null>(initialShipment ?? null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Sync initialShipment when changed from outside
  useEffect(() => {
    if (initialShipment) {
      setShipment(initialShipment);
      setLastUpdated(new Date());
    }
  }, [initialShipment]);

  // Keep references to avoid stale closure issues
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const lastUpdateTimestampRef = useRef<number>(Date.now());

  const targetIdentifier =
    shipment?.id ||
    shipmentIdOrTrackingNumber ||
    null;

  /**
   * Refetches latest state from the database as the single source of truth.
   */
  const refresh = useCallback(async () => {
    if (!targetIdentifier) return;
    setIsUpdating(true);
    try {
      const fresh = isPublic
        ? await getPublicShipmentAction(targetIdentifier)
        : await getShipmentByIdAction(targetIdentifier);
      if (fresh) {
        lastUpdateTimestampRef.current = Date.now();
        setShipment(fresh);
        setLastUpdated(new Date());
        if (onUpdateRef.current) {
          onUpdateRef.current(fresh);
        }
      }
    } catch (err) {
      console.error("[Realtime] Error refreshing shipment:", err);
    } finally {
      setIsUpdating(false);
    }
  }, [targetIdentifier, isPublic]);

  /**
   * Applies an incoming shipment update safely.
   */
  const applyUpdate = useCallback((freshData: UIShipment | null, eventTimestamp?: string | number) => {
    const timestampMs = eventTimestamp
      ? new Date(eventTimestamp).getTime()
      : Date.now();

    // Prevent older updates from overriding newer state
    if (timestampMs < lastUpdateTimestampRef.current) {
      return;
    }

    lastUpdateTimestampRef.current = timestampMs;

    if (freshData) {
      setShipment(freshData);
      setLastUpdated(new Date(timestampMs));
      if (onUpdateRef.current) {
        onUpdateRef.current(freshData);
      }
    } else {
      // If only partial or trigger event received, fetch complete fresh state
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !targetIdentifier) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let channel: RealtimeChannel | null = null;
    let broadcastChannel: BroadcastChannel | null = null;

    // Cross-tab sync via browser BroadcastChannel
    try {
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const channelName = `lmx8_shipment_${targetIdentifier.toLowerCase()}`;
        broadcastChannel = new BroadcastChannel(channelName);
        broadcastChannel.onmessage = (event) => {
          if (event.data?.type === "SHIPMENT_UPDATED" && event.data?.shipment) {
            applyUpdate(event.data.shipment, event.data.timestamp);
          }
        };
      }
    } catch (err) {
      console.warn("[Realtime] BroadcastChannel notice:", err);
    }

    // Set up Supabase Realtime Channel
    if (supabase) {
      const channelName = `shipment:${targetIdentifier.toLowerCase()}`;
      channel = supabase.channel(channelName);

      channel
        // 1. Broadcast event (instant payload from server actions)
        .on("broadcast", { event: "shipment_updated" }, ({ payload }) => {
          if (payload?.shipment) {
            applyUpdate(payload.shipment, payload.timestamp);
          } else {
            refresh();
          }

          // Relay to other tabs in same browser
          if (broadcastChannel && payload?.shipment) {
            broadcastChannel.postMessage({
              type: "SHIPMENT_UPDATED",
              shipment: payload.shipment,
              timestamp: payload.timestamp || new Date().toISOString(),
            });
          }
        })
        // 2. Postgres direct changes on Shipment table
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "Shipment",
            filter: `id=eq.${targetIdentifier}`,
          },
          () => {
            refresh();
          }
        )
        // 3. Postgres direct changes on TrackingEvent table
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "TrackingEvent",
            filter: `shipmentId=eq.${targetIdentifier}`,
          },
          () => {
            refresh();
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsRealtimeConnected(true);
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            setIsRealtimeConnected(false);
          }
        });
    }

    // Handle network reconnection and window focus to guarantee freshness
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const handleOnline = () => {
      setIsRealtimeConnected(true);
      refresh();
    };

    const handleOffline = () => {
      setIsRealtimeConnected(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [enabled, targetIdentifier, applyUpdate, refresh]);

  return {
    shipment,
    setShipment,
    isRealtimeConnected,
    isUpdating,
    lastUpdated,
    refresh,
  };
}
