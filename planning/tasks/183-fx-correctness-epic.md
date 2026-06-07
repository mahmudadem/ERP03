# 183 — FX correctness epic (multi-currency accounting: monetary vs non-monetary, revaluation, realized/unrealized)

**Status:** Open (epic — break into slices)
**Owner:** TBD (backend, with product owner on policy choices)
**Origin:** Mahmud, 2026-06-07 — deep discussion of FX on returns surfaced that multi-currency accounting is a large, partly-built area that needs to be made correct as a body of work, not patched piecemeal. "We have a lot of work to do with FX, not only this."

## The governing principle (IAS 21) — get this right everywhere

Every ledger account is either:

- **Monetary** — cash, bank, AR, AP, loans. A fixed number of *currency units*. Measured at the **spot/closing rate**; the change in base value as the rate moves is an **FX gain/loss** in P&L.
- **Non-monetary** — **inventory**, fixed assets, prepaid, equity. Carried at the **historical rate** when acquired; **never** restated to a current rate.

Almost every FX bug in an ERP comes from blurring this line. The epic's job is to enforce it consistently across posting, revaluation, and settlement.

### Worked example (the one that motivated this) — purchase return, foreign cash refunded
Base SYP. Buy $100 of goods at rate 14,000 (Dr Inventory 1,400,000 / Cr Cash 1,400,000). Later return them, get $100 back at today's rate 16,000:
```
Dr Cash (USD)     1,600,000   ($100 × 16,000 — monetary, spot)
   Cr Inventory   1,400,000   (historical — non-monetary, unchanged)
   Cr FX Gain       200,000   (the SYP gained because the rate moved)
```
The gain is **real and recognized**. The correct mechanism is a **split** — inventory leg at historical, cash/AR/AP leg at spot, the difference falls out as FX gain/loss. Not "reverse everything at today's rate", not "reverse everything at the old rate."

## What already exists (build on, don't rebuild)

- **Period-end revaluation:** `CalculateFXRevaluationUseCase`, `GenerateFXRevaluationVoucherUseCase`, `FXRevaluationStrategy`, `FXRevaluationController`, `/accounting` routes. Computes delta = (foreignBalance × newRate) − historicalBase and posts an FX gain/loss voucher.
- **Realized FX on settlement:** partial — `PaymentSyncUseCases` + `FxGainLossSettlement.test.ts`.
- **FX accounts in config:** `CompanySettings` carries FX gain/loss account fields; `AccountRole` has `fxGain` / `fxLoss`.
- **Per-line historical rate on returns:** `PurchaseReturnUseCases` (and SR) carry a per-line `effectiveRate = unitCostBase / unitCostDoc` so a return unwinds a cost layer at its original rate.

## Known gaps / risks (the actual work)

1. **Revaluation does not enforce monetary-only scope.** [`CalculateFXRevaluationUseCase`](../../backend/src/application/accounting/use-cases/CalculateFXRevaluationUseCase.ts) revalues **all** foreign-currency accounts (or a caller-supplied `targetAccountIds`). Nothing stops a foreign-denominated **inventory** (non-monetary) account from being wrongly revalued — it relies entirely on the caller passing the right list. **Fix:** classify accounts monetary/non-monetary (account-type or a flag) and have revaluation include monetary only by default.
2. **No monetary/non-monetary classification exists** in the account model (`grep monetary` → nothing). Needs adding to the COA account type so posting + revaluation can both rely on it.
3. **Inventory / COGS must post at historical rate** on every document (purchase, sale, returns). Verify SI COGS, PI inventory debit, and both returns keep inventory non-monetary. The PR `effectiveRate` is the returns half of this; confirm the forward (purchase/sale) half.
4. **Returns-at-historical generalized.** The per-line `effectiveRate` pattern (PR/SR) is the right idea but ad-hoc; fold it into a consistent rule once Task 178 D2 extends the poster for per-line FX passthrough.
5. **Realized vs unrealized split.** On settlement of a monetary item, realized FX = (settlement-rate − booking-rate) × amount. At period end, open monetary balances get **unrealized** FX (revaluation), reversed next period or tracked cumulatively. Verify the realized path (PaymentSync) and the unrealized path (revaluation) don't double-count and reverse correctly.
6. **Coverage matrix.** Which documents/flows handle FX correctly today vs not: SI, PI, SO, PO, SR, PR, payments, settlements, year-end close, opening balances. Build the matrix, fix the gaps.
7. **FX gain/loss account wiring** must resolve per company (uniform `AccountMappingError` when unconfigured — now easy via the poster).

## Suggested slices

1. **Account classification** — add monetary/non-monetary to the COA account type + seed it on templates. Foundation for everything else.
2. **Revaluation correctness** — scope `CalculateFXRevaluation` to monetary accounts by default; regression-test that inventory is never revalued.
3. **Posting-rate audit** — verify/fix inventory & COGS post at historical across SI/PI/SR/PR; this dovetails with Task 178 (the poster is where the rate per line is applied).
4. **Returns FX rule** — generalize the per-line `effectiveRate` (needs Task 178 D2 poster FX passthrough).
5. **Realized/unrealized reconciliation** — confirm settlement (realized) + period-end (unrealized) don't double-count; add the reversing entry discipline.
6. **Coverage matrix + gap closure** — document and fix per-flow.

## Relationship to other tasks

- **[Task 178 D2](./178-subledger-document-poster-refactor.md)** — extending the poster for per-line `effectiveRate` (PR) is a prerequisite for slice 4 and makes slice 3 clean.
- **[Task 182](./182-purchases-parity-discounts-landed-costs.md)** — landed-cost capitalization interacts with FX (capitalize at historical).
- Existing `FxGainLossSettlement` + `CalculateFXRevaluation` tests are the starting safety net — extend, don't replace.

## Definition of done (epic)

- Accounts classified monetary/non-monetary; revaluation respects it (inventory never revalued).
- Inventory & COGS post at historical rate on every document; monetary legs at spot.
- Realized (settlement) and unrealized (period-end) FX both correct and non-double-counted, with reversing discipline.
- A per-flow FX coverage matrix exists with all gaps closed or explicitly deferred.
- Architecture/regression tests pin the monetary/non-monetary rule so it can't silently regress.
