-- AlterTable
ALTER TABLE "opening_stock_documents" ADD COLUMN "warehouseId" TEXT,
ADD COLUMN "createAccountingEffect" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "openingBalanceAccountId" TEXT,
ADD COLUMN "voucherId" TEXT,
ADD COLUMN "totalValueBase" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "postedAt" TIMESTAMP(3);
