# POS Independence

**Status:** Epic 250 in progress. 250d decoupled POS sale posting; 250d2 decoupled POS return posting and enabled the folder-wide POS-to-Sales application/domain import ban.

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

## POS Return Posting

250d2 introduces `PostPosReturnUseCase` as the POS-owned reversal entry point. `CompletePosReturnUseCase` no longer constructs `CreateSalesReturnUseCase`, `PostSalesReturnUseCase`, or references Sales Return domain entities.

The POS return path now:

1. validates the original completed receipt, current open shift, register, and return quantities;
2. restocks returned tracked items through `IInventoryCore.processIN`;
3. records revenue/tax reversal, COGS reversal, and refund settlement through `IAccountingBridge.recordFinancialEvent`;
4. persists the POS return and refund cash movement in the same transaction.

The return path uses optional posting metadata captured on POS receipt line snapshots by the 250d/250d2 sale path: revenue account, tax account, COGS account, inventory account, and original unit/line cost. Existing receipts that lack the optional cost metadata still load; COGS reversal posts when cost/account metadata is available.

## Architecture Guard

`backend/src/tests/architecture/SystemCoreBoundaries.test.ts` now enables the folder-wide guard: files under `backend/src/application/pos/` must not import Sales application internals or Sales domain internals. There is no 250d2 skip left in that guard.
