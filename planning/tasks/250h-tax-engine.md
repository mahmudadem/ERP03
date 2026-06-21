# 250h — Phase 3: Tax Engine extraction

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 3 (after POS V1) · **Blocking:** no
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ✅ Done (2026-06-21)

## Objective

Lift tax calculation out of Sales into a real `ITaxEngine` consumed identically by Sales, Purchases, and POS. Add the two missing capabilities: **invoice-discount tax allocation** and **purchase recoverable/non-recoverable** input tax.

## Current state (proven)

- Tax **codes** are shared (`TaxCode` in `domain/shared` + `/tax-codes` route), but **calculation** is embedded in `SalesInvoiceCalculationService` ([:58-157](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:58)) and re-implemented in `PurchaseInvoice` ([audit §F](../../docs/audit/platform-architecture-engine-vs-app-audit.md)).
- Invoice-level DISCOUNT charges carry no tax and aren't allocated to lines ([SalesInvoiceCalculationService.ts:130-135](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:130)).
- Purchase recoverable vs non-recoverable input tax: missing.

## Target

`ITaxEngine.calcLine / calcCharge / allocateInvoiceDiscount / recoverable`. Sales + Purchases + POS consume it; modules only **apply/override** tax per policy. `TaxCode` data + its management UI stay in System/Finance (already true at data layer).

## Scope — files

- Move the math from `SalesInvoiceCalculationService` into `application/system-core/tax/TaxEngine.ts`; the Sales service becomes a thin caller (or is deleted in favor of the engine).
- Repoint Purchases tax math (`PurchaseInvoice` + `PurchasePostingHelpers`) at `ITaxEngine`.
- Implement `allocateInvoiceDiscount` (proportional-by-net, excludes non-discountable/gift/tax-exempt) and `recoverable(taxCode)`.
- Extend `SystemCoreBoundaries.test.ts` to ban modules re-implementing tax math once the engine exists.

## Tests

- **T8 — single source:** Sales, Purchases, POS produce identical line tax for the same `TaxCode` input through `ITaxEngine` (golden totals); no module re-implements the math.
- Golden-total regression for current SI/PI tax (behavior-preserving for existing cases).
- New tests for discount allocation + recoverable.

## Acceptance criteria

- [x] Tax math lives in `ITaxEngine`; Sales/Purchases/POS consume it.
- [x] Invoice-discount tax allocation + recoverable implemented + tested.
- [x] T8 + golden regressions pass; typecheck + build clean.

## Definition of Done

- [x] Commit: `refactor(system-core): extract tax engine; add discount allocation + recoverable [250h]`
- [x] `planning/done/250h-tax-engine.md` report; update `docs/architecture/system-core.md` tax section.

## CTO audit gate

Reject if any module still computes tax locally, or if existing SI/PI tax totals changed outside the intended discount-allocation fix.
