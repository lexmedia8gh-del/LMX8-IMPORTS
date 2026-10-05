import { ShipmentStatus } from "@/components/shipment-status";

export const MOCK_CUSTOMERS = [
  { id: "LMX-10294", name: "John Doe", email: "john@example.com", phone: "+233 20 123 4567", status: "Active", createdAt: "2026-01-15", credits: 50 },
  { id: "LMX-10295", name: "Jane Smith", email: "jane@example.com", phone: "+233 24 987 6543", status: "Active", createdAt: "2026-02-20", credits: 10 },
];

export const MOCK_SHIPMENTS = [
  { id: "SHP-9921", customerId: "LMX-10294", description: "Electronics Pallet", batch: "BATCH-001", status: "IN_TRANSIT" as ShipmentStatus, registeredDate: "2026-09-10", lastUpdated: "2026-09-25", fee: 1250.00 },
  { id: "SHP-9922", customerId: "LMX-10294", description: "Fashion Apparel", batch: "BATCH-002", status: "SHIPMENT_CREATED" as ShipmentStatus, registeredDate: "2026-09-26", lastUpdated: "2026-09-27", fee: 0 },
  { id: "SHP-9923", customerId: "LMX-10295", description: "Home Appliances", batch: "BATCH-001", status: "DELIVERED" as ShipmentStatus, registeredDate: "2026-08-01", lastUpdated: "2026-08-20", fee: 4500.00 },
];


export const MOCK_INVOICES = [
  { id: "INV-501", customerId: "LMX-10294", shipmentId: "SHP-9921", amount: 1250.00, date: "2026-09-20", dueDate: "2026-10-05", status: "Pending" },
  { id: "INV-502", customerId: "LMX-10295", shipmentId: "SHP-9923", amount: 4500.00, date: "2026-08-15", dueDate: "2026-08-30", status: "Paid" },
];

export const MOCK_SOURCING_REQUESTS = [
  { id: "SRC-101", customerId: "LMX-10294", product: "Wireless Earbuds", qty: 500, specs: "Black, Bluetooth 5.3", status: "Awaiting Review", date: "2026-09-28" },
  { id: "SRC-102", customerId: "LMX-10294", product: "Smart Watches", qty: 200, specs: "Silver, Heart Rate Monitor", status: "Quotation Provided", date: "2026-09-20" },
];

export const MOCK_CREDIT_PACKAGES = [
  { id: "PKG-1", name: "Starter Sourcing", credits: 5, price: 100.00 },
  { id: "PKG-2", name: "Pro Sourcing", credits: 20, price: 350.00 },
  { id: "PKG-3", name: "Enterprise Sourcing", credits: 50, price: 750.00 },
];

export const MOCK_NOTIFICATIONS = [
  { id: "NOT-1", type: "Shipment", message: "Shipment SHP-9921 is now In Transit to Ghana.", date: "2026-09-25", read: false },
  { id: "NOT-2", type: "Invoice", message: "New invoice INV-501 generated for SHP-9921.", date: "2026-09-20", read: true },
];

export const MOCK_BATCHES = [
  { id: "BATCH-001", description: "September Sea Freight", shipmentCount: 45, departure: "2026-09-15", arrival: "2026-10-25", status: "In Transit" },
  { id: "BATCH-002", description: "Late September Air Freight", shipmentCount: 12, departure: "2026-09-28", arrival: "2026-10-02", status: "Processing" },
];

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
};
