# 122 — Per-customer / Per-vendor AR/AP Sub-account — Backend (Piece A.1)

**Status:** ✅ A.1 complete (backend). ⏳ A.2 (frontend forms) and A.3 (backfill) still pending.
**Branch:** `feat/phase-a-sales-master-data`
**Agent:** Claude Code (Opus 4.7)
**Date:** 2026-05-27

---

## Why this exists

Today every customer/vendor optionally shares a tenant-level `defaultARAccountId` / `defaultAPAccountId`. That makes Customer Statement / Vendor Ledger reports impossible without an extra join through invoices — and lets SYCO post all AR to a single shared account, masking per-party balances.

Piece A introduces **per-party sub-accounts** under a tenant-configured AR/AP parent so:
- Each customer/vendor gets their own posting account.
- Customer Statement (Piece B) can call the existing `GetAccountStatementUseCase` directly.
- Existing aggregate AR reports still work — the parent account is the rollup.

## Decisions captured (locked)

| Question | Decision |
|---|---|
| Where does the AR/AP parent live? | New `SalesSettings.arParentAccountId` (mirror `PurchaseSettings.apParentAccountId`) — distinct from the existing `defaultARAccountId` fallback. |
| Code format | User-configurable template stored on settings: `partyAccountCodeFormat`. Tokens: `{parent}`, `{partyCode}`, `{seq3}`. Default: `{parent}-{partyCode}`. |
| UI default strategy | **Always ask** — no default radio selection on the Customer/Vendor form. |
| Backfill | Both — tenant Sales/Purchase Settings button + Super Admin tool (still TODO in A.3). |

## What was built in A.1

### Backend

1. **`backend/src/application/shared/services/PartyAccountCodeRenderer.ts`** (new)
   - `renderPartyAccountCode(template, { parent, partyCode, seq })`
   - `templateUsesSequence(template)`
   - `validatePartyAccountCodeFormat(template)` — rejects templates missing both `{partyCode}` and `{seq3}` (would always collide).

2. **`backend/src/domain/sales/entities/SalesSettings.ts`**
   - Added `arParentAccountId?: string`
   - Added `partyAccountCodeFormat?: string`
   - Plumbed through constructor, `toJSON`, `fromJSON`.

3. **`backend/src/domain/purchases/entities/PurchaseSettings.ts`** — mirror (`apParentAccountId`, `partyAccountCodeFormat`).

4. **`backend/src/application/sales/use-cases/SalesSettingsUseCases.ts`**
   - `Initialize` + `Update` accept the two new inputs.
   - Validates: `arParentAccountId` must resolve to an `ASSET` account.
   - Validates: `partyAccountCodeFormat` passes `validatePartyAccountCodeFormat`.

5. **`backend/src/application/purchases/use-cases/PurchaseSettingsUseCases.ts`**
   - Same shape; AP parent must be `LIABILITY`.

6. **`backend/src/application/shared/use-cases/PartyUseCases.ts`**
   - `CreatePartyUseCase` now takes an optional 3rd ctor arg `PartyAccountAutoCreateDeps` (accountRepo, createAccountUseCase, salesSettingsRepo, purchaseSettingsRepo).
   - `CreatePartyInput.accountStrategy: 'AUTO_CREATE' | 'PICK_EXISTING'` — **required**. Use case throws if missing/invalid.
   - `AUTO_CREATE` path:
     - If `CUSTOMER` role → look up `SalesSettings.arParentAccountId`, render code from `partyAccountCodeFormat`, call `CreateAccountUseCase` with classification `ASSET`, parent set. Save returned account id into `defaultARAccountId`.
     - If `VENDOR` role → mirror for AP / `LIABILITY`.
     - Dual-role party gets both accounts in one call.
     - `{seq3}` is resolved by linear probe against `accountRepo.existsByUserCode` — increment until unique.
     - Template without `{seq3}` that collides throws a clear "add {seq3} to format" error.
   - `PICK_EXISTING` path:
     - Validates that the provided `defaultARAccountId` (if CUSTOMER) is classified `ASSET`.
     - Validates `defaultAPAccountId` (if VENDOR) is classified `LIABILITY`.
     - No account is created.

7. **`backend/src/api/controllers/shared/SharedController.ts`**
   - `createParty` now rejects requests without `accountStrategy` (returns 400 via thrown error).
   - Wires `CreateAccountUseCase` + settings repos from `diContainer` into the use case.

### Tests

8. **`backend/src/tests/application/shared/PartyAccountStrategy.test.ts`** (new, 12 tests, all passing):
   - Renderer: default template, dot separator, `{seq3}` padding, validator rejects unsafe templates.
   - AUTO_CREATE for CUSTOMER → AR sub-account created, classification ASSET.
   - AUTO_CREATE for VENDOR → AP sub-account, LIABILITY.
   - AUTO_CREATE throws when AR parent not configured.
   - AUTO_CREATE bumps `{seq3}` until unique (probes `001`, `002`, lands on `003`).
   - PICK_EXISTING rejects an EXPENSE-classified account as AR.
   - PICK_EXISTING passes through valid account without creating anything.

### Verification

- `tsc --noEmit` clean (backend + frontend not changed yet).
- 12/12 new tests pass.
- 27/27 existing sales/purchase/party tests still pass.

---

## What is NOT yet built (handoff to next agent)

### Subtask A.2 — Frontend forms (~2 h)

Goal: let users configure the parent + format, and pick the strategy on the Customer/Vendor form.

Files to touch:
1. **`frontend/src/api/salesApi.ts`** (Sales Settings) — extend the settings shape with `arParentAccountId` + `partyAccountCodeFormat`.
2. **`frontend/src/api/purchasesApi.ts`** — same for `apParentAccountId` + `partyAccountCodeFormat`.
3. **`frontend/src/api/sharedApi.ts`** (party endpoints) — extend `createParty` payload to include `accountStrategy: 'AUTO_CREATE' | 'PICK_EXISTING'`.
4. **Sales Settings page** — add an "AR Sub-account Generation" section under the existing "Default Accounts" group. Use `AccountSelector` filtered to classification=ASSET, role=HEADER (or POSTING — accept either; the use case auto-promotes POSTING parents to HEADER when adding children). Add a plain `<input>` for the format template with token help text (`{parent}`, `{partyCode}`, `{seq3}`).
5. **Purchase Settings page** — symmetric for AP / LIABILITY.
6. **Customer/Vendor detail form** — new "Accounting" section with a radio (no default):
   - `AUTO_CREATE` — show a preview line that calls `renderPartyAccountCode` locally (re-export the renderer from a tiny frontend mirror or call a backend `/preview-party-account-code` endpoint — local is fine and avoids latency).
   - `PICK_EXISTING` — show the existing `PartyAccountSelector` (already in shared selectors). Disable the irrelevant side based on `roles`.
7. **i18n** — add keys under `sales.settings.arParent`, `sales.settings.partyAccountFormat`, `purchases.settings.apParent`, `parties.form.accounting.*`.

Notes:
- The backend already rejects an invalid `accountStrategy`, so the form just needs to gate the Submit button until the user picks one.
- The format input should NOT be empty in the UI — pre-fill with `{parent}-{partyCode}` placeholder.

### Subtask A.3 — Backfill (~1.5 h)

Goal: one-click migration for tenants that already have parties pointing at a shared AR account.

Files to add:
1. **`backend/src/application/shared/use-cases/BackfillPartyAccountsUseCase.ts`** (new)
   - For a given tenant, iterate all active parties.
   - Skip any party whose `defaultARAccountId` (for CUSTOMER role) is already a child of `SalesSettings.arParentAccountId` AND not equal to it. (Same logic mirrored for VENDOR/AP.)
   - For the rest: call the same auto-create path used in `CreatePartyUseCase` and `UpdatePartyUseCase` to set the new account id.
   - Idempotent. Return a count: `{ created: number, skipped: number, errors: Array<{partyId, message}> }`.
2. **New endpoint(s)**:
   - Tenant-scoped: `POST /tenant/sales/settings/backfill-party-accounts` and `POST /tenant/purchases/settings/backfill-party-accounts`.
   - Super-admin: `POST /super-admin/companies/:companyId/backfill-party-accounts` (loop over Sales + Purchases for the given tenant). Or a "run for all tenants" variant — design choice.
3. **Frontend buttons**:
   - Sales Settings → "Backfill customer AR sub-accounts" button (with `ConfirmDialog`, toast on completion showing counts).
   - Purchase Settings → mirror.
   - Super Admin tools page → cross-tenant variant.

Notes:
- Backfill MUST run inside a top-level try/catch so a single bad party (e.g. missing party code) doesn't kill the whole batch — collect errors, return them in the response.
- Existing accounts must NEVER be re-parented. Backfill only sets `defaultARAccountId`/`defaultAPAccountId` on parties that don't already have a per-party sub-account.

### Piece B — Customer Statement uses Account Statement engine (~3-4 h)

Goal: Customer Statement page (`frontend/src/modules/sales/pages/CustomerStatementPage.tsx`) calls the existing `GetAccountStatementUseCase` against the customer's `defaultARAccountId` instead of doing its own SI-by-SI math.

Sketch:
- New backend endpoint `GET /tenant/sales/customers/:partyId/statement?from=...&to=...` that:
  - Loads the party, resolves `defaultARAccountId`.
  - Returns 412 with a clear "customer has no dedicated AR account — run backfill" message if not set.
  - Otherwise delegates to `GetAccountStatementUseCase`.
  - Decorates each entry with sales-domain context (which SI / SR / payment number) by joining on voucher metadata.
- Frontend just renders the result through the existing `LedgerTable` component already in `CustomerStatementPage.tsx`.

---

## End-user view (so far)

Nothing user-visible yet — A.1 is backend plumbing. End-user behavior lands once A.2 ships the form changes. Skipping the user-guide doc until A.2/A.3 land; will write it then.
