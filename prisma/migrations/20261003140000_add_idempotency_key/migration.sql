-- Phase 2E Final Hardening: Add idempotencyKey to SourcingRequest
-- This column is nullable (String?) so existing rows are unaffected.
-- The UNIQUE constraint prevents duplicate processing of the same logical request.

ALTER TABLE "SourcingRequest" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "SourcingRequest_idempotencyKey_key" ON "SourcingRequest"("idempotencyKey");
