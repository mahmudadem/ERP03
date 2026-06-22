# Task 251 — POS QA Readiness and Requirements Gap Plan

**Status:** in progress
**Started:** 2026-06-22
**Owner goal:** compare the POS module against the attached required-feature list, close concrete correctness gaps, and leave an owner-runnable test guide.

## Current Have / Not Have

### Already in place

- POS setup wizard and `/pos/setup` route.
- POS settings for direct-sale policy, walk-in customer, receipt prefix, payment-method behavior, cash rounding, and cash over/short accounts.
- Register management with warehouse, cash drawer, and non-cash settlement accounts.
- Shift lifecycle: open, cash movement, X report, close, force close, over/short voucher.
- Terminal sale flow through POS-owned posting over System Core inventory/accounting seams.
- Return flow linked to original receipt and POS-owned return posting over System Core inventory/accounting seams.
- POS reports under `ReportContainer`.
- Audit records for POS receipt, return, register, shift, and settings actions through `IAuditEngine` where wired.
- Production promotion hard gate: POS does not read/apply promotion rules by default.
- Architecture tests prove POS application code does not import Sales application/domain internals.

### Gaps found in this slice

1. **Payment Methods report placeholder**
   The report returned zero rows even though `PosPayment` rows are persisted.
   **Risk:** manager cannot reconcile tender mix after a shift/day.
   **Fix:** aggregate stored payment rows for the selected receipts; report CASH net of change.

2. **Settlement-account routing drift**
   Docs and UI expect register-level money routing, but sale/return posting still used company-level POS settings settlement accounts.
   **Risk:** multi-register companies can post card/cash activity to the wrong account, weakening cash drawer reconciliation and auditability.
   **Fix:** use register cash drawer for CASH and register settlement accounts for CARD/BANK_TRANSFER/CUSTOM; block before posting when a required register account is missing.

3. **Stale QA/docs after System Core**
   The POS guide still told testers to verify a Sales Settings `pos_direct_sale_form_allow` rule and allowed placeholder payment totals.
   **Risk:** owner QA checks the wrong control and accepts an incomplete report.
   **Fix:** update POS golden path and docs to verify POS policy and real payment aggregation.

4. **Promotion hard gate missing from this branch**
   The attached requirements require promotions to remain disabled until stacking/cap/conflict/return rules exist.
   **Risk:** active stored rules could silently discount POS sales without a complete promotion-control model.
   **Fix:** add `arePromotionsEnabledInProduction()` guard; tests can explicitly open it, production remains closed.

5. **POS stock movement refs carried Sales labels**
   POS stock OUT/return used `SALES_INVOICE` / `SALES_RETURN` reference labels even though posting metadata used `POS_DIRECT_SALE`.
   **Risk:** reports/audits can misclassify POS movements as Sales documents.
   **Fix:** add `POS_DIRECT_SALE` and `POS_RETURN` inventory reference types and assert them in POS tests/architecture guard.

## Requirement Matrix

| Requirement area | Current status | Notes / next action |
|---|---|---|
| Standalone POS over shared engines | ✅ Mostly done | POS application imports no Sales application/domain internals; sale/return posting uses System Core interfaces. |
| Sales App disabled | ✅ Backend boundary covered | POS settings policy test proves no SalesSettings dependency; architecture guard blocks Sales imports. Browser entitlement test remains owner QA. |
| POS_DIRECT_SALE persona | ✅ Strengthened | Ledger metadata, inventory movement metadata, and stock refs now preserve POS identity. Accounting voucher enum still uses existing `SALES_INVOICE` / `SALES_RETURN` voucher types for GL classification; adding POS voucher types is a separate accounting-policy decision. |
| Promotion disabled by default | ✅ Done | Production guard blocks rule reads. Existing promotion evaluator tests use explicit test hook only. |
| Register config | ✅ P0 config fields done | Name, branch text, warehouse, receipt numbering, payment methods, settlement accounts, default price list id, allowed cashiers, and hardware profile id exist. Allowed cashiers are enforced on shift open. Price-list and hardware fields are stored placeholders until their integration slices consume them. |
| Shift/session | ✅ P0 reconciliation done | Open/close/cash movement/X report/force close exist. Shift close now stores expected, counted, and variance totals by payment method and marks fully balanced shifts as `RECONCILED`. Cash variance still posts the over/short voucher; non-cash variance is stored for settlement follow-up. |
| Payments/change | 🟡 Partial | CASH/CARD/BANK/CUSTOM mixed payments, change, cash rounding, per-register settlement accounts exist. Missing: multi-currency tender/exchange-rate freeze and card/bank fees. |
| Void instead of delete | ✅ Slice 1 done | Terminal line removal now records `VOIDED` line snapshots with cashier, time, and reason. Voided lines stay on the receipt audit trail, are excluded from posting totals/stock/ledger, and cannot be returned. Remaining follow-up: posted-receipt void/cancel flow. |
| Manager override | 🟡 Backend hooks done | Below-cost uses approval via Commercial Core/Approval Engine. POS policy can now require manager approval for void, price override, discount override, return, tax override, and reprint; sale/return use cases enforce available hooks. Cashier role limits also require approval when configured. Missing: cashier-facing manager approval capture UI and posted receipt reprint endpoint enforcement. |
| Return/exchange | ✅ P0 backend done | Receipt-based selected-line returns, refunds, duplicate-return prevention, posted receipt void via full POS return, and exchange as linked POS return + replacement POS sale exist. Remaining follow-up: cashier-facing exchange UI polish. |
| Price/discount/tax edit policies | 🟡 Backend controls done | Cashier role limits exist for max line discount percent/amount and price/tax override permission; sale completion blocks over-limit lines unless a manager override id is supplied. Receipt snapshots and the override audit report expose void/discount/price/tax exceptions. Missing: manager approval capture UI and a dedicated override-audit report page. |
| Selling policies | 🟡 Partial | Inventory core handles negative stock policy; below-cost can require approval. Missing inactive/blocked/expired/non-POS-enabled/non-discountable item guards as POS policy. |
| Touch layout/quick actions | 🟡 Partial | Basic product search/cart exists and line void workflow now exists. Missing favorites, category buttons, per-terminal layout, hold/recall, serial number, and line note. |
| Promotions/offers | ⏸ Deferred | Must stay disabled until stacking/cap/conflict/return model lands. |
| POS reports | 🟡 Partial | Z, daily, payment, cashier, over/short, receipt history exist. Missing voided lines, cancelled receipts, manual discounts, price/tax overrides, reprints, top-selling items, promotion performance. |
| Hardware/offline | ⏸ Deferred | No hardware abstraction or offline queue yet; should be placeholders/plans only for V1 unless owner prioritizes. |

## Recommended Implementation Phases

### Phase 1 — Accounting-control fixes (done in this branch)

- Route POS sale settlements from the active register.
- Route POS refunds from the active register.
- Let payment-method settings define behavior only; register accounts define money routing.
- Aggregate Payment Methods report from stored `PosPayment` rows.
- Hard-disable promotions by default.
- Preserve POS identity in stock movement references.

**Estimate:** 2–3h.
**Tests:** focused POS sale, return, settings, reporting, architecture tests; backend typecheck/build.

### Phase 2 — Owner QA run

- Run `planning/qa/golden-paths/06-pos.md` on a fresh company after GP01 and GP02 are green.
- Record any failure in `planning/qa/findings.md`.

**Estimate:** 60–90 minutes manual run if master data already exists.

### Phase 3 — Remaining P0/P1 slices after QA

- **P0 slice 1 complete:** POS void-line audit model for pre-payment cart lines.
- **P0 slice 2 complete:** Manager override policy hooks for void, price change, discount, returns, tax override, and reprint; sale/return backend enforcement added where the current payload supports the action.
- **P0 slice 3 complete:** Register defaults for price list, allowed cashiers, and hardware profile placeholder; allowed cashiers enforced on shift open.
- **P0 slice 4 complete:** Shift counted/expected by payment method and `RECONCILED` status.
- **P0 slice 5 complete:** Cashier price/discount/tax policy limits, receipt audit fields, and override audit report API.
- **P0 slice 6 complete:** Posted receipt void/cancel through full remaining POS return plus duplicate-return guard.
- **P0 slice 7 complete:** Exchange workflow as linked POS return + replacement POS sale sharing `exchangeId`.
- **P0 next slice:** Cashier-facing exchange UI polish or hold/recall.
- Decide whether POS needs a printable receipt template before pilot.
- Decide whether receipt/return reprint should include a stronger audit event.
- Decide whether branch should remain free text or wait for a first-class Branch entity.
- Keep promotions disabled in production until the stacking/cap model is implemented.

## Accounting Review

This is a cash-control and settlement-routing fix. It does not change tax math, COGS math, inventory valuation, period locks, approval rules, or voucher balancing. The important financial correction is that each register now owns its settlement accounts, which is market-standard POS behavior and prevents one till from posting money to another till's accounts.

## Acceptance Criteria

- CASH sale uses `PosRegister.cashDrawerAccountId`.
- CARD/BANK_TRANSFER/CUSTOM sale uses `PosRegister.settlementAccountIds[method]`.
- Missing non-cash register account blocks sale before receipt/document posting.
- POS return uses the active register settlement account for the refund method.
- Payment Methods report totals persisted payment rows and nets CASH change.
- POS QA guide no longer accepts placeholder payment-method totals.
- Promotions are hard-disabled unless explicitly opened by test hook.
- POS stock movement refs use `POS_DIRECT_SALE` / `POS_RETURN`, not Sales document refs.
- Architecture guard proves POS application code does not import Sales app/domain internals.
- Cashier role limits can require manager approval for over-limit discounts and blocked price/tax overrides.
- Receipt snapshots preserve discount/price/tax/void override metadata.
- Override audit report returns exception rows for manager review.
- POS returns subtract prior returns from remaining returnable quantity.
- Posted receipt void creates a POS return for all remaining active quantities before marking the receipt `VOIDED`.
- POS exchange creates a linked return and replacement sale with one exchange id and reports net due/refund.
