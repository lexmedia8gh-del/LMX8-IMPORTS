import { MOCK_NOTIFICATIONS } from "@/lib/mock-data";

export const MOCK_NOTIFICATIONS_EXTENDED = [
  ...MOCK_NOTIFICATIONS,
  { id: "NOT-3", type: "Sourcing", message: "New sourcing request received for Wireless Earbuds.", date: "2026-09-28", read: false },
];
