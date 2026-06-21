# 250f — Phase 2: Money / Currency / Rounding Core

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 2 (during V1) · **Blocking:** no
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 1–2 days
**Status:** ✅ Done 2026-06-21 — see [250f completion report](../done/250f-money-core.md)

## Objective

Replace the ~17 copy-pasted `roundMoney` definitions with **one precision-aware `IMoneyCore`**, and **apply POS cash rounding** (currently stored but never used). Behavior-preserving for existing 2-decimal currencies.

## Current state (proven)

- `roundMoney` is defined locally in ~17 modules, almost all hardcoded to 2 decimals, bypassing `CurrencyPrecisionHelpers` ([engines-audit §C-3](../../docs/audit/system-core-shared-engines-audit.md)); e.g. [SalesInvoiceCalculationService.ts:7](../../backend/src/application/sales/services/SalesInvoiceCalculationService.ts:7). Only `VoucherLineEntity` is precision-aware.
- POS `cashRounding` is **stored only, never applied** ([POS §9 B](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)).

## Target

`IMoneyCore.round(value, currency)` / `roundCash(value, currency, rule)` / `toBase(value, ccy, rate)` (helper created in 250a). Adopt it everywhere; delete local copies.

## Scope — files

- Replace local `roundMoney` in the ~17 sites (sales/purchases/inventory/pos/shared entities + services listed in [engines-audit §C-3](../../docs/audit/system-core-shared-engines-audit.md)) with `IMoneyCore.round`.
- Apply `roundCash` at POS sale completion (`CompletePosSaleUseCase` / `PostPosSaleUseCase`) using `PosSettings.cashRounding`.

## Tests

- **T9 — single rounding:** all modules round through one helper; a currency with non-2 precision rounds correctly end-to-end (new golden test).
- Regression: existing totals tests unchanged for 2-decimal currencies.
- POS cash-rounding test: tendered total reflects the configured rounding rule.

## Acceptance criteria

- [x] Zero remaining local `roundMoney` definitions (grep clean except the single core helper + `VoucherLineEntity` if intentionally kept).
- [x] POS cash rounding applied and tested.
- [x] typecheck + build clean; suite green (2-decimal totals unchanged).

## Definition of Done

- [x] Commit: `refactor(system-core): single money/rounding core; apply POS cash rounding [250f]`
- [x] `planning/done/250f-money-core.md` report.

## CTO audit gate

Reject if any local `roundMoney` survives, or if a 2-decimal total changed (this must be behavior-preserving except the intended cash-rounding application).
