# Task 148 — Native Sales Retest

**Status:** 🟡 In progress
**Owner:** Claude (Opus 4.7)
**Branch:** `feat/init-wizard-forms-selection`
**Started:** 2026-05-31

## Why

v1 ships native forms as the headline surface (see JOURNAL.md:324 "v1 strategy decision"). Before we hardcode polished per-voucher renderings (Task 132 Phase 4.5), every native Sales flow must be walked end-to-end to surface regressions. Polishing over an unknown bug is wasted work.

## Scope

Native Sales pages only (no default forms, no Field Library, no cloned forms). Each flow is checked against the verb matrix below; deviations are logged as findings.

### Verb matrix (apply per flow where applicable)

| Verb | Notes |
|------|-------|
| Create | Header + lines + selectors + validation |
| Edit | Field updates, line add/remove/reorder |
| Post | GL impact preview + posting + period-lock check |
| Pay / Settle | Apply payment, partial, overpay guard |
| Cancel / Void | Reversal, audit entry, GL effect |
| Send | WhatsApp / Telegram / Email outbound |
| Attach | Upload, list, download, delete |
| Audit | Per-record audit log shows expected events |
| Period-lock override | Role-gated, soft-lock override path |
| Credit override | SO confirm path for over-limit customers |

## Pages in scope

### Operational vouchers
1. **Quotations** — [QuotationsPage.tsx](../../frontend/src/modules/sales/pages/QuotationsPage.tsx), [QuotationDetailPage.tsx](../../frontend/src/modules/sales/pages/QuotationDetailPage.tsx)
2. **Sales Orders** — [SalesOrdersListPage.tsx](../../frontend/src/modules/sales/pages/SalesOrdersListPage.tsx), [SalesOrderDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesOrderDetailPage.tsx)
3. **Delivery Notes** — [DeliveryNotesListPage.tsx](../../frontend/src/modules/sales/pages/DeliveryNotesListPage.tsx), [DeliveryNoteDetailPage.tsx](../../frontend/src/modules/sales/pages/DeliveryNoteDetailPage.tsx)
4. **Sales Invoices** — [SalesInvoicesListPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx), [SalesInvoiceDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx)
5. **Sales Returns** — [SalesReturnsListPage.tsx](../../frontend/src/modules/sales/pages/SalesReturnsListPage.tsx), [SalesReturnDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesReturnDetailPage.tsx)

### Master data
6. **Customers** — list + detail
7. **Customer Groups**
8. **Price Lists**
9. **Promotions**
10. **Salespersons**
11. **Recurring Invoices** (templates + generate-due button)

### Reports
12. **AR Aging**
13. **Customer Statement**
14. **Sales Analytics**
15. **Aged Backlog**

### Settings
16. **Sales Settings** (all tabs)

## Method

Walk each page in the order above. For each flow, record one of:
- ✅ Pass — works as intended in both classic and Windows UI modes.
- ⚠ Polish — works but needs visual/UX cleanup before Phase 4.5 hardcoding. Add to polish backlog.
- 🔴 Bug — broken, blocks the verb. Fix immediately or open a sub-task.

Findings table below. Update as we go.

## Findings

### Batch 1 — Voucher list pages (2026-05-31, code audit)

| # | Page | Severity | Note |
|---|------|----------|------|
| F1 | All 5 lists | 🔴 | **Report 144 list standardization is incomplete.** Only `SalesInvoicesListPage` got the new pattern (PageHeader, PartySelector filter, EmptyState, refresh, clear). SO, DN, SR, Quotations lists still on old bespoke patterns. ACTIVE.md treats this as done — it isn't. |
| F2 | All 5 lists | 🔴 | **i18n broken.** Even the "standardized" SI list has hardcoded English table headers (`SalesInvoicesListPage.tsx:195-201`). Quotations is 100% hardcoded English. Will not work in Arabic or Turkish. |
| F3 | QuotationsPage | 🔴 | Bespoke pseudo-luxury header (colored icon block, uppercase tracking-widest), `max-w-5xl` container that will look cramped on wide screens, card-row layout instead of standard table, no status/customer filter, no refresh. Looks like an early prototype that was never migrated. |
| F4 | SalesOrdersListPage | ⚠ | Bespoke `<h1>` header (no `PageHeader`). No `PartySelector` for customer. No refresh/clear. Plain `<td>` instead of `EmptyState`. Monochrome `bg-slate-100` status chip — no color coding. ✅ Has nice 6-chip status-count summary (worth promoting to other lists). |
| F5 | DeliveryNotesListPage | ⚠ | Bespoke header. No `PartySelector`, no warehouse filter, no refresh, no clear, no `EmptyState`. Monochrome status chip. No grand-total column (other lists show it). |
| F6 | SalesReturnsListPage | ⚠ | Bespoke header. No `PartySelector`, no refresh, no clear, no `EmptyState`. Monochrome status chip. Context filter is a plain `<select>` — should be chips/tabs given it has only two values. |
| F7 | All 5 lists | ⚠ | Hardcoded `bg-slate-900` "New X" button instead of theme primary (`bg-primary-600`). Won't honor user-selected appearance theme. |

### Cross-cutting

- **List inconsistency is the #1 v1 onboarding risk for Sales.** A new user clicks Quotations → Sales Orders → Sales Invoices in the sidebar and sees three completely different page layouts. That undermines "finished product" perception more than any individual bug.
- **Quotation list is in a class of its own** — recommend a single rewrite to bring it in line with SI list, rather than incremental tweaks.
- **i18n cleanup is mechanical but tedious** — ~50 hardcoded strings across the 5 list pages.

## Polish backlog (for Phase 4.5)

- [ ] **PB1**: Standardize SO/DN/SR/Quotations lists to the report-144 SI pattern (`PageHeader`, `PartySelector` filter where applicable, refresh, clear, `EmptyState`, color-coded status chips).
- [ ] **PB2**: Replace hardcoded English table headers and labels with i18n keys across all 5 lists.
- [ ] **PB3**: Promote SO's status-count summary chips to the shared list pattern; add to SI/DN/SR/Quotations.
- [ ] **PB4**: Replace hardcoded `bg-slate-900` buttons with theme primary.
- [ ] **PB5**: Rewrite QuotationsPage card-row layout as the standard table.

### Batch 2 — Sales Invoice Detail (2026-05-31, code audit)

**Verb matrix:**

| Verb | Status | Evidence |
|------|--------|----------|
| Create draft | ✅ | `createDraft()` line 746 |
| Create + post | ✅ | `createAndPostDraft()` line 824 |
| Edit | 🔴 **MISSING** | View mode is read-only. `salesApi.updateSI` exists but is only invoked from dynamic voucher renderers (`useVoucherActions.ts:626`, `useDocumentActions.ts:42`). Native SI Detail has no edit path. |
| Post | ✅ | `postDraft()` line 951 |
| Pay / Settle on post | ✅ | Settlement modal: DEFERRED/CASH_FULL/MULTI; payment-method-aware |
| Pay (after post) | ✅ via navigation | `Create Receipt` button routes to Accounting Vouchers for AR settlement (line 2371) |
| Cancel / Void | 🔴 **MISSING** | No UI; no `cancelSI` in `salesApi.ts`. May be intentional accounting choice (use Sales Return instead), but UI should make that obvious. |
| Send (WhatsApp) | ✅ | Modal at line 2450, sender selection, document URL, message |
| Send (Telegram) | ✅ | Modal at line 2532 |
| Attach | ✅ | Upload (10MB / 5 files), list, download, remove |
| Audit log | ✅ | `History` button → `RecordAuditModal` |
| Period-lock override | ✅ | `PeriodLockOverrideModal` triggered on `PERIOD_LOCKED` SOFT tier (line 977) |
| Credit override | ✅ | Full modal flow with reason capture, info display, separate WARN banner |
| Bonus: Clone-to-Recurring | ✅ | Modal at line 2614, full frequency/start/end/max-occurrences |
| Bonus: GL Impact | ✅ | Modal preview |
| Bonus: Create Return navigation | ✅ | Button → `/sales/returns/new?salesInvoiceId=...` |

**Findings:**

| # | Severity | Note |
|---|----------|------|
| F8 | 🔴 | **Edit verb is missing from the native SI Detail page.** Once a draft is created, you cannot update header/lines/charges from this UI. The backend supports it (`updateSI`); only the dynamic voucher renderers expose it. Major gap for v1 since natives are the headline surface. |
| F9 | 🔴 | **No Cancel/Void button** for DRAFT or POSTED invoices. Even DRAFT invoices cannot be discarded — users must navigate away. Posted invoices have no reversal path on this page (must navigate to Sales Returns separately). |
| F10 | 🔴 | **Pervasive hardcoded English** across the entire 2,739-line page: validation messages (lines 692-720), all form labels (Sales Order, Customer, Salesperson, Customer Invoice #, Invoice Date, Due Date, Currency, Exchange Rate, Notes, Line Items, Add Item, Charges/Additions, Totals, Settlement Mode and its options, Payment Method options, all 12 table headers, Save Draft, Save & Post, Post Invoice, Back to List, GL Impact, History, Create Return, Create Receipt). Send-via-* modals and recurring-clone modal ARE i18n'd — that's the pattern to follow. |
| F11 | ⚠ | **Status chip in view mode is monochrome** (`bg-slate-100` line 1990) regardless of DRAFT/POSTED/CANCELLED. Reuse the `statusChipClass` helper from `SalesInvoicesListPage`. |
| F12 | ⚠ | **9-color action button parade** in view mode bottom bar: slate-900, blue-600, amber-300, emerald-300, teal-300, sky-300, indigo-300, violet-300, gray-300. Should rationalize to: primary (post/send), neutral (audit/back), warning (return/credit), success (receipt). |
| F13 | ⚠ | **Initial currency hardcoded to 'USD'** (`createEmptyForm` line 148). Should pull from `company.baseCurrency`. |
| F14 | ⚠ | **Auto-pricing failure silently swallowed** (line 651-653). User has no indication the customer-specific price didn't apply — they may save invoices at wrong prices. Should at minimum show a transient warning toast. |
| F15 | ⚠ | **"Back to List" placement inconsistent** — top-right in create mode (line 1252), bottom in view mode (line 2343). Pick one. |
| F16 | ⚠ | **Loading and not-found states are bare** (lines 1236-1243, 1967-1974). Just plain text in a `<h1>` + `<Card>`. Use a skeleton + `EmptyState`. |
| F17 | ⚠ | **Settlement modal state not reset between invoices** — `settlementMode`/`arAccountId`/`settlementRows` persist across `params.id` changes. |
| F18 | ⚠ | **2,739-line component** — should be split: HeaderForm, LineTable, ChargesSection, SettlementModal, SendModals, CloneRecurringModal, ViewMode. Increases test coverage feasibility and reduces blast radius of future polish work. |
| F19 | ⚠ | **`// eslint-disable-line react-hooks/exhaustive-deps`** appears at lines 545, 552 — fragile dependency tracking. |

**Cross-reference**: F8 (no Edit) is the **most important v1 gap** uncovered so far. Without Edit, the user's "the simplest thing to start working with on onboarding" promise breaks the moment a user makes a typo on a draft invoice.

## Polish backlog (for Phase 4.5) — running

- [ ] **PB1**: Standardize SO/DN/SR/Quotations lists to the report-144 SI pattern. _(in progress — sub-agent)_
- [ ] **PB2**: Replace hardcoded English with i18n keys across all 5 lists. _(in progress — sub-agent)_
- [ ] **PB3**: Promote SO's status-count summary chips to the shared list pattern.
- [ ] **PB4**: Replace hardcoded `bg-slate-900` buttons with theme primary.
- [ ] **PB5**: Rewrite QuotationsPage to standard pattern. _(in progress — sub-agent)_
- [ ] **PB6**: Add color-coded status chip helper to SI Detail view (re-use list chip styles).
- [ ] **PB7**: Rationalize SI Detail action button palette to 4 semantic colors max.
- [ ] **PB8**: Default invoice currency to `company.baseCurrency`, not 'USD'.
- [ ] **PB9**: Surface auto-pricing failures with a transient toast on SI Detail.
- [ ] **PB10**: Split SI Detail into sub-components (HeaderForm, LineTable, ChargesSection, SettlementModal, SendModals, CloneRecurringModal, ViewMode).
- [ ] **PB11**: Use shared `EmptyState` + skeleton for SI Detail loading/not-found.

## Bugs filed (🔴)

- [ ] **B1 (F8)**: Wire `salesApi.updateSI` into native SI Detail. Allow editing of DRAFT invoices from the same page (turn the read-only view into an editable form when `status === 'DRAFT'`). Add a "Save Changes" button.
- [ ] **B2 (F9)**: Add Cancel for DRAFT invoices (likely a `deleteSI` if the backend supports, else hide draft from list). For POSTED, add a clear "Reverse via Sales Return" button that navigates to the return creation flow — no actual void in accounting books.
- [ ] **B3 (F10)**: i18n migration for SI Detail — ~150 strings. Use the send-via-WhatsApp/Telegram modals (already i18n'd) as the pattern. This is the largest single i18n debt in the module.

### Batch 3 — Quotation Detail (2026-05-31, code audit)

**Verb matrix:**

| Verb | Status | Evidence |
|------|--------|----------|
| Create draft | ✅ | `salesOperationalApi.createQuote` (line 327) |
| Edit | ✅ **Pattern model** | `updateQuote` line 330. Same form serves edit + view via `isReadOnly = !isDraft` flag (line 196). **This is the pattern SI Detail should adopt for B1.** |
| Send (status change) | ✅ partial | `sendQuote` flips status DRAFT → SENT |
| Send via WhatsApp/Telegram | 🔴 **MISSING** | No outbound messaging — quotes can't be delivered to customers from this page. |
| Accept | ✅ | `acceptQuote` |
| Reject | ✅ | `rejectQuote` |
| Revise | ✅ | `reviseQuote` creates a new version, navigates to it |
| Convert to Sales Order | ✅ | Navigates to new SO |
| Convert to Invoice | ✅ | Navigates to new SI |
| Attach | 🔴 **MISSING** | No attachments — quotes often need terms/spec PDFs attached. |
| Audit log | 🔴 **MISSING** | No History button. |
| GL Impact | n/a | Quotes don't post; OK to omit. |
| Period-lock override | n/a | Quotes don't post; OK to omit. |
| Cancel / Void | 🔴 **MISSING** | Even REJECTED quotes can't be deleted; no way to discard a DRAFT either. |

**Cross-page pattern insight:**

| Concern | Quote Detail | SI Detail |
|---------|-------------|-----------|
| **Edit when DRAFT** | ✅ (model pattern) | 🔴 missing |
| **Send via messaging** | 🔴 missing | ✅ (full WhatsApp + Telegram) |
| **Attachments** | 🔴 missing | ✅ |
| **Audit history** | 🔴 missing | ✅ |
| **Cancel / Discard** | 🔴 missing | 🔴 missing |
| **i18n coverage** | 0% | ~10% (only outbound-message modals) |
| **Status chip on DRAFT** | hidden | monochrome shown |
| **ItemSelector** | plain `<select>` | shared component |
| **CurrencySelector** | plain `<input maxLength=3>` | shared component |
| **Exchange rate widget** | plain `<input>` | `CurrencyExchangeWidget` |
| **Tax-inclusive support** | 🔴 missing | ✅ per-line override |
| **Container width** | `max-w-5xl` cramped | full width |

**Findings:**

| # | Severity | Note |
|---|----------|------|
| F20 | 🔴 | **No WhatsApp/Telegram send on Quotation.** Quotes are typically the FIRST outbound document — should support messaging at least as well as invoices do. Reuse the SI modal components. |
| F21 | 🔴 | **No attachments on Quotation.** Quotes often need product spec PDFs, terms of service, drawings. |
| F22 | 🔴 | **No History/audit log on Quotation.** Status changes (DRAFT → SENT → ACCEPTED, revisions) are exactly what should be audited. |
| F23 | 🔴 | **No Cancel/Discard.** A typo'd draft can't be deleted; a rejected quote can't be removed. |
| F24 | ⚠ | Quote Detail uses primitive controls (plain item `<select>`, plain currency `<input>`, plain exchange-rate number) where SI Detail uses shared selectors (`ItemSelector`, `CurrencySelector`, `CurrencyExchangeWidget`). Quote should adopt the shared components. |
| F25 | ⚠ | No tax-inclusive pricing support — required for many countries (EU, UK, AU). |
| F26 | ⚠ | Bespoke header with colored icon block and `max-w-5xl` container — same off-pattern as the list page. Will be standardized when the native-detail contract lands. |
| F27 | ⚠ | Status chip is hidden when DRAFT (line 435). Always show — it's the most common status at any moment. |
| F28 | ⚠ | `(form as any).version` type cast hack (line 432). Quote DTO should expose `version` as a proper field. |
| F29 | ⚠ | 100% hardcoded English. ~80 strings. |
| F30 | ⚠ | 6-color action button parade (slate-900, blue-600, green-600, red-300, indigo-600, emerald-600). Same pattern as SI Detail — same fix. |
| F31 | ⚠ | Currency default `'USD'` hardcoded (line 95) — same fix as F13. |

**Key insight: Quote and SI have OPPOSITE feature gaps.** Quote has the Edit pattern but lacks messaging/attach/audit. SI has rich operational features but lacks Edit. **The native-detail contract should be the union of both** — every detail page gets:
1. Editable when in editable status (Quote DRAFT, SI DRAFT, SO DRAFT, DN DRAFT, SR DRAFT).
2. WhatsApp + Telegram send modals (reuse SI components).
3. Attachments (reuse SI components).
4. History/audit modal (reuse `RecordAuditModal`).
5. Cancel for editable status; Reverse for posted status.
6. Shared selectors (`PartySelector`, `ItemSelector`, `CurrencySelector`, `CurrencyExchangeWidget`, `DatePicker`).
7. i18n everywhere.
8. Standardized header + full-width container.
9. Color-coded status chip always shown.
10. Rationalized 4-color action button palette.

This is the "v1 hardcoded native polish" the user described — one contract, applied to all 5 detail pages identically.

## Polish backlog (for Phase 4.5) — running

- [ ] **PB1**: Standardize SO/DN/SR/Quotations lists to the report-144 SI pattern. _(in progress — sub-agent)_
- [ ] **PB2**: Replace hardcoded English with i18n keys across all 5 lists. _(in progress — sub-agent)_
- [ ] **PB3**: Promote SO's status-count summary chips to the shared list pattern.
- [ ] **PB4**: Replace hardcoded `bg-slate-900` buttons with theme primary.
- [ ] **PB5**: Rewrite QuotationsPage to standard pattern. _(✅ done — sub-agent 2)_
- [ ] **PB6**: Add color-coded status chip helper to SI Detail view.
- [ ] **PB7**: Rationalize SI/Quote/SO/DN/SR Detail action button palette to 4 semantic colors max.
- [ ] **PB8**: Default invoice/quote currency to `company.baseCurrency`, not 'USD'.
- [ ] **PB9**: Surface auto-pricing failures with a transient toast on SI Detail.
- [ ] **PB10**: Split SI Detail into sub-components.
- [ ] **PB11**: Use shared `EmptyState` + skeleton for SI/Quote/SO/DN/SR Detail loading/not-found.
- [ ] **PB12**: Adopt shared `ItemSelector` / `CurrencySelector` / `CurrencyExchangeWidget` across Quote/SO/DN/SR Detail.
- [ ] **PB13**: Add tax-inclusive per-line override to Quote/SO/DN/SR Detail.
- [ ] **PB14**: Always show status chip (including DRAFT) on all detail pages.

## Bugs filed (🔴) — running

- [ ] **B1 (F8)**: Wire `salesApi.updateSI` into native SI Detail using the **Quote Detail `isReadOnly = !isDraft` pattern**.
- [ ] **B2 (F9)**: Add Cancel for DRAFT invoices + Reverse-via-Return for POSTED.
- [ ] **B3 (F10)**: i18n migration for SI Detail.
- [ ] **B4 (F20)**: Add WhatsApp + Telegram send modals to Quotation Detail (reuse SI components).
- [ ] **B5 (F21)**: Add Attachments section to Quotation Detail (reuse SI components).
- [ ] **B6 (F22)**: Add History/audit modal to Quotation Detail (reuse `RecordAuditModal`).
- [ ] **B7 (F23)**: Add Cancel/Discard for all editable-status quotes and rejected quotes.
- [ ] **B8 (F29)**: i18n migration for Quote Detail — ~80 strings.

### Batch 4 — Sales Order Detail (2026-05-31, partial read + grep)

**Verb matrix:**

| Verb | Status | Evidence |
|------|--------|----------|
| Create draft | ✅ | `salesApi.createSO` line 550 |
| Edit | ✅ | `salesApi.updateSO` line 554, `isReadOnly` flag |
| Confirm | ✅ | `salesApi.confirmSO` line 615 |
| Cancel | ✅ | `salesApi.cancelSO` line 677 |
| Close | ✅ | `salesApi.closeSO` line 685 |
| Audit log | ✅ | `RecordAuditModal` line 1318 |
| Credit override | ✅ **gold standard** | RBAC-gated: `canOverrideCredit = allowCreditOverride && (isOwner || hasPermission('sales.creditOverride'))` line 133-134. Different messages for "policy disabled" vs "lacks permission" (lines 638-642). |
| Live promo suggestions | ✅ **unique** | `promoSuggestions` state + dismissible per-rule cards |
| Linked-doc display | ✅ | Shows linked DNs/SIs/SRs |
| Send via messaging | 🔴 missing | |
| Attachments | 🔴 missing | |
| GL Impact / Period-lock | n/a | SO doesn't post |

**Findings:**

| # | Severity | Note |
|---|----------|------|
| F32 | 🔴 | **No WhatsApp/Telegram send on SO** — order confirmations are an important customer touchpoint. |
| F33 | 🔴 | **No attachments on SO** — POs from customers, signed acceptance documents, drawings. |
| F34 | 🔴 **security** | **SI Detail credit override has NO RBAC check** — any user can override the credit limit by typing a reason. SO Detail's `canOverrideCredit` pattern (line 133-134) must be backported. Tag as security finding. |
| F35 | ⚠ | Credit override modal text hardcoded English ("Credit Limit Exceeded", "Override Reason"). Same issue as SI. |
| F36 | ⚠ | Currency default 'USD' hardcoded (line 93). |
| F37 | ⚠ | Status chip CORRECTLY uses `statusBadgeClass` color coding (line 708) — this is the helper to share across all detail pages. |

### Batch 5 — Delivery Note Detail (grep-based)

**Verb matrix:**

| Verb | Status | Evidence |
|------|--------|----------|
| Create draft | ✅ | (assumed; not verified) |
| Edit | 🔴 **MISSING** | No `updateDN` in grep |
| Post | ✅ | `salesApi.postDN` line 406 — accepts `periodLockOverrideReason` |
| Cancel / Void | 🔴 **MISSING** | No `cancelDN` in grep |
| GL Impact | ✅ | `GlImpactModal` |
| Period-lock override | ✅ | `PeriodLockOverrideModal` |
| Audit log | ✅ | `RecordAuditModal` |
| Create Return navigation | ✅ | `canCreateReturn` based on settings |
| Send via messaging | 🔴 missing | |
| Attachments | 🔴 missing | |

**Findings:**

| # | Severity | Note |
|---|----------|------|
| F38 | 🔴 | **DN has no Edit or Cancel** — same gaps as SI. Confirms the systemic pattern. |
| F39 | 🔴 | **DN has no Attachments** — delivery proof (signed POD, photo) is exactly what attachments are for. |
| F40 | 🔴 | **DN has no WhatsApp/Telegram send** — customers expect delivery confirmation messages. |

### Batch 6 — Sales Return Detail (grep-based)

**Verb matrix:**

| Verb | Status | Evidence |
|------|--------|----------|
| Create draft | ✅ | `salesApi.createReturn` line 420 |
| Edit | 🔴 **MISSING** | No `updateReturn` in grep |
| Post | ✅ | `salesApi.postReturn` line 442 — accepts `periodLockOverrideReason` |
| Cancel / Void | 🔴 **MISSING** | No `cancelReturn` in grep |
| GL Impact | ✅ | `GlImpactModal` |
| Period-lock override | ✅ | `PeriodLockOverrideModal` |
| Audit log | ✅ | `RecordAuditModal` |
| Before/after invoice paths | ✅ | per F6 list-page note |
| Send via messaging | 🔴 missing | |
| Attachments | 🔴 missing | (credit notes often need supporting docs) |

**Findings:**

| # | Severity | Note |
|---|----------|------|
| F41 | 🔴 | **SR has no Edit or Cancel** — same systemic pattern. |
| F42 | 🔴 | **SR has no Attachments** — return authorization (RMA), photos of damaged goods, customer email approval. |
| F43 | 🔴 | **SR has no WhatsApp/Telegram send** — customers expect credit-note delivery. |

---

## Synthesis — the native-detail contract

Three distinct page generations are visible:

| Generation | Pages | Got | Missing |
|-----------|-------|-----|---------|
| **Gen 1: "operational"** | Quote, SO | Edit + Cancel + Audit | Posting, messaging, attachments |
| **Gen 2: "postable"** | SI, DN, SR | Post + GL/Period/Audit modals | Edit, Cancel |
| **Gen 3: "outbound"** | SI only | Messaging + Attachments | (the missing rest) |

Each generation evolved without backporting. **The v1 native-detail contract is the UNION**:

| Capability | Source pattern | Apply to |
|-----------|----------------|----------|
| Edit when in editable status | Quote's `isReadOnly = !isDraft` (line 196) | SI, DN, SR |
| Cancel/Discard | SO's `cancelSO` flow | Quote, SI, DN, SR (or design accounting-correct reversal for posted) |
| RBAC-gated credit override | SO's `canOverrideCredit` (line 133-134) | SI |
| WhatsApp + Telegram send modals | SI's modal pair (lines 2450, 2532) | Quote, SO, DN, SR |
| Attachments section | SI's section (line 2100) | Quote, SO, DN, SR |
| Color-coded status chip always shown | SO's `statusBadgeClass` (line 100) | All 5 |
| Shared selectors (Item/Currency/Exchange) | SI uses all 3 | Quote (currently primitive), SO, DN, SR |
| i18n everywhere | Send-via-WhatsApp modal pattern | All 5 (~400 strings total) |
| Default currency = `company.baseCurrency` | (none yet — bug everywhere) | All 5 |
| 4-color action button palette | (none yet — bug everywhere) | All 5 |

Implementing this contract uniformly is the answer to "the simplest thing for a regular company to start working on onboarding". Estimated effort: **5–7 working days** across all 5 pages, parallelizable.

## Definition of Done

- All 16 pages walked in both UI modes.
- All 🔴 findings either fixed or filed as sub-tasks.
- ⚠ polish backlog handed to Phase 4.5 in [tasks/132-ux-layout-production-hardening.md](./132-ux-layout-production-hardening.md).
- Completion report at `planning/done/148-native-sales-retest.md`.
- JOURNAL entry + ACTIVE.md updated.
