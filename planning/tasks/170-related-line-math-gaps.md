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

## Suggested ordering for the next QA cycle

1. PI inclusive support (Finding A) — biggest gap, parallel of the SI fix that just shipped.
2. SO inclusive support (Finding B) — needed for SO → SI fidelity.
3. SR / PR alignment (Finding C) — make the four invoice-shaped entities use one shared calculator.
4. Charges (Finding D) — only if a real customer request exists.

