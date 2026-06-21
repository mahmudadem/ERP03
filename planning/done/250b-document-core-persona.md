# 250b - Document Core Persona incl POS_DIRECT_SALE

**Date:** 2026-06-21  
**Branch:** `feat/system-core-transformation`  
**Worktree:** `D:\DEV2026\ERP03-system-core`  
**Task:** [250b - Phase 1: Document Core + POS_DIRECT_SALE persona](../tasks/250b-document-core-persona.md)  
**Status:** Complete, pending CTO audit  
**Actual time:** ~1.4h implementation and focused verification; full-suite gate recorded before commit

## Technical Developer View

250b makes the POS document persona first-class without changing the current accounting posting path. `DocumentPolicyResolver` now accepts canonical document personas through a compatibility mapper and maps legacy `direct`, `linked`, and `service` values back to the canonical System Core names. `POS_DIRECT_SALE` maps to the legacy `direct` policy bucket only for authorization compatibility; it remains preserved as `documentPersona`.

`SalesInvoice` now carries optional `documentPersona`. `CreateSalesInvoiceUseCase` resolves and persists it from either `documentPersona` or a canonical persona input, while still deriving the legacy Sales persona needed by the existing Sales invoice implementation. `PostSalesInvoiceUseCase` copies the durable document persona into revenue voucher metadata, COGS voucher metadata, and settlement receipt voucher metadata.

`CompletePosSaleUseCase` now sends `documentPersona: 'POS_DIRECT_SALE'` in the Sales compatibility payload. It still sends `voucherType: 'sales_invoice'` and legacy `persona: 'direct'` until 250d replaces POS's Sales entry point; the important 250b boundary is that POS identity is no longer only a `formType: 'pos_sale'` tag.

## End-User View

There is no visible UI change. POS sales should continue posting and settling the same way as before. Internally, POS sales now carry a clear POS identity into accounting metadata, so future reports, audit views, and posting decoupling can distinguish POS direct sales from ordinary Sales invoices without relying on a form-name workaround.

## Files Changed

- `backend/src/application/common/services/DocumentPolicyResolver.ts`
- `backend/src/application/common/services/__tests__/DocumentPolicyResolver.test.ts`
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts`
- `backend/src/domain/sales/entities/SalesInvoice.ts`
- `backend/src/tests/application/pos/CompletePosSale.test.ts`
- `backend/src/tests/application/sales/SalesPostingUseCases.test.ts`
- `docs/architecture/system-core.md`
- `planning/tasks/250b-document-core-persona.md`
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

## Verification

- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend test -- --runTestsByPath src/application/common/services/__tests__/DocumentPolicyResolver.test.ts src/tests/application/pos/CompletePosSale.test.ts src/tests/application/sales/SalesPostingUseCases.test.ts --runInBand` passed: 3 suites, 66 tests.
- `npm --prefix backend run build` passed.
- `npm --prefix backend test -- --runInBand` passed: 176/178 suites passed, 2 skipped; 1567 tests passed, 19 skipped, 1586 total.

## Accounting / Control Impact

No posting math, account mapping, tax calculation, inventory valuation, stock movement, AR settlement, approval, period-lock, or voucher balancing behavior changed. The only accounting-facing change is metadata: vouchers now carry `metadata.documentPersona`, including `POS_DIRECT_SALE` for POS-originated Sales compatibility documents.

## Known Notes

250b deliberately does not remove the POS dependency on Sales invoice use cases. That is the scope of 250d. Until 250d, `voucherType: 'sales_invoice'` remains the technical compatibility voucher type, while `documentPersona` is the durable POS identity.

## Next Step

Proceed to 250c: decouple POS direct-sale authorization from Sales Settings/governance while keeping the 250b persona metadata intact.