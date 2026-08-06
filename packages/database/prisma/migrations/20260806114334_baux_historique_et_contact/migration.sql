/*
  Warnings:

  - Added the required column `rentAmount` to the `Lease` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Lease_unitId_key";

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "rentAmount" INTEGER NOT NULL,
ADD COLUMN     "tenantName" TEXT,
ADD COLUMN     "tenantPhone" TEXT;

-- CreateIndex
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");
