import { ShipmentStatus } from "@/components/shipment-status";

export type TrackingEvent = {
  id: string;
  status: ShipmentStatus;
  date: string;
  location?: string;
  note?: string;
  timestamp?: string;
  createdAt?: string;
};

export type ShipmentPhoto = {
  id: string;
  url: string;
  filename: string;
  status?: string;
  deletedAt?: string | null;
};

export type Shipment = {
  id: string;
  customerId: string;
  description: string;
  batch?: string;
  batchName?: string;
  batchStatus?: string;
  batchStageLabel?: string;
  status: ShipmentStatus;
  registeredDate: string;
  lastUpdated: string;
  fee: number;
  origin?: string;
  destination?: string;
  shippingMethod?: string;
  estimatedArrival?: string;
  trackingEvents: TrackingEvent[];
  photos: ShipmentPhoto[];
};

export type Batch = {
  id: string;
  dbId?: string;
  name: string;
  description: string;
  shipmentCount: number;
  departure: string;
  arrival: string;
  status: string;
  closedAt?: string | null;
  fileDeletionAt?: string | null;
  createdAt: string;
};

// Global cache for Next.js dev server to prevent resetting on HMR
const globalForDb = globalThis as unknown as {
  db: {
    shipments: Shipment[];
    batches: Batch[];
  };
};

export const db = globalForDb.db || {
  shipments: [] as Shipment[],
  batches: [] as Batch[],
};

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

export const ShipmentService = {
  async getAllShipments(): Promise<Shipment[]> {
    return db.shipments;
  },

  async getShipmentById(id: string): Promise<Shipment | null> {
    return db.shipments.find(s => s.id === id) || null;
  },

  async getShipmentsByCustomer(customerId: string): Promise<Shipment[]> {
    return db.shipments.filter(s => s.customerId === customerId);
  },

  async createShipment(data: Omit<Shipment, "id" | "registeredDate" | "lastUpdated" | "trackingEvents" | "photos" | "fee">): Promise<Shipment> {
    const id = `SHP-${Math.floor(Math.random() * 90000) + 10000}`; // SHP-xxxxx
    const now = new Date().toISOString().split('T')[0];
    const newShipment: Shipment = {
      ...data,
      id,
      registeredDate: now,
      lastUpdated: now,
      fee: 0,
      trackingEvents: [{ id: `EVT-${Date.now()}`, status: data.status, date: now, note: "Shipment created in system." }],
      photos: []
    };
    db.shipments.push(newShipment);
    return newShipment;
  },

  async updateShipmentStatus(id: string, newStatus: ShipmentStatus, note?: string, location?: string): Promise<Shipment | null> {
    const shipment = db.shipments.find(s => s.id === id);
    if (!shipment) return null;
    
    const now = new Date().toISOString().split('T')[0];
    shipment.status = newStatus;
    shipment.lastUpdated = now;
    shipment.trackingEvents.push({
      id: `EVT-${Date.now()}`,
      status: newStatus,
      date: now,
      note,
      location
    });
    
    return shipment;
  },

  async addShipmentPhoto(id: string, photoUrl: string, filename: string): Promise<Shipment | null> {
    const shipment = db.shipments.find(s => s.id === id);
    if (!shipment) return null;
    shipment.photos.push({ id: `PH-${Date.now()}`, url: photoUrl, filename });
    return shipment;
  },

  async removeShipmentPhoto(shipmentId: string, photoId: string): Promise<Shipment | null> {
    const shipment = db.shipments.find(s => s.id === shipmentId);
    if (!shipment) return null;
    shipment.photos = shipment.photos.filter(p => p.id !== photoId);
    return shipment;
  }
};

export const BatchService = {
  async getAllBatches(): Promise<Batch[]> {
    return db.batches;
  },
  
  async createBatch(data: Omit<Batch, "id" | "shipmentCount" | "createdAt">): Promise<Batch> {
    const id = `BATCH-${Math.floor(Math.random() * 9000) + 1000}`;
    const now = new Date().toISOString().split('T')[0];
    const newBatch: Batch = {
      ...data,
      id,
      shipmentCount: 0,
      createdAt: now
    };
    db.batches.push(newBatch);
    return newBatch;
  },

  async getShipmentsInBatch(batchId: string): Promise<Shipment[]> {
    return db.shipments.filter(s => s.batch === batchId);
  }
};
