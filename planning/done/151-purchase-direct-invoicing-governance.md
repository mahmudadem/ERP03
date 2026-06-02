# 151 — Purchase Direct Invoicing Governance Fix

**Date:** 2026-06-01  
**Agent:** Codex  
**Branch:** `feat/init-wizard-forms-selection`  
**Actual time:** ~1.0h

## Technical Developer View

### Problem

Purchase Invoice creation correctly rejected persona `direct` in OPERATIONAL workflow unless `DocumentPolicyResolver` found an explicit governance rule. Purchase Settings still showed the legacy **Allow Direct Invoicing** checkbox as if `allowDirectInvoicing: true` alone enabled that persona, creating a split-brain policy: the UI looked open while the backend guard stayed closed.

### What changed

- `backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`
  - Added reconciliation from the OPERATIONAL **Allow Direct Invoicing** setting into a company-scope governance rule:
    - `persona: direct`
    - `scope: company`
    - `action: allow`
  - Disabling the setting removes company-scope direct rules while preserving branch/form-specific exceptions.
  - Initialization and settings update both use the same reconciliation helper.
- `backend/src/domain/purchases/entities/PurchaseSettings.ts`
  - New default Purchase Settings now keep OPERATIONAL direct invoicing blocked unless explicitly enabled.
- `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx`
  - The checkbox now updates both the legacy compatibility flag and the company governance rule.
  - Legacy settings that had `allowDirectInvoicing: true` but no governance rule are normalized into a pending UI change so saving the settings writes the required rule.
  - The policy summary now uses the same effective governance resolver used elsewhere instead of reading the stale flag directly.
- `backend/src/tests/application/purchases/PurchaseSettingsUseCases.test.ts`
  - Added regression coverage for enabling and disabling OPERATIONAL direct invoicing through settings.
- `docs/architecture/purchases.md`
  - Documented that direct PI in OPERATIONAL is blocked by default and must come from explicit governance.
- `docs/user-guide/purchases/README.md`
  - Added end-user guidance for direct bills in OPERATIONAL mode.

### Accounting / Control Notes

The backend invoice guard was intentionally preserved. This fix does not make OPERATIONAL procurement direct-first. It makes the setting create the explicit exception that the governance model already requires. Standard flow remains `Purchase Order -> Goods Receipt -> Purchase Invoice`; direct PI is a company-admin-approved exception.

## End-User View

If Purchases is set to OPERATIONAL workflow, a direct Purchase Invoice is blocked unless the company policy explicitly allows it. The **Allow Direct Invoicing** switch in Purchase Settings now writes that policy exception correctly. After saving the setting, users can create direct vendor bills without seeing the governance policy error.

## Verification

- `npm --prefix backend test -- --runInBand backend/src/tests/application/purchases/PurchaseSettingsUseCases.test.ts` -> passed (8 tests).
- `npm --prefix backend run build` -> passed.
- `npm --prefix frontend run typecheck` -> passed.
- `npm --prefix frontend run build` -> passed (`check:reports`, `check:no-confirm`, `tsc`, and Vite build all completed; Vite emitted existing chunk-size/browser-data warnings only).
- `npm run graph:update` -> passed; `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` updated.

## Follow-Ups

- Purchase Invoice detail still has broader native-page polish gaps queued under the native functionality retest.
