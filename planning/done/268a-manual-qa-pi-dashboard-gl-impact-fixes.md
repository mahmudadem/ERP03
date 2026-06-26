# 268A - Manual QA PI, Dashboard, and GL Impact Fixes

**Status:** Complete  
**Date:** 2026-06-26  
**Branch/worktree:** `codex/267-system-core-boundary-audit` / `D:\DEV2026\ERP03-267-engine-audit`  
**Estimated time:** 0.5-1.0 hours  
**Actual time:** ~0.7 hours

## Technical Developer View

This slice closed small bugs found during owner QA before the larger follow-up tasks.

Changed files:

- `frontend/src/components/shared/selectors/ItemSelector.tsx`
- `frontend/src/modules/accounting/AccountingDashboard.tsx`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/modules/sales/components/GlImpactModal.tsx`
- `docs/user-guide/purchases/README.md`
- `docs/user-guide/accounting/vouchers-and-ledger-impact.md`
- `planning/tasks/269-purchase-tax-recoverability-and-cost-capitalization.md`
- `planning/tasks/270-negative-stock-valuation-policy-and-reporting.md`
- `planning/tasks/271-purchase-return-layout-and-direct-return-parity.md`

Implementation notes:

- New Purchase Invoice date now uses `todayLocalIso`, matching Sales Invoice local-date behavior.
- Posted Purchase Invoices expose **GL Impact** using the existing GL Impact modal with a purchase-specific badge.
- Accounting Dashboard recent voucher numbers now open voucher view.
- `ItemSelector` no longer preloads UOMs unless the inline create-item modal is open, reducing unrelated DevTools noise.
- Follow-up task briefs were created for purchase tax recoverability, stock-level/reporting valuation, and SR/PR layout parity.

## End-User View

Purchase Invoices now open with today's date from the system/company date instead of drifting to the previous UTC date near midnight. Posted Purchase Invoices also have a **GL Impact** button so users can review AP, tax, and inventory/expense accounting from the bill.

On the Accounting Dashboard, recent voucher numbers are clickable and open the voucher view. Stock Levels and other pages should no longer show repeated item-selector UOM loading errors unless the user is actually creating a new item inline.

## Verification

Passed with the Task 268 verification run:

```powershell
npm --prefix frontend run typecheck
npm --prefix frontend run build
git diff --check
```

Notes:

- Frontend build still reports existing baseline-browser-mapping, Browserslist, dynamic import, and chunk-size warnings.
- `git diff --check` reports only CRLF normalization warnings.

## Follow-Ups

- Task 269: purchase tax recoverability and cost capitalization.
- Task 270: stock-level report container, negative valuation, and item movement report.
- Task 271: Sales/Purchase Return layout parity and direct Purchase Return.
