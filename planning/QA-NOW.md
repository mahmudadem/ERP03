# QA — pick up here

Last updated: 2026-06-04

You got pulled into a 2-day math detour during posting-authority QA. The
math is now correct in code, **but you have not verified anything in the
browser yet.** This file is your re-entry point.

## What's done in code (commits to verify)

| # | Fix | Commit |
|---|---|---|
| 1 | Currency display — SYP no longer rounds 1.50 → "SYP 2" | `9b56a800` |
| 2 | Sales Invoice — honours `priceIsInclusive` | `eaa4eead` |
| 3 | Sales Order — honours `priceIsInclusive` | `b4891ef3` |
| 4 | Purchase Invoice — adds `priceIsInclusive` | `09dfddbd` |
| 5 | Sales/Purchase Returns — honour `priceIsInclusive` | `b45e232c` |
| 6 | Approval flow (SoD, Approval Center tab, banner) | yesterday |

Backend tests: **247/247 pass.** No UI verification done.

## Do these in order (15 min total)

### 1. Restart everything cold

```powershell
# Stop backend + frontend dev servers (Ctrl+C in each terminal)
cd D:\DEV2026\ERP03\backend && npm run dev
cd D:\DEV2026\ERP03\frontend && npm run dev
```

Hard-reload the browser (Ctrl+Shift+R).

### 2. Currency display sanity (30 sec)

Open the Sales Invoices list. Any existing SYP invoice should show
decimals now (e.g. `SYP 1.50`, not `SYP 2`).

✅ Pass / ❌ Fail. If fail → tell Claude, frontend bundle is stale.

### 3. Inclusive math — happy path (3 min)

**Setup (one time):** Settings → Tax Codes → edit or create a tax code,
set rate to 10% and check **"Price is tax-inclusive by default"**. Save.

Create a new Sales Invoice:
- Customer: any
- One line: 2 units × 0.75
- Tax code: the inclusive one from setup

Expected: Grand Total = **1.50** (because 0.75 already includes tax).
Old broken behaviour: Grand Total = 1.65 (tax stacked on top).

✅ Pass / ❌ Fail.

### 4. Approval flow — happy path (5 min)

The same invoice from step 3 should:

1. Save as **PENDING_APPROVAL** (not auto-posted, not DRAFT).
2. Show a yellow banner on the detail page that says "waiting for
   accounting approval". **No Approve button on the SI page itself**
   (that's correct — SoD means only Accounting can approve).
3. Appear in **Accounting → Approval Center → Source Documents tab**.
4. Approving it from Approval Center should:
   - Post a voucher
   - Voucher debit/credit lines should sum to **1.50** (matching the SI)
   - SI status flips to POSTED

✅ Pass / ❌ Fail at any step. Tell Claude which step.

### 5. Repeat for Purchase Invoice (3 min)

Same shape: 2 × 0.75, inclusive 10% tax, expect grand 1.50. Approve
from Approval Center. Voucher should match.

## What's NOT done (still ahead of you)

If steps 1–5 pass, the math+approval epic is *truly* shippable. These
are the remaining tasks from the original plan:

1. **Task 164** — Settings UI to set approval per voucher type
   (Sales-flex / Purchases-strict from the UI, not Firestore).
2. **Task 165** — Approval Center polish: reject flow, GL preview,
   notifications when something needs approval.
3. **Task 166** — Permission seeding + frontend gates so non-accountants
   don't see the Approve button.
4. **Task 167** — Recall action on source docs + show rejection reason
   when rejected.
5. **Task 169** — Audit history shows empty diffs in some cases; the
   "Flexible" badge name is misleading and should be renamed.
6. **NEW** — Add a per-line "Price includes tax" checkbox on SO / PI /
   SR / PR forms. SI already has it; the others currently only honour
   the tax-code default. (Setting the flag on the tax code itself
   already works — Settings → Tax Codes → "Price is tax-inclusive by
   default".)

## What's NOT in scope anymore

- The 2-day math detour is **closed.** Don't reopen it unless QA fails.
- The posting-authority epic itself (Stages 0–7) is **done**, no Stage 8.

## When you come back

Delete this file when QA passes. Or update it with what you found.
