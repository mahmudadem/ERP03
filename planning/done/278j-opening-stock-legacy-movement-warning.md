# 278j — Opening Stock legacy movement warning

## Technical Developer View

Telegram QA showed a tenant where **Opening Stock Documents** said no documents existed while **Stock Movements**
contained `OPENING_STOCK` rows.

The safe fix is a read-only reconciliation warning, not data backfill:

- `frontend/src/modules/inventory/pages/OpeningStockPage.tsx`
  - Loads recent stock movements alongside Opening Stock Documents.
  - Detects legacy `OPENING_STOCK` movement rows when the document list is empty.
  - Shows an amber summary widget with a link to `/inventory/movements`.
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
  - Added localized warning text.
- `frontend/src/api/inventoryApi.ts`
  - Extended the client-side movement filter type to include `movementType` for future API contract alignment.

No backend migration was introduced. Creating synthetic Opening Stock Documents from old movement rows would create
false document history and weaken auditability. The source of truth remains append-only stock movements plus real
document headers created by the document workflow.

## End-User View

If old opening-stock quantities exist but were not created through the current Opening Stock Document screen, the
Opening Stock page now warns the user. The warning tells the user to review Stock Movements before creating a new
Opening Stock Document, so the same starting stock is not entered twice.

## Accounting and inventory impact

- Display/reconciliation only.
- No stock quantity, average cost, voucher, ledger, account balance, tenant data, or audit record is mutated.
- Prevents accidental duplicate opening stock entry during production cleanup.

## Verification

- Locale JSON parse passed.
- `npm run typecheck` passed in `frontend/`.
- `npm run build` passed in `frontend/`.
- `git diff --check` passed.
- `graphify update .` could not run because `graphify` is not installed/available in this shell.

## Commits

- Code: `64117d93` — `fix(inventory): flag legacy opening stock movements [278j-1]`
- Docs: pending at time of writing.
