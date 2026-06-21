# 250l — Phase 4: Commercial Core (pricing / discount / promotions / cost-margin)

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 4 (long-term, highest risk) · **Blocking:** no
**Depends on:** [250h](./250h-tax-engine.md), [250e](./250e-approval-engine.md), [250c](./250c-policy-engine-pos-decoupling.md) · **Agent:** erp-backend-builder · **Estimate:** 6–10 days (split into sub-slices)
**Status:** ✅ CTO-audited 2026-06-21 — 250l-1 `e0334021`, 250l-2 `f2c3c6eb`, 250l-3 `c77c7e36`. **PASS WITH CAVEATS:** 250l-2 clean; 250l-1 partial (SO/PO/SR/PR helpers remain — FUP-2); **⚠️ 250l-3 promotions lack the mandatory stacking/cap model (FUP-1) — re-homing accepted only because POS promotion application is default-dormant; do NOT enable in production until the cap model lands.** See ACTIVE.md Phase 4 verdict.

## Objective

Re-home pricing, line/discount calculation, invoice-discount allocation, promotions, and cost/margin & below-cost policy from Sales (and duplicated Purchases) into one `ICommercialCore`, consumed by Sales, Purchases, and POS. This is the **highest-risk** phase — it touches the most posting-sensitive math — so it is **last** and behind golden tests.

## Current state (proven)

- Line + discount math in `SalesInvoiceCalculationService` + `SalesInvoice`; a **separate** Purchases price-list impl; POS has none ([engines-audit §C-5](../../docs/audit/system-core-shared-engines-audit.md)).
- Promotions: `PromotionApplicationService` — sales-only, unwired, advisory ([POS §9 E](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)).
- Cost/margin, below-cost policy, invoice-discount line allocation, flash sales, BXGY-in-document, coupons: **all missing** ([POS §9 D/E](../../docs/audit/pos-commercial-rules-and-promotions-audit.md)).

## Target

`ICommercialCore.resolvePrice / calcDiscount / applyPromotions / validateCostMargin`. Pricing/discount/promotions/cost-margin become engine concerns; modules apply/override per `IPolicyEngine`, with overrides routed to `IApprovalEngine` when policy requires.

## Recommended sub-slices (each its own commit + report)

1. **250l-1 Pricing + line/discount calc** — unify Sales/Purchases price lists + line/discount math behind `ICommercialCore`; wire POS resolvePrice. (Tax allocation already in `ITaxEngine` from 250h.) ✅ Complete (2026-06-21): line discount/amount calculation now routes through Commercial Core for SI/PI; POS search calls `resolvePrice`; price-list persistence remains module-local pending a broader migration.
2. **250l-2 Cost/margin guard** — `validateCostMargin` (below-cost / min-margin), reading inventory cost from `IInventoryCore`; below-cost override → `IApprovalEngine` (`below_cost_sale` subject from 250e). ✅ Complete (2026-06-21): Commercial Core validates margin; POS sale posting blocks pending below-cost sales after actual inventory cost is known and allows approved overrides.
3. **250l-3 Promotions (POS-aware)** — wire the evaluator into the sale flow; stacking/conflict model; free-goods line insertion. ✅ Complete (2026-06-21): Commercial Core owns the neutral evaluator; Sales' promotion service is a compatibility wrapper; POS posting applies threshold discounts/free goods before tax/posting.

## Tests

- Golden-total regression: existing SI/PI line/discount/price output unchanged after re-homing.
- Cost/margin guard unit tests + below-cost approval path (`below_cost_sale` → PENDING → APPROVED → posts).
- Promotion application tests per type as slices land.

## Acceptance criteria

- [x] Pricing/discount/cost-margin/promotions owned by `ICommercialCore`; Sales/Purchases/POS consume it. (250l-1 complete for line discount/amount calculation and POS price seam; 250l-2 complete for POS cost-margin guard; 250l-3 complete for promotion evaluation.)
- [ ] No module re-implements pricing/discount math. (Partial: SI/PI line amount path moved; SO/PO/SR/PR local helpers remain follow-up scope.)
- [x] Golden regressions pass; new guard/promotion tests pass. (250l-1 focused golden regressions pass; 250l-2 guard tests pass; 250l-3 focused promotion/POS tests pass.)
- [x] typecheck + build clean for 250l-1 and 250l-2.

## Definition of Done

- [x] Per-slice commits: `refactor(system-core): commercial core <slice> [250l-N]`
- [x] `planning/done/250l-commercial-core.md` (rolls up slices).
- [x] `docs/architecture/system-core.md` commercial section; fold `pricing.md` + `promotions.md` references.

## CTO audit gate

This is the riskiest phase. Reject any slice that changes existing posting-sensitive totals outside an explicitly documented fix, or that wires promotions without the stacking/cap model. Insist on golden-total proof before each slice merges.
