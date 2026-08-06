-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'DEPOSIT';

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "advanceMonths" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "depositAmount" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "periodFrom" TEXT,
ADD COLUMN     "periodTo" TEXT;
