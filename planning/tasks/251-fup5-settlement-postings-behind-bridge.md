# Task 251 (FUP-5) — Route settlement/payment postings behind `IAccountingBridge`

> **Status:** Not started. Carved out of FUP-3 on 2026-06-22.
> **Blocking?** No. This is post-epic hardening, not a POS blocker. Document-voucher posting is already fully behind the bridge.
> **Why separate from FUP-3:** FUP-3 was a *wiring* task (the document posters already used `SubledgerDocumentPoster`, which now routes through the bridge). Settlement uses a **different posting mechanism** and migrating it needs a design decision, not just wiring.

## Background

FUP-3 routed all 10 **document** vouchers (SI/PI/SR + DeliveryNote/GoodsReceipt/PurchaseReturn + the 4 inventory docs) through `IAccountingBridge`, so the full-vs-minimal decision (no GL voucher when the Accounting App is disabled) now applies to them. Full-mode posting is byte-identical, proven by golden Dr/Cr parity tests in `SubledgerDocumentPoster.test.ts`.

What remains are the **settlement / payment receipt** postings, which do **not** go through `SubledgerDocumentPoster`. They build a `VoucherEntity` by hand and post it through `PostingGateway` directly (the "single sanctioned ledger door"):

- `SalesInvoiceUseCases.ts` — `processSettlements` (~line 1924–2010): builds the receipt `VoucherEntity`, then `new PostingGateway(this.ledgerRepo, this.voucherValidationService).record(...)`.
- `PurchaseInvoiceUseCases.ts` — the equivalent purchase-payment settlement path (~line 1360).
- `PaymentSyncUseCases` (sales + purchases) — same gateway-direct mechanism.

## The design decision (do this first)

`IAccountingBridge.recordFinancialEvent` currently accepts a **subledger voucher input** (`PostSubledgerVoucherInput`) and posts via `SubledgerVoucherPostingService.postInTransaction`. The settlement paths instead hand a **pre-assembled `VoucherEntity`** to `PostingGateway`. Pick one:

- **Option A — extend the bridge** to accept a pre-built voucher (e.g. a second method `recordPreBuiltVoucher(voucher, { transaction, kind })` or a discriminated `FinancialEvent`). Lowest churn to settlement code; widens the bridge contract.
- **Option B — refactor settlement** to the subledger-input shape so it can reuse `SubledgerDocumentPoster` / the existing bridge method. More churn in the most accounting-sensitive code; keeps one bridge entry point.

Recommendation: **Option A** — settlement receipts are genuinely a different shape (single cash/AR pair, policy-exempt, system-generated) and forcing them through the subledger assembler risks behavior drift on money movement.

## Acceptance criteria

- [ ] Settlement/payment receipt vouchers (SI settlement, PI settlement, PaymentSync sales + purchases) route through `IAccountingBridge`.
- [ ] **Full mode (Accounting App enabled): byte-identical voucher** to today — proven by a golden Dr/Cr parity test per path (assert the exact lines/amounts/accounts the gateway receives are unchanged).
- [ ] **Minimal mode (Accounting App disabled): no GL voucher**, a `PostingLog` minimal-journal event instead, mirroring `LegacyAccountingBridgeAdapter.recordMinimalJournal`.
- [ ] Period-lock + the policy-exemption (`exemptionReason: 'system-generated settlement receipt'`) behavior preserved in full mode.
- [ ] Full backend suite green; backend typecheck + build clean.

## Notes / guardrails

- Behavior-preserving for accounting-enabled tenants is mandatory — settlement touches cash/AR/AP. No total or account may change in full mode.
- Pre-alpha (no production data), so the minimal-mode delta for app-disabled tenants is acceptable and intended.
- Keep `PostingGateway` as the actual ledger writer in full mode (don't reroute through `postInTransaction` unless Option B is chosen deliberately).
