# Golden-Path QA Scripts

> **These scripts replace the per-feature QA-QUEUE backlog.** (Decision: CTO audit 2026-06-13, Phase 1.)
> Instead of testing ~40 micro-features one by one, run each module's full business flow once.
> If a golden path passes end-to-end, the features inside it are considered verified.

## Rules

1. **Always use a fresh, template-seeded tenant.** Never SYCO (closed 2026-06-05). Create a new company through the wizard at the start of script 01 and use it for all five scripts.
2. **Rebuild the backend first:** `cd backend && npm run build`, then start the emulator. The emulator serves compiled `lib/` — stale builds invalidate the whole run.
3. **Run the scripts in order** (01 → 05). Later scripts depend on data created by earlier ones.
4. **Every failure gets one line** in `planning/qa/findings.md`: script number, step number, what you saw vs what was expected, screenshot if quick. Don't stop the run for a failure unless it blocks the next step.
5. When all five pass on one tenant in one sitting, tag the result in `planning/JOURNAL.md` — that's the "golden paths green" milestone that gates deployment (Phase 2).

## The scripts

| # | Script | Covers |
|---|--------|--------|
| 01 | [Onboarding & Accounting](./01-onboarding-and-accounting.md) | Signup, company wizard, COA, fiscal year, journal voucher, trial balance |
| 02 | [Inventory](./02-inventory.md) | Items, warehouses, opening stock, adjustments, transfers, stock levels |
| 03 | [Sales](./03-sales.md) | Customer → Quote → SO → DN → SI (discounts, charges, settlement, over-payment) → Return → AR reports |
| 04 | [Purchases](./04-purchases.md) | Vendor → PO → GRN → PI (charges/discounts) → payment → Return → AP reports |
| 05 | [Books Check](./05-cross-module-books-check.md) | Trial balance, balance sheet, P&L, GL-impact spot checks across everything posted above |
| 06 | [POS](./06-pos.md) | Register setup, shift cash control, sales, returns, over/short vouchers, POS reports, cross-module reconciliation |

## Time budget

Roughly 30–45 minutes per core script, ~3 hours for paths 01–05. POS adds ~60–90 minutes because it includes cash-control and cross-module reconciliation. Schedule each full pass as one focused session.
