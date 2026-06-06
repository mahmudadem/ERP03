# Task 170 — Related line-math gaps found during Task 168 fix

**Status:** Open
**Severity:** 🟠 Significant (silent feature gaps; not introducing wrong math today because data shape can't trigger it)
**Discovered:** 2026-06-04 while fixing [Task 168](168-si-total-mismatch-critical.md).

While the SalesInvoice math bug was confirmed and fixed, scanning the rest of the
domain entities surfaced related gaps. Filing them here so the next QA cycle catches them.

## Finding A — PurchaseInvoice does not support tax-inclusive prices at all

[backend/src/domain/purchases/entities/PurchaseInvoice.ts:5-42](../../backend/src/domain/purchases/entities/PurchaseInvoice.ts)

- `PurchaseInvoiceLine` has no `priceIsInclusive` field.
- No `discountType` / `discountValue` / `discountAmountDoc` fields either.
- `normalizeLine` always computes `taxAmountDoc = lineTotalDoc * taxRate` (exclusive).

PI is therefore feature-incomplete vs SI. Inclusive-tax purchase invoices simply can't be expressed. This is a missing feature rather than a math bug, but it bites the moment a tenant tries to mirror their SI tax setup on the purchases side.

**Fix path:**
1. Add `priceIsInclusive?: boolean` to `PurchaseInvoiceLine` and (optionally) `discountType`, `discountValue`, `discountAmountDoc`.
2. Extract the inclusive math into a shared service (mirror of `SalesInvoiceCalculationService`) — call it `PurchaseInvoiceCalculationService.calculatePurchaseInvoiceLineAmounts`.
3. Refactor `PurchaseInvoice.normalizeLine` to delegate to it, same way SI now stays in lockstep with its calculator.
4. Update `CreatePurchaseInvoiceUseCase` to set the effective inclusive value (parallel of the SI Task 168 fix).
5. Frontend: add inclusive toggle on PI lines (parallel of SI Detail page).
6. Add a regression test that pins inclusive math on PI.

## Finding B — SalesOrder.normalizeLine has the same exclusive-only bug

[backend/src/domain/sales/entities/SalesOrder.ts:179-184](../../backend/src/domain/sales/entities/SalesOrder.ts)

```ts
const lineTotalDoc = roundMoney(line.orderedQty * line.unitPriceDoc);
const taxAmountDoc = roundMoney(lineTotalDoc * normalizedTaxRate);
```

`SalesOrderLine` also has no `priceIsInclusive` field today, so the bug isn't triggered by current data shapes. But the SO → SI conversion path means an inclusive-tax catalog or quote could land in an SO and silently lose its inclusive nature.

**Fix path:** same shape as PI Finding A — add the flag to the line type, share the calculator, fix normalizeLine, update use case, frontend toggle. Add a conversion test that an inclusive SO → SI preserves the inclusive nature.

## Finding C — SalesReturn / PurchaseReturn use the "preserve passed value" pattern

[backend/src/domain/sales/entities/SalesReturn.ts:254-255](../../backend/src/domain/sales/entities/SalesReturn.ts)
[backend/src/domain/purchases/entities/PurchaseReturn.ts:180-181](../../backend/src/domain/purchases/entities/PurchaseReturn.ts)

These do `taxAmountDoc: line.taxAmountDoc ?? lineTotalDoc * taxRate` — they preserve a passed value if present, otherwise fall back to exclusive. Safer than SI's old bug, but the fallback is still exclusive-only. If the caller forgets to pass `taxAmountDoc` on a return that was originally inclusive, the fallback is wrong.

**Fix path:** lower priority — preferred to align all four (SI, PI, SR, PR) to the same shared-calculator pattern with explicit `priceIsInclusive`. Returns currently track an SI line and could simply mirror the SI line's inclusive flag.

## Finding D — Charges (additions) on SI never support inclusive

Charges in `SalesInvoiceCharge` have no `priceIsInclusive` field. They're always exclusive. Probably correct for typical "Delivery $5 + 10% tax" charges, but worth confirming the operational requirement before locking in.

## Finding E — "Line Total" column means different things across voucher pages (found 2026-06-05 during PI QA)

Same root pattern as A–C, but a display bug, not an entity bug. During PI QA against an exclusive 10% × 10qty × 10unit line, Mahmud spotted that the **Line Total** column showed `100` (= qty × unit) instead of `110` (= Net + Tax). For inclusive lines the column happened to be right by coincidence (qty × inclusive-unit = gross), masking the bug for inclusive testers.

**The locked convention** (matches SI and standard ERP):

| Column | Always = | Exclusive 10×10 @10% | Inclusive 10×10 @10% |
|---|---|---|---|
| Net | line value pre-tax | 100 | 90.91 |
| Tax | tax on the line | 10 | 9.09 |
| **Line Total** | **Net + Tax** (customer-facing line gross) | **110** | **100** |
| Net Base | Net in base currency | 100 | 90.91 |

**Current state (2026-06-05):**
- **SI** ([SalesInvoiceDetailPage.tsx:375](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx:375)) — correct (`lineGrossDoc = lineTotalDoc + taxAmountDoc`). Has a comment explaining the convention.
- **PI** ([PurchaseInvoiceDetailPage.tsx](../../frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx)) — **FIXED in same session** as Finding E was discovered: `lineExtensionDoc` renamed (raw qty×unit, internal only); `lineGrossDoc` now = `lineTotalDoc + taxAmountDoc`. Read-only Lines table also fixed.
- **SO** ([SalesOrderDetailPage.tsx:173](../../frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx:173)) — broken. `lineTotalDoc = qty × unit` (which is also wrong-named: that's the gross extension, not Net). The "Line Total" column at line 906 shows this. **Plus** the frontend doesn't honor `priceIsInclusive` at all (Finding B still open).
- **SR** ([SalesReturnDetailPage.tsx:795,921](../../frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx:795)) — same pattern as SO; two tables (form + read-only).
- **PR** ([PurchaseReturnDetailPage.tsx:1038](../../frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx:1038)) — same pattern as SO.
- **GVR** — not audited yet; check once SO/SR/PR migrate to `ClassicLineItemsTable` (Task 176).

**Fix path (per page):** mirror the PI fix —
1. Introduce `lineExtensionDoc = qty × unit` as an internal intermediate (rename if a similar var already exists).
2. Compute `Net (lineTotalDoc)` = `lineExtensionDoc / divisor` (divisor depends on inclusive flag from tax code / line override).
3. Compute `Tax (taxAmountDoc)` from inclusive/exclusive branch.
4. Compute `lineGrossDoc = lineTotalDoc + taxAmountDoc` and wire it to the "Line Total" column.
5. Repeat for `Base` columns.
6. Add a screen-level regression note: a row with exclusive 10% × 10×10 must show **Net=100, Tax=10, Line Total=110**; inclusive must show **Net=90.91, Tax=9.09, Line Total=100**.

This finding is entangled with Findings B + C — fixing the labeling without first wiring frontend inclusive math just gives you the wrong gross faster. Do them together per page.

## Suggested ordering for the next QA cycle

1. ✅ ~~PI inclusive support (Finding A)~~ — DONE (`09dfddbd` + `e89611e1`). PI Line Total label also fixed (Finding E).
2. SO frontend inclusive support + Line Total label (Findings B + E) — needed for SO → SI fidelity.
3. SR / PR frontend inclusive support + Line Total label (Findings C + E) — last to align all four entities to the shared calculator.
4. GVR audit (Finding E) — only after SO/SR/PR are clean.
5. Charges (Finding D) — only if a real customer request exists.

