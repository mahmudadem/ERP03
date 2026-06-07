# 179 — Editing posted documents (non-financial vs financial, layered edit policy)

**Status:** Phase 0 ✅ done (2026-06-07) · Phases 1–6 open
**Origin:** Mahmud, 2026-06-06/07 — "when can we edit a posted sales/purchase invoice? Non-financial data is OK, but the ledger result must always obey the accounting work rules."
**Scope:** Sales Invoice + Purchase Invoice first (the money documents). SR/PR/SO follow the same pattern later.
**Depends on:** [Task 178](./178-subledger-document-poster-refactor.md) (atomic reverse+repost lives in the shared poster), [Task 177](./177-si-pi-detail-page-redesign.md) (UI affordances + severity-driven ErrorModal), [Task 169 Finding A](./169-audit-history-empty-and-flexible-label.md) (amendment diffs for the approver).

---

## The product decision (settled)

A posted invoice's **paperwork** is always editable; its **money** obeys the accounting mode.

- **Non-financial fields** (notes, salesperson, customer/vendor reference, due date, attachments, tags) → always editable, even on POSTED, audited, no ledger effect.
- **Financial fields** (lines: qty/price/tax/discount; date; currency; FX; party; charges) → obey the company's **edit mode**:
  - **Mode A — "Just fix it"** (small/regular users): user edits and saves; the system automatically reverses the old voucher and re-posts the new one (atomically). Invoice keeps its number. Audit keeps both versions. If approval is required, the edit re-enters the approval gate first.
  - **Mode B — "Locked, reverse to correct"** (big companies / VAT regimes): financial fields are read-only on a posted invoice. To correct, the user **Reverses** (credit note) and **re-issues**. Two permanent documents.

**The trap we must never build:** "edit in Sales but leave the ledger alone." A document that disagrees with its voucher breaks the one invariant the Posting-Authority epic protects. Editing money *always* moves the books — the only choice is *how* (Mode A auto-rebuild vs Mode B reverse-and-reissue).

**SoD:** the salesperson never writes the ledger directly. A money-edit re-enters the same approval gate the invoice went through originally (consistent with `ff12af20` — source modules can't approve).

---

## How it sits on existing mechanisms (verified 2026-06-07)

- **Lock policy enum already exists** — [`PostingLockPolicy`](../../backend/src/domain/accounting/types/VoucherTypes.ts): `STRICT_LOCKED` (= Mode B), `FLEXIBLE_EDITABLE` ("updates trigger ledger re-sync" = Mode A), `FLEXIBLE_LOCKED` (current SI/PI default — flexible in theory, locked in practice). Accounting vouchers already pick a policy dynamically ([VoucherUseCases.ts:535](../../backend/src/application/accounting/use-cases/VoucherUseCases.ts:535)); sales/purchase docs don't.
- **Edit mode (A/B) belongs in the layered resolver** — [`DocumentPolicyResolver`](../../backend/src/application/common/services/DocumentPolicyResolver.ts) already resolves **form → branch → company → base** and reports `resolvedBy`. The edit policy becomes one more rule type there, inheriting that layering **plus a per-voucher-type default** (so "SI = B, Stock Adjustment = A").
- **Field classification belongs in the Field Library** — [`FieldLibraryEntry`](../../backend/src/domain/designer/entities/FieldLibraryEntry.ts) carries `fieldClass` but **no `financial` flag today** (net-new).
- **The form stays dumb** — it never reasons about modes. It calls one shared `isFieldEditable(field, status, mode, role)` and paints editable or read-only.

```
Field Library:           "qty is financial"            (what kind of field)
DocumentPolicyResolver:  "this form → Mode B"          (what's allowed, layered)
isFieldEditable():       combine → "locked here"        (the form asks this)
Form:                    paints editable or read-only   (dumb renderer)
```

---

## Phases

### Phase 0 — non-financial editable on POSTED ✅ DONE (2026-06-07)
Relax the SI/PI update guard so non-financial fields can change on a POSTED invoice (audited); any financial change is refused with a clear error. No policy resolver yet, no reverse/amend yet — this is the foundation and the immediate "I can't even fix a typo on a posted invoice" fix.

**Shipped:**
- [`PostedDocumentEditGuard.ts`](../../backend/src/application/common/services/PostedDocumentEditGuard.ts) — shared `assertPostedNonFinancialEditOnly` + `scalarChanged` + `lineSignaturesEqual` (no per-module duplication).
- `UpdateSalesInvoiceUseCase` + `UpdatePurchaseInvoiceUseCase`: on POSTED, detect changed financial fields (scalars + line/charge financial signature); throw `POSTED_FINANCIAL_EDIT_BLOCKED` (ACC_011) if any; otherwise apply only non-financial fields (financial apply blocks gated to DRAFT).
- PI update now records an audit row (it never did before) — added `PURCHASE_INVOICE` to `RecordChangeEntityType`, wired `RecordChangeService` into the use case + the `updatePI` controller endpoint.
- Unit tests: `PostedDocumentEditGuard.test.ts` (9 tests). Full sales/purchases suites green (322 tests).

**Phase 0 deliberately does NOT:** expose any of this in the UI (Task 177 owns that), allow financial edits, build reverse, or resolve Mode A/B. A posted invoice today is therefore "non-financial editable via API, financial locked" everywhere — which is exactly Mode B minus the reverse button. That's a safe default until the rest lands.

### Phase 1 — financial field flag
Add `financial: boolean` to the Field Library (curated set first). One flag per field.

### Phase 2 — edit-policy resolution
Add `editPolicy: 'A' | 'B'` as a rule resolved through `DocumentPolicyResolver` (form→branch→company→base) + per-voucher-type default. Surfaces in Accounting Settings.

### Phase 3 — shared editability helper + dumb forms
`isFieldEditable(field, status, mode, role)`. SI/PI/SR/PR forms become renderers of its result. (UI work → Task 177.)

### Phase 4 — first-class Reverse for SI/PI
Today there's no direct reverse on SI/PI (correction = manually create a Return). Build a real Reverse (counter-voucher + status REVERSED + link) so Mode B's "reverse & re-issue" is real.

### Phase 5 — Mode A amend loop (depends on Task 178)
Wire `FLEXIBLE_EDITABLE`. A money-edit on a posted doc → amendment → re-approval (if required) → atomic reverse+repost via the `SubledgerDocumentPoster`. Old voucher stays live until the amendment is approved.

### Phase 6 — edge-case guards
Settlement (block financial edit on PAID/partial; reject total < paid), period-lock (re-post obeys lock + override path), stock (reverse + re-apply atomically), document relationships (SI with a Return against it), concurrency (optimistic version), mid-amendment mode flip.

---

## Full edge-case register (decisions)

| # | Case | Decision |
|---|---|---|
| 1 | Edit notes on POSTED | Allowed (Phase 0 ✅). |
| 2 | Money-edit, Mode A, approval required | Re-park to PENDING_APPROVAL; old voucher live until approved; then atomic reverse+repost. |
| 3 | Money-edit, Mode A, no approval | Immediate atomic reverse+repost. |
| 4 | Money-edit, Mode B | Blocked; Reverse & re-issue only. |
| 5 | Edit on REVERSED/CANCELLED | Fully locked. |
| 6 | Edit on PAID | Block financial; require un-settle first. |
| 7 | Edit on PARTIALLY paid | Block financial; clear "unallocate settled X first". |
| 8 | Edit dropping total below amount paid | Reject (negative outstanding). |
| 9 | Edit in LOCKED period | Re-post obeys period lock; override-reason path. |
| 10 | Edit changes qty → stock moved | Reverse + re-apply stock atomically with the voucher. |
| 11 | Edit changes party | Treat as financial (AR/AP account changes); full reverse+repost. |
| 12 | Tax-code change to one with no posting account | Re-post re-runs account resolution → `AccountMappingError` (already normalized, report 180). |
| 13 | Edit an SI that has a Return against it | Block (or require the Return be voided first). |
| 14 | Edit an SI sourced from DN/SO | Locked source fields stay locked; only standalone fields amend. |
| 15 | Concurrent edit | Optimistic version check; second save rejected ("reload"). |
| 16 | Company flips Mode A→B mid-amendment | In-flight amendment finishes under its starting mode; new edits use new mode. |
| 17 | A field's `financial` flag changes after docs posted | Classification read at edit time, not stored per-doc; conscious admin action, documented. |
| 18 | Amended doc re-entering PENDING_APPROVAL | Marked as amendment with before/after diff (depends on Task 169A). |

---

## Definition of done (whole task)

- Field Library `financial` flag; edit-policy rule in `DocumentPolicyResolver` (layered + per-type); `isFieldEditable()` helper; dumb SI/PI forms.
- Mode A (amend) and Mode B (reverse & re-issue) both functional for SI + PI, driven by company config.
- All edge-case guards (#6–#16) enforced backend-side, not just UI.
- Backend suites green; architecture test forbids in-place financial mutation of a posted document outside the amend/reverse path.
- `docs/architecture/posting-authority.md` + user guides updated; done report.
