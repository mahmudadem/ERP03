# POS Independence

**Status:** Epic 250 in progress. 250d decouples POS sale posting. POS returns are still intentionally deferred to 250d2.

## Boundary

POS is an application module. It must orchestrate register, shift, receipt, cash drawer, sale, and return workflows without importing Sales application use-cases or Sales domain entities.

System Core owns the reusable engine seams:

- `IPolicyEngine` decides whether POS direct sale is allowed.
- `IInventoryCore` writes stock movements and stock-level effects.
- `IAccountingBridge` records financial events through the accounting posting door.

## POS Sale Posting

250d introduces `PostPosSaleUseCase` as the POS-owned posting entry point. `CompletePosSaleUseCase` no longer constructs `CreateSalesInvoiceUseCase` or `PostSalesInvoiceUseCase`.

The POS sale path now:

1. validates shift, cashier, register, payment method, and POS policy;
2. dry-runs POS sale totals for payment validation;
3. posts stock OUT for tracked items through `IInventoryCore.processOUT`;
4. records revenue/tax, COGS, and settlement vouchers through `IAccountingBridge.recordFinancialEvent`;
5. persists the POS receipt, payments, cash movement, and receipt sequence in the same transaction.

The sale carries `documentPersona: POS_DIRECT_SALE` in stock movement metadata and voucher metadata. V1 still uses the canonical accounting voucher type `SALES_INVOICE` for ledger strategy compatibility, but the source module/type metadata is POS-owned:

- `sourceModule: pos`
- `sourceType: POS_SALE`
- `documentPersona: POS_DIRECT_SALE`

## Accounting Impact

The 250d sale path preserves the same financial shape expected from POS direct sale:

- Dr AR / Cr revenue and sales tax;
- Dr COGS / Cr inventory when tracked inventory has settled cost;
- Dr settlement account / Cr AR for the applied payment amount;
- cash change is netted out before settlement posting.

The POS-configured payment-method settlement account is authoritative for settlement vouchers. Customer AR account comes from the selected/walk-in customer. Item revenue, COGS, and inventory accounts come from item/category/inventory settings.

## Remaining 250d2 Work

POS returns still use the Sales return path until 250d2. The architecture test therefore has two guards:

- active 250d sale-path ban for `CompletePosSaleUseCase` and `PostPosSaleUseCase`;
- skipped folder-wide POS-to-Sales ban with a TODO to enable in 250d2.

250d2 must decouple returns and then turn on the folder-wide ban with no skips.
