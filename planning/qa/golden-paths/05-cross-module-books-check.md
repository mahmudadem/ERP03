# Golden Path 05 — Cross-Module Books Check

> **Goal:** after everything posted in scripts 01–04, the books are provably consistent.
> This is the script an accountant would run. It takes ~20 minutes.

| # | Check | Expected |
|---|-------|----------|
| 1 | **Trial Balance** (all periods) | Total debits = total credits, to the cent |
| 2 | **Balance Sheet** | Assets = Liabilities + Equity; AR balance = sum of customer sub-accounts; AP = sum of vendor sub-accounts |
| 3 | **P&L** | Revenue = posted SI totals (net of returns/discounts); COGS consistent with delivered quantities × cost; charge/discount accounts show GP03/GP04 amounts |
| 4 | **Inventory reconciliation** | Inventory GL balance = Inventory Valuation report total = (movement history math by hand for ITEM-A) |
| 5 | **AR reconciliation** | AR Aging total = Customer Statement balances = AR control account |
| 6 | **AP reconciliation** | AP Aging total = Vendor Statement balances = AP control account |
| 7 | **GRNI** | Zero (all GRNs invoiced in GP04) |
| 8 | **Posting log spot check** | Pick the GP03 step-9 invoice: posting log row exists, decision tree readable, voucher IDs match |
| 9 | **Audit trail spot check** | The GP03 invoice shows Create/Post audit entries with user + timestamp |
| 10 | **Idempotency spot check** | Re-click Post on an already-posted document (or replay) | No duplicate voucher; clean already-posted response |

**Pass condition:** all 10 checks green ⇒ **declare "golden paths green" in JOURNAL.md**. This milestone gates Phase 2 (deployment).

If any reconciliation fails (1–7), that is a **P0 accounting bug** — it goes to the top of the priority list, above everything, including the ship plan.
