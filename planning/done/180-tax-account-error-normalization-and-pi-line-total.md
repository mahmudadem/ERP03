# 180 — Tax-account error normalization (SI / PI / SR / PR) + PI Line Total column fix

**Status:** ✅ Done
**Date:** 2026-06-06
**Branch:** `feat/init-wizard-forms-selection`
**Session focus:** Sales + Purchases QA — math, posting, and error correctness.

## Why

During an SI/PI QA pass:
1. PI failed to post a 1 × 10 @ 10% exclusive invoice with `INFRA_999 — Subledger voucher not balanced: debit=10, credit=11`. Root cause: silent skip in the use case when the tax code had no Purchase Tax Account configured. Same shape of bug surfaced — quiet or noisy — in three more places (SI charges, SR, PR). SI line case already threw, but with the tax-code UUID in the message instead of the human label.
2. PI's "Line Total" column showed `qty × unit` (= 100 on a 10 × 10 line), reading as Net pre-tax. The standard convention is `Line Total = Net + Tax`. SI was already correct; PI was the outlier (commit `8d3e8bc4` introduced the divergence when migrating PI to `ClassicLineItemsTable`).

Both were blocking meaningful PI QA — every total a tester read was either misleading or unposted.

## What landed

### Backend — normalized tax-account-missing surfacing

All four posting paths now throw the same structured `AccountMappingError` (Stage 5 rejection contract → `ACCOUNT_MAPPING_MISSING`) with the tax code's human label, not the UUID:

| File | Before | After |
|---|---|---|
| [PurchaseInvoiceUseCases.ts:711-728](../../backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts) | Silent skip → unbalanced voucher → `INFRA_999` | Throws `AccountMappingError` with tax code label and line number |
| [SalesInvoiceUseCases.ts:1225-1240](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts) | Already threw, but `hint` showed UUID | Same throw, hint now uses the readable code |
| [SalesInvoiceUseCases.ts:1294-1309](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts) — charges | Silent skip on charge tax | Throws `AccountMappingError` referencing the charge description |
| [SalesReturnUseCases.ts:696-710](../../backend/src/application/sales/use-cases/SalesReturnUseCases.ts) | Silent skip → posted bucket with `accountId: ''` | Throws `AccountMappingError` |
| [PurchaseReturnUseCases.ts:795-810](../../backend/src/application/purchases/use-cases/PurchaseReturnUseCases.ts) | Generic `Error("Tax code <UUID> has no purchase tax account")` → `INFRA_999` | `AccountMappingError` with tax code label |

User-facing impact: instead of a red "Critical Error — Subledger voucher is not balanced: debit=10, credit=11 / Code: INFRA_999", the shared error dialog now shows an "Error" with code `ACCOUNT_MAPPING_MISSING` and a message naming the tax code that needs a Purchase / Sales Tax Account configured.

### Frontend — PI Line Total column

[PurchaseInvoiceDetailPage.tsx:180-201](../../frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx) — `lineGrossDoc` is now `lineTotalDoc + taxAmountDoc` (matching SI's convention exactly). The raw `qty × unit` extension is preserved internally as `lineExtensionDoc` for the divisor math only — it is not displayed.

Behaviour after fix:

| Tax code | Net | Tax | Line Total | Net Base |
|---|---|---|---|---|
| Exclusive 10% × 10qty × 10unit | 100.00 | 10.00 | **110.00** | 100.00 |
| Inclusive 10% × 10qty × 10unit | 90.91 | 9.09 | **100.00** | 90.91 |

Same fix applied to the read-only Lines table at the bottom of the PI detail page so posted invoices read consistently.

### Planning + memory

- **SYCO tenant closed** ([121 — Phase C QA Results](./121-phase-c-qa-results.md) + [QA-QUEUE.md](../QA-QUEUE.md) banner + user memory `syco_tenant_closed.md`). The 7 remaining Phase C findings (#1, #2, #4, #5, #7, #8, #11) are tied to corrupt SYCO setup and will not be revisited. Future QA runs use a fresh template-seeded tenant.
- **[Task 170 Finding E](../tasks/170-related-line-math-gaps.md)** appended — Line Total semantics across SO / SR / PR / GVR. PI marked resolved; the rest carry the same fix once they migrate to the shared table.
- **[Task 176](../tasks/176-unified-line-items-table-skins.md)** filed — unified line-items table (one component, two skins) across SI / SO / SR / PR / GVR. UI agent owns.
- **[Task 177](../tasks/177-si-pi-detail-page-redesign.md)** filed — SI & PI detail page redesign (compact layout, shared table for SI, fixed Settlement card, posted view, severity-driven ErrorModal, kill SI phantom empty rows). UI agent owns.
- **[Task 178](../tasks/178-subledger-document-poster-refactor.md)** filed — `SubledgerDocumentPoster` backend refactor to consolidate the duplicated middle layer of SI / PI / SR / PR posting. Should land before Phase F RFQ and Phase G three-way match so they don't add a 5th and 6th parallel copy of the same logic.

## Verification

- `frontend && npx tsc --noEmit` clean.
- `frontend && npm run build` clean.
- `backend && npx tsc --noEmit` clean.
- `backend && npx jest --testPathPatterns="(SalesPostingUseCases|PurchasePostingUseCases|SalesReturn|PurchaseReturn)"` → **6 suites, 59 tests pass**.
- `backend && npx jest --testPathPatterns="(PostingAuthority|RejectionContract|PostingGateway)"` → **3 suites, 19 tests pass**.

## QA script

Pre-req: a fresh tenant (not SYCO) with a tax code that has **only** the Sales Tax Account configured — leave Purchase Tax Account blank.

1. Create a Sales Invoice using that tax code. Save & approve from Approval Center.
   - **Expected:** posts cleanly; ledger debit = credit.
2. Create a Purchase Invoice using the same tax code. Save & post.
   - **Expected (before fix):** Critical Error — `INFRA_999 — debit=N, credit=N+tax`.
   - **Expected (after fix):** Error dialog — `ACCOUNT_MAPPING_MISSING`. Message: `Tax code "<label>" has no Purchase Tax Account configured. Set it in Settings → Tax Codes before posting this invoice (line 1).` Severity = ERROR (not Critical Error).
3. Open Settings → Tax Codes → fill the Purchase Tax Account → save.
4. Retry the PI. Voucher posts; ledger debit = credit.
5. While on the PI detail page, change the line tax code from exclusive to inclusive (or flip the "Price is inclusive by default" on the tax code).
   - **Expected:** Line Total column shows the Net + Tax gross (100 for inclusive 10×10@10%; 110 for exclusive 10×10@10%). Subtotal and Tax in the footer match the column.
6. Repeat (1–5) on a Sales Return and a Purchase Return — same error surfacing, same Line Total math.

## Next steps for follow-up agents

- Run Task 178 to consolidate the four-copy posting middle layer before Phase F / Phase G land.
- Task 177 (UI) carries the rest of the SI/PI visual punch list: compact layout, severity-driven ErrorModal title, posted-view treatment, Settlement card placement, SI phantom empty rows.
- Task 169 Finding A (audit `changes[]` empty for CREATE/POST) becomes a one-line fix once Task 178 lands.
