import { prisma } from "@/lib/prisma";
import { deleteFileFromStorage } from "@/lib/storage";

/**
 * Phase 2D: Permanent File Deletion Job
 * Removes storage objects from Supabase Storage after the 7-day retention period.
 * Idempotent, safe, and retains all operational records (Customers, Shipments, Batches, TrackingEvents, AuditLogs).
 */
export async function executeBatchFileRetentionCleanup() {
  const now = new Date();

  // 1. Find all closed batches whose retention period has expired
  const expiredBatches = await prisma.batch.findMany({
    where: {
      status: "CLOSED",
      fileDeletionAt: { lte: now },
    },
    include: {
      shipments: {
        include: {
          photos: {
            where: {
              status: { not: "DELETED" },
            },
          },
        },
      },
    },
  });

  let totalFilesPermanentlyDeleted = 0;
  const processedBatchNumbers: string[] = [];

  for (const batch of expiredBatches) {
    const photosToDelete = batch.shipments.flatMap((s) => s.photos);

    let batchDeletedCount = 0;
    for (const photo of photosToDelete) {
      // Delete from Supabase Storage
      if (photo.bucket !== "local-fallback" && !photo.objectPath.startsWith("http")) {
        await deleteFileFromStorage(photo.objectPath, photo.bucket);
      }

      // Mark record as DELETED (preserves record history while clearing file presence)
      await prisma.shipmentPhoto.update({
        where: { id: photo.id },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      });

      batchDeletedCount++;
      totalFilesPermanentlyDeleted++;
    }

    processedBatchNumbers.push(batch.batchNumber);

    // Audit log per batch
    await prisma.auditLog.create({
      data: {
        action: "FILES_PERMANENTLY_DELETED",
        entityType: "Batch",
        entityId: batch.id,
        description: `Permanent deletion of ${batchDeletedCount} file(s) for closed batch ${batch.batchNumber}. 7-day retention period expired. Operational shipment & tracking records remain preserved.`,
        metadata: {
          batchNumber: batch.batchNumber,
          deletedCount: batchDeletedCount,
          retentionExpiredAt: batch.fileDeletionAt?.toISOString(),
          executedAt: now.toISOString(),
        },
      },
    });
  }

  return {
    success: true,
    processedBatchesCount: expiredBatches.length,
    processedBatchNumbers,
    totalFilesDeleted: totalFilesPermanentlyDeleted,
    executedAt: now.toISOString(),
  };
}
