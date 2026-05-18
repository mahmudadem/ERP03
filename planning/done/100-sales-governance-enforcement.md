# Task 100 — Sales Governance Enforcement

**Status:** ✅ Complete
**Date completed:** 2026-05-18
**Branch:** `chore/enterprise-restructure`
**Time spent:** ~3.8h (initial ~2.8h + audit fixes ~1.0h)
**Linked plan:** [`planning/tasks/100-sales-governance-enforcement.md`](../tasks/100-sales-governance-enforcement.md)
**Linked architecture doc:** [`docs/architecture/sales.md`](../../docs/architecture/sales.md)
**Linked user guide:** [`docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md`](../../docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md)

---

## Definition of Done — Checklist

- [x] Code merged
- [x] `docs/architecture/sales.md` updated — workflow governance precedence documented
- [x] `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md` updated — governance exceptions explained
- [x] This completion report links both docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

Enforced the clarified Sales workflow governance model across backend policy, native Sales pages, and cloneable/dynamic forms. The key change: `OPERATIONAL` workflow mode now blocks direct invoicing by default, and re-enabling it at invoice runtime requires explicit company or form governance rules.

### Files Changed

**Backend**
- `backend/src/application/common/services/DocumentPolicyResolver.ts` — Full governance-aware persona resolution with precedence chain (form → branch → company → base). Added `resolveEffectiveSalesPersonaPolicy()` and `resolveEffectivePurchasePersonaPolicy()`. Deprecated `allowDirectInvoicing` as broad OPERATIONAL override. Branch context remains resolver-ready but is not active for invoice creation until invoice payloads carry branch context.
- `backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` — Plumbed `formType` context into `isSalesInvoicePersonaAllowed()` call so form-scope rules are actually enforced.
- `backend/src/application/purchases/use-cases/PurchaseInvoiceUseCases.ts` — Same context plumbing for purchases.
- `backend/src/application/common/services/__tests__/DocumentPolicyResolver.test.ts` — 22 resolver governance tests covering base policies, company/branch/form rules, precedence chain, and backward compatibility.
- `backend/src/tests/application/sales/SalesDocumentNumberUniqueness.test.ts` — Fixed to use governance rules instead of deprecated `allowDirectInvoicing`; added runtime regression for form-scope direct-invoice allowance.

**Frontend**
- `frontend/src/utils/documentPolicy.ts` — Added `sales_invoice_linked` and `purchase_invoice_linked` to operational document visibility checks. Added shared frontend persona-policy resolution for company/form governance.
- `frontend/src/modules/sales/pages/SalesSettingsPage.tsx` — Removed "Allow Direct Invoicing" checkbox from OPERATIONAL policy section; replaced with governance-aware guidance banner. Limited new Sales invoice governance rules to company/form scopes until branch context is available. Added i18n support.
- `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx` — Added governance warning banner in create mode for OPERATIONAL workflow. Fixed stale Direct Invoicing display to use effective company/form governance policy. Added i18n support.
- `frontend/src/locales/en/common.json` — Added `sales.governance.*` i18n keys.
- `frontend/src/locales/ar/common.json` — Added Arabic translations for `sales.governance.*`.
- `frontend/src/locales/tr/common.json` — Added Turkish translations for `sales.governance.*`.

**Docs**
- `docs/architecture/sales.md` — Updated with workflow governance precedence
- `docs/user-guide/sales/direct-invoice-and-operational-linked-invoice.md` — Updated with governance exception guidance
- `planning/ACTIVE.md`
- `planning/JOURNAL.md`

### Architecture / Behavior

- **Resolver precedence chain**: form-scope rule → branch-scope rule → company-scope rule → base workflow mode default
- **Invoice runtime scope**: company and form rules are active today; branch rules are deferred until invoices carry branch context
- **Base policy**: SIMPLE = {direct:true, linked:false, service:true}, OPERATIONAL = {direct:false, linked:true, service:true}
- **Backward compatibility**: `allowDirectInvoicing` still works in SIMPLE mode but is ignored in OPERATIONAL mode
- **Backend is final authority**: Even if frontend visibility is bypassed, the use case will reject unauthorized personas
- **Context plumbing**: `formType` is passed from the resolved form type; `branchId` is available for future integration when branch context is consistently available

### Verification

- [x] `cd backend && npx tsc --noEmit` clean
- [x] `cd frontend && npx tsc --noEmit` clean
- [x] `cd frontend && npm run build` clean
- [x] `npm run test -- "sales|DocumentPolicy"` — 80/80 passing
- [ ] `graphify update .` — attempted, but `graphify` is unavailable on PATH in this shell

### Known Issues / Follow-ups

- Branch-scope invoice governance is intentionally deferred. The resolver supports it, but Sales invoice creation has no branch context yet and the Sales settings UI no longer offers branch rules for new invoice governance rules.
- `allowDirectInvoicing` field is preserved in the entity for backward compatibility but should be deprecated in a future migration

---

## 2. End-User View

### What's New

The Sales module now properly enforces workflow governance. When your company uses **Operational** workflow (Sales Order → Delivery Note → Invoice), direct invoicing is blocked by default. If you need direct invoicing for specific contexts (like a retail branch), your administrator can add a governance rule to allow it.

### How to Use It

**As a Company Admin:**
1. Go to **Sales → Settings → Governance** tab
2. Review the base policy summary (shows what's allowed/blocked by your workflow mode)
3. Click **Add Rule** to create an exception:
   - Choose the persona (Direct, Linked, or Service)
   - Choose the action (Allow or Block)
   - Choose the scope (Company or Form)
   - For Form scope: enter the form type (e.g., `sales_invoice_direct`)
4. Save settings

**As a Sales User:**
- In **Simple** workflow: Direct invoicing works as before
- In **Operational** workflow: You'll see a warning if you try to create a direct invoice without a governance exception. Select a Sales Order to create a linked invoice instead.

### Where to Find It

- Menu: **Sales → Settings → Governance** tab
- URL: `/sales/settings`
- Required permission: Company Admin or Sales Manager

### Tips

- The Governance tab shows a clear summary of what's allowed by default based on your workflow mode
- Rules are evaluated in order of specificity: form rules override company rules
- You can add multiple rules for different forms

### Limitations

- Branch-scope invoice governance is deferred until branch context exists on invoice creation
- Form-scope rules require the exact form type code (e.g., `sales_invoice_direct`)

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
