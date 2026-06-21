# POS Audit — Section 9: Commercial Rules, Price Overrides, Discounts, Taxes & Promotions

**Date:** 2026-06-21
**Scope:** Does the shipped POS module (Task 247, all 5 phases) support a real *commercial rules engine*, or only manual line editing / pass-through to Sales?
**Method:** code-only. Nothing below is assumed; every claim cites an exact file/line. "Missing" means no code was found that implements it.
**Status:** This is **Section 9** of the POS audit. It is a findings document only — *no implementation, no migrations, no schema changes have been made.*

> **One-line verdict:** There is **no POS commercial-rules engine.** POS is a thin cart → Sales Invoice pass-through. Discounts and tax codes are *accepted by the backend with zero policy, zero reason tracking, zero approval, and zero audit*, while the shipped cashier UI doesn't even surface them. A generic Sales promotions engine exists but is **not wired to POS (or to Sales documents).** No below-cost / margin / selling-restriction logic exists anywhere on the POS path except an indirect negative-stock guard.

---

## How POS actually prices a sale today (the baseline)

POS does **not** own any pricing, tax, discount, or COGS math. `CompletePosSaleUseCase` builds a `CreateSalesInvoiceInput` from the cart and delegates to the existing `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase`:

- Cart line shape — [`PosCartLine`](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:21): `itemId, qty, unitPrice, discountType?, discountValue?, taxCodeId?`.
- These are passed straight through to the SI line ([CompletePosSaleUseCase.ts:209-217](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:209)): `unitPriceDoc, discountType, discountValue, taxCodeId, warehouseId`.
- The **only** line guards are: `itemId` present, `qty > 0`, `unitPrice > 0` ([CompletePosSaleUseCase.ts:113-138](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:113)). There is no upper bound, no cost check, no policy check.
- The shipped cashier UI ([`PosTerminalPage.tsx`](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx)) takes `unitPrice` from `item.salePrice` as **read-only** ([:188](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:188), [:209](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:209)), never sets `lineDiscount` (so `discountTotal` is always `0`, [:142](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:142)), and sends **only** `{ itemId, qty, unitPrice }` to `completeSale` ([:287](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:287)) and `previewSale` ([:152](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:152)).
- The API client `posApi.completeSale` *does* declare `discountType/discountValue/taxCodeId` ([posApi.ts:137](../../frontend/src/api/posApi.ts:137)) — so the **backend door is open even though the current screen doesn't use it.**

**Consequence:** the governance gap is on the **API surface**, not the screen. Any client (or a future screen) can post arbitrary discounts, prices, and tax codes through `/tenant/pos/sales` with no control.

---

## A. Line-Level Editability Policies

| Capability | Status | Evidence |
|---|---|---|
| Change item price at line level | ⚠️ Backend accepts (`unitPrice`), UI read-only | [CompletePosSaleUseCase.ts:209](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:209); [PosTerminalPage.tsx:188](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:188) |
| Change quantity | ✅ | [PosTerminalPage.tsx:222](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:222) |
| Change unit (UOM) | ❌ POS cart has no UOM field | `PosCartLine` has no `uom`/`uomId` ([:21](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:21)) |
| Change line discount amount | ⚠️ Backend accepts (`discountType:'AMOUNT'`), no UI, no policy | [CompletePosSaleUseCase.ts:25-26](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:25) |
| Change line discount percentage | ⚠️ Backend accepts (`discountType:'PERCENT'`), no UI, no policy | same |
| Change tax code / tax treatment | ⚠️ Backend accepts (`taxCodeId`), no UI, no policy | [CompletePosSaleUseCase.ts:27](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:27) |
| Tax-inclusive vs tax-exclusive at line | ❌ POS cannot set it; Sales has a per-line `priceInclusiveTax` override but POS never passes it | [SalesInvoice.ts:40](../../backend/src/domain/sales/entities/SalesInvoice.ts:40); POS uses company default |
| Edit/remove auto-applied discounts | ❌ No auto-discounts exist on POS | — |
| Edit promotional free items | ❌ No promotions on POS | — |
| Manual notes/reasons for overrides | ❌ No reason field anywhere on the POS/SI line | grep: no `priceOverrideReason`/`overrideReason` in `backend/src` |
| Manager approval for sensitive edits | ❌ No approval hook on POS edits | — |

**Required audit fields — every one is MISSING.** No `originalPrice`, `appliedPrice`, `manualPriceOverride`, `priceOverrideReason`, `priceOverriddenBy`, `originalTaxCode`, `appliedTaxCode`, `taxOverrideReason`, `discountSource`, `discountApprovedBy`, `overrideRequiresManagerApproval` exists on `PosCartLine`, `PosReceiptLineSnapshot`, or the SI line. (The Sales front-end price-override menu from Task 243-C/D is **transient UI only** — `frontend/src/components/shared/pricing/createPriceOverrideMenuItems.tsx` — and is stripped from the payload before posting; it carries no reason and is not persisted, and is **not** present on the POS terminal.)

**Important-rule compliance:** ❌ **Violated.** POS *does* allow unrestricted price/tax/discount editing at the API level with no policy, permission, reason, or audit.

---

## B. Invoice-Level Discount and Tax Behavior

| Capability | Status | Evidence |
|---|---|---|
| Invoice-level discount amount | ❌ on POS | `CompletePosSaleInput` has no `charges`/header-discount field ([:37](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:37)) |
| Invoice-level discount percentage | ❌ on POS | same |
| Discount on subtotal before tax | 🟡 Sales-only, broken model | `SalesInvoiceCharge` kind `DISCOUNT` ([SalesInvoice.ts:70-73](../../backend/src/domain/sales/entities/SalesInvoice.ts:70)) |
| Discount after tax | ❌ | — |
| Tax-inclusive pricing | ✅ company-level (Sales), POS inherits | [SalesInvoice.ts:40](../../backend/src/domain/sales/entities/SalesInvoice.ts:40) |
| Tax-exclusive pricing | ✅ | default path |
| Rounding differences | 🟡 `round2` per line ([:19](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:19)); Sales owns money rounding | — |
| Cash rounding | 🟡 `cashRounding` is **stored only**, never applied | [PosSettings.ts:24,83](../../backend/src/domain/pos/entities/PosSettings.ts:24); confirmed "stored only" in [ACTIVE.md](../../planning/ACTIVE.md) known-limitations |
| Allocate invoice-level discount back to lines | ❌ **MISSING — and actively wrong in Sales** | [SalesInvoice.ts:11](../../backend/src/domain/sales/entities/SalesInvoice.ts:11) comment: charges "never re-prorate line tax"; DISCOUNT charge forced `taxRate=0` ([:525](../../backend/src/domain/sales/entities/SalesInvoice.ts:525)) and excluded from per-line tax ([:535-540](../../backend/src/domain/sales/entities/SalesInvoice.ts:535)) |

**Important-rule compliance:** ❌ **Violated.** In Sales, an invoice-level discount stays a header value: it reduces the subtotal/grand total but is **explicitly not allocated to lines and does not reduce line tax** (`taxRate=0` on DISCOUNT charges). POS can't even create one. **None** of the required allocation strategies (proportional by net, by quantity, exclude non-discountable / gift / tax-exempt) exist.

---

## C. Sales Policies / Selling Restrictions

| Policy | Status | Evidence |
|---|---|---|
| Prevent selling negative stock | ✅ (indirect, via inventory OUT) | `InventorySettings.allowNegativeStock` default `false` ([InventorySettings.ts:157](../../backend/src/domain/inventory/entities/InventorySettings.ts:157)); `NegativeStockError`; enforced in `RecordStockMovementUseCase` |
| Allow negative stock with permission | 🟡 company flag, not a POS permission | `allowNegativeStock` is a company setting, not role-gated for POS |
| Prevent selling below cost | ❌ MISSING | grep: no below-cost guard in `sales`/`pos` |
| Prevent below minimum margin | ❌ MISSING | — |
| Prevent below minimum item price | ❌ MISSING | — |
| Prevent discount above max allowed | ❌ MISSING | — |
| Prevent selling inactive items | 🟡 partial | terminal blocks zero/no-price items only ([PosTerminalPage.tsx:423](../../frontend/src/modules/pos/pages/PosTerminalPage.tsx:423)); no active/blocked check in POS use case |
| Prevent selling blocked items | ❌ MISSING | — |
| Prevent selling expired items | ❌ MISSING (no batch/expiry on POS) | — |
| Prevent items not in POS warehouse | ❌ MISSING | line always forced to `register.warehouseId` ([:216](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:216)); no "is item stocked/assigned here" check |
| Prevent items not enabled for POS | ❌ MISSING (no `posEnabled` flag on item) | — |
| Prevent items outside allowed branch/terminal | ❌ MISSING | `branchId` is free-text on register ([PosRegister.ts:31](../../backend/src/domain/pos/entities/PosRegister.ts:31)) |
| Prevent price change for fixed-price items | ❌ MISSING (no fixed-price flag) | — |
| Prevent discount on non-discountable items | ❌ MISSING (no flag) | — |
| Require manager approval for restricted sales | ❌ MISSING | no approval path in POS |

**Required policy sources to check — coverage:** company sales settings 🟡 (only `allowNegativeStock`), POS terminal settings ❌, item master ❌ (no POS/fixed-price/non-discountable/min-price flags), item category ❌, price list 🟡 (exists for *suggestion* only, Task 242/243 — not enforced at POS), cashier role ❌ (POS permissions gate *actions* like `pos.terminal.access`, not *price/discount limits* — [pos.md §6](../architecture/pos.md)), customer group ❌, promotion policy ❌.

---

## D. Cost and Margin Validation

**Status: ❌ ENTIRELY MISSING on the POS path.** No code compares POS selling price to item cost. There is no `blockBelowCost`, `blockBelowMinMargin`, `minMarginPercent`, `minMarginAmount`, `allowManagerOverride`, `requireReasonForBelowCostSale`, or `unknownCostBehavior` anywhere (`backend/src` grep for `belowCost`/`minMargin` returns only inventory-costing files, none on the sell path).

- Cost data *exists* (`Item.costingStats.avgCost`, inventory costing engine) and COGS is posted by Sales after the fact, but it is **never read for a pre-sale price-vs-cost check.**
- Multi-currency selling price vs base-currency cost: not handled (no comparison at all).
- "Freeze cost basis for audit": COGS basis is snapshotted at posting by Sales, but not surfaced to a validation/approval step.

---

## E. Flash Sales and POS Promotions

**A generic Sales promotions engine exists but is NOT a POS feature and is NOT wired to any document.** See [`docs/architecture/promotions.md`](../architecture/promotions.md) and [`PromotionRule.ts`](../../backend/src/domain/sales/entities/PromotionRule.ts).

What exists (Sales, Phase B): `PromotionRule` entity, `PromotionApplicationService` (pure evaluator), CRUD + `POST /tenant/sales/promotions/evaluate`, and a `PromotionsPage` admin screen. The doc itself states auto-invocation inside SO/SI is **not wired** (Follow-up a), suggestions are **advisory only** (Follow-up b), and there is **no real stacking model** (Follow-up c).

| Required promotion type | Status |
|---|---|
| 1. Date/time flash sale (from/to, days, hours, terminal/branch/warehouse scope) | ❌ Only `validFrom`/`validTo` **dates** exist ([PromotionRule.ts header](../architecture/promotions.md)). No time-of-day, day-of-week, or terminal/branch/warehouse scoping. |
| 2. Buy X Get Y | 🟡 `BUY_X_GET_Y` exists in Sales engine **but not wired to POS**; free item is advisory, never inserted as a line |
| 3. Bundle / Combo offers | ❌ MISSING (no multi-item bundle type) |
| 4. Percentage discounts (item/group/all-items/invoice-total/customer-group/terminal) | 🟡 Only `THRESHOLD_DISCOUNT` (per-line %, qty/amount threshold). No invoice-total %, no customer-group / terminal targeting |
| 5. Fixed amount discounts (item/group/invoice/after-min-purchase) | ❌ MISSING (engine has no fixed-amount type) |
| 6. Tiered quantity discounts / price breaks | ❌ MISSING (single threshold only, no tier table) |
| 7. Coupon / promo code (one-time, reusable, customer-specific, expiry, max usage, min invoice) | ❌ MISSING entirely (no coupon entity) |

Scope today is limited to `ALL | ITEMS | CATEGORIES` with types `BUY_X_GET_Y | THRESHOLD_DISCOUNT` only.

---

## F. Promotion Eligibility

Available eligibility dimensions on `PromotionRule`: **item, category, date range (`validFrom`/`validTo`), and minimum quantity/amount (threshold)** only.

MISSING: item group, brand, barcode, warehouse, branch, POS terminal, cashier, customer, customer group, price list, payment method, **time range**, min invoice amount, first-purchase/loyalty.

---

## G. Promotion Conflict and Stacking Rules

Only rule present: **`priority` ascending, "first matching rule wins per mechanic"** ([promotions.md evaluation algorithm](../architecture/promotions.md)). A line can independently get one free-goods + one threshold-discount suggestion. Manual discount suppresses threshold discount on that line (`hasManualDiscount`).

MISSING required fields/behavior: `canStackWithOtherPromotions`, `exclusivePromotion`, `maxDiscountAmount`, `maxDiscountPercent`, `appliesBeforeTax`/`appliesAfterTax`, `promotionSource`, `promotionId` on affected lines, "choose best automatically", correct handling of returns of promoted items.

---

## H. Free Gift / Bonus Item Accounting and Inventory Behavior

**Status: ❌ MISSING.** `FreeGoodsSuggestion` carries only `{ itemId, qty }` and is advisory; nothing inserts a zero-priced line, so **no stock-OUT, no COGS, no tax treatment, no revenue handling for free goods happens.** None of the required fields exist (`isFreeGift`, `promotionId`, `originalUnitPrice`, `appliedUnitPrice`, `discountAmount`, `discountPercent`, `costAmount`, `taxTreatment`). There is also no guard stopping a cashier from manually zeroing a line's price (the backend would accept a 100% line discount with no flag/approval — except the current `unitPrice > 0` guard, which is about price not discount).

---

## I. Audit and Reporting Requirements

- General `AuditLog` infrastructure exists (`PrismaAuditLogRepository`, `IAuditLogRepository`), but **POS receipts/returns/settings do not emit `recordCreate`** — this is an explicit documented follow-up ([pos.md §3a / ACTIVE.md known-limitations](../../planning/ACTIVE.md)).
- Shipped POS reports ([pos.md §7](../architecture/pos.md)): Z, Daily Summary, Payment Methods, Cashier Sales, Cash Over/Short, Receipt History.
- **MISSING reports:** manual price overrides, tax overrides, manual discounts, promotion discounts, free gifts, below-cost sales, below-margin sales, manager approvals, blocked-sale attempts, cashier discount behavior, promotion performance, flash-sale results, top promoted items, promotion cost-vs-revenue. (All of these depend on fields/engines that don't exist yet.)

---

## J. Required Audit Answers

**1. What already exists?**
- POS cart → Sales Invoice pass-through with optional per-line `discountType`/`discountValue`/`taxCodeId` accepted by the backend ([CompletePosSaleUseCase.ts:209](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:209)).
- Company-level tax-inclusive/exclusive handling (inherited from Sales).
- Negative-stock prevention via `InventorySettings.allowNegativeStock` + `NegativeStockError` (indirect, through inventory OUT).
- A **standalone, un-wired** Sales promotions engine: `BUY_X_GET_Y` + `THRESHOLD_DISCOUNT` rules, a pure evaluator, CRUD + evaluate endpoint, admin page.
- POS action-level permissions (`pos.*`) and an `allowPosDirectSales` governance toggle.

**2. What is partially implemented?**
- Promotions engine (built, tested, but not invoked by SO/SI/POS; advisory only; no stacking/cap model).
- Invoice-level discount in Sales (`charges` with kind `DISCOUNT`) — **but it does not allocate to lines and forces `taxRate=0`**, so it's the wrong model and POS can't use it.
- Cash rounding (`cashRounding` stored but never applied).
- Inactive-item protection (terminal blocks zero-price tiles only).

**3. What is missing?**
- All override-governance fields and flows (reason, approver, original vs applied, manager approval).
- Cost/margin validation (entirely).
- Almost all selling restrictions (below-cost, min price, max discount, fixed-price, non-discountable, POS-enabled, expiry, branch/terminal scope).
- Invoice-level discount on POS + correct line allocation everywhere.
- Flash sales (time/day/terminal), bundles/combos, fixed-amount promos, tiered price breaks, coupons.
- Promotion eligibility beyond item/category/date, and a real conflict/stacking model.
- Free-gift accounting (stock OUT/COGS/tax for gifts) and its fields.
- POS audit logging for receipts/returns/settings and all commercial-rules reports.

**4. Any current logic that allows unsafe unrestricted price/tax/discount editing?**
**YES.** `POST /tenant/pos/sales` accepts arbitrary `unitPrice`, `discountType`/`discountValue`, and `taxCodeId` per line with the *only* guard being `unitPrice > 0` ([CompletePosSaleUseCase.ts:113-138](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:113)). No policy, permission scoping, reason, approval, or audit. The current cashier screen happens not to surface these, but the API is unguarded for any other client.

**5. Any current logic that allows selling below cost or below minimum margin?**
**YES — implicitly.** Nothing checks price against cost or margin at any point on the POS/Sales path. A sale at any price ≥ the minimal `> 0` guard posts successfully.

**6. Any current logic that allows negative-stock sales?**
**Controlled.** Default is blocked (`allowNegativeStock=false` + `NegativeStockError`). It *can* be allowed by flipping the company inventory flag — but that flag is **not** a POS/cashier-scoped permission, so there's no POS-level "allow with manager approval" path.

**7. Is there a real promotion/discount engine, or only manual fields?**
There is a **real but isolated** promotion engine in **Sales** (2 rule types, pure evaluator, CRUD/evaluate API). It is **not connected to POS at all**, and not auto-applied even in Sales. On the **POS** path, discounts are **only manual pass-through fields** with no engine.

**8. What must be added (entities, APIs, UI, services, policies, tests)?** — see checklist.

---

## ✅ Checklist — POS Commercial Rules & Promotions (to be scoped; do NOT implement yet)

### Override governance & line policy
- [ ] Add override-tracking fields to POS/SI line: `originalPrice`, `appliedPrice`, `manualPriceOverride`, `priceOverrideReason`, `priceOverriddenBy`, `originalTaxCode`, `appliedTaxCode`, `taxOverrideReason`, `discountSource (MANUAL|PROMOTION|PRICE_LIST|CUSTOMER_POLICY|COUPON)`, `discountApprovedBy`, `overrideRequiresManagerApproval`.
- [ ] Server-side **editability policy resolver** (item × company × terminal × cashier-role) gating price/qty/uom/discount/tax-code edits — enforced in `CompletePosSaleUseCase`, not just the UI.
- [ ] Reason capture + manager-approval flow for sensitive edits (new permission, e.g. `pos.price.override` / `pos.discount.approve`).
- [ ] Reject (or require approval for) any discount/price/tax override coming through the API without policy clearance.

### Invoice-level discount & tax allocation
- [ ] Add POS invoice-level discount (amount/percent, before/after tax per policy).
- [ ] Implement **discount-to-line allocation** (proportional-by-net / by-qty), with excludes for non-discountable / gift / tax-exempt lines — fix the Sales `charges` model so DISCOUNT re-prorates line tax/revenue.
- [ ] Apply `cashRounding` (currently stored-only) and capture rounding difference accounting.

### Selling restrictions & cost/margin
- [ ] Item/category master flags: `posEnabled`, `fixedPrice`, `nonDiscountable`, `minSellPrice`, `maxDiscountPct/Amt`, `blocked`, expiry awareness.
- [ ] Cost/margin guard service: `blockBelowCost`, `blockBelowMinMargin`, `minMarginPercent`, `minMarginAmount`, `allowManagerOverride`, `requireReasonForBelowCostSale`, `unknownCostBehavior (BLOCK|WARN|ALLOW)` — with multi-currency price-vs-base-cost handling and frozen cost basis.
- [ ] POS-scoped negative-stock permission ("allow with manager approval") distinct from the global inventory flag.
- [ ] POS-warehouse / branch / terminal item-assignment enforcement.

### Promotions engine (POS-aware)
- [ ] Extend rule types: flash sale (date+time-of-day+day-of-week+terminal/branch/warehouse scope), bundle/combo, fixed-amount, tiered/price-break, invoice-total %/amount, coupons (one-time/reusable/customer-specific/expiry/max-usage/min-invoice).
- [ ] Extend eligibility: group, brand, barcode, warehouse, branch, terminal, cashier, customer, customer group, price list, payment method, time range, min invoice.
- [ ] Conflict/stacking model: `promotionPriority`, `canStackWithOtherPromotions`, `exclusivePromotion`, `maxDiscount{Amount,Percent}`, `appliesBeforeTax/appliesAfterTax`, `promotionSource`, `promotionId` on lines, "best-promotion auto-select", promoted-return handling.
- [ ] **Wire the evaluator into the POS sale flow** (preview + complete), auto-inserting free-goods lines.

### Free gifts
- [ ] Free-gift line representation with stock-OUT + COGS + tax-policy behavior; fields `isFreeGift`, `promotionId`, `originalUnitPrice`, `appliedUnitPrice`, `discountAmount`, `discountPercent`, `costAmount`, `taxTreatment`; guard against manual paid→free conversion without permission.

### Audit & reporting
- [ ] POS `recordCreate`/audit hooks for receipts, returns, settings, and every override/approval.
- [ ] Reports: price overrides, tax overrides, manual vs promotion discounts, free gifts, below-cost/below-margin sales, manager approvals, blocked-sale attempts, cashier discount behavior, promotion performance, flash-sale results, top promoted items, promotion cost-vs-revenue.

### Tests
- [ ] Unit tests for the editability policy resolver, cost/margin guard, discount allocation, and each promotion type.
- [ ] Negative tests proving the API rejects ungoverned price/tax/discount overrides.
- [ ] End-to-end POS sale tests with promotions, free goods, coupons, and below-cost approval paths.
