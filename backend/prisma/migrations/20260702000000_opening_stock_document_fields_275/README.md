# Migration: opening_stock_document_fields_275
Purpose: schema↔repository reconciliation (Epic 275 — code/domain is truth).

`PrismaOpeningStockDocumentRepository.updateDocument()` threw a
`PrismaClientValidationError` (`Unknown argument \`postedAt\``) when posting an
Opening Stock document, because `model OpeningStockDocument` was missing the
document-level fields the domain entity
(`src/domain/inventory/entities/OpeningStockDocument.ts`) carries.

Columns added to `opening_stock_documents` (all additive, no data loss):

* `warehouseId` TEXT NULL — plain scalar, no relation (GoodsReceipt convention)
* `createAccountingEffect` BOOLEAN NOT NULL DEFAULT false
* `openingBalanceAccountId` TEXT NULL — plain scalar, no relation
* `voucherId` TEXT NULL — plain scalar, no relation
* `totalValueBase` DOUBLE PRECISION NOT NULL DEFAULT 0 (Float, sibling convention)
* `postedAt` TIMESTAMP(3) NULL

Applied to the local QA DB via `prisma db push --skip-generate`.
Production deployment should run `prisma migrate deploy`.
