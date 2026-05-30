# 137 — Sales Invoice (Direct) capability audit (native vs default)

**Date:** 2026-05-30
**Agent:** Claude (Opus 4.7)
**Status:** Audit (no code yet)
**Parent design:** [native-to-default-forms-migration.md](./native-to-default-forms-migration.md)
**Target voucher type:** `sales_invoice` with persona `direct`
**Why this one first:** highest traffic transactional document in Sales; if defaults can replace SI Direct, every other SI persona (Linked, Service) and most Sales documents follow the same playbook.

## Native surface (today's senior implementation)

### Files

| File | Lines | Purpose |
|---|---|---|
| [SalesInvoicesListPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx) | 200 | List + filter + "New Invoice" entry |
| [SalesInvoiceDetailPage.tsx](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx) | 2,747 | Create / edit / view / post / pay / send / attach — one mega-page handles every SI state |
| [PeriodLockOverrideModal](../../frontend/src/modules/sales/components/PeriodLockOverrideModal.tsx) | — | Reason capture when posting through a soft-locked period |
| [RecordAuditModal](../../frontend/src/modules/sales/components/RecordAuditModal.tsx) | — | Per-record audit log viewer |
| [RecurringInvoicesPage.tsx](../../frontend/src/modules/sales/pages/RecurringInvoicesPage.tsx) | — | Adjacent surface (recurring templates); not part of SI Direct itself but uses the same DTOs |

### Capabilities (inventoried from grep + spot reads)

**List page:**
- Three filters: `status` (DRAFT / POSTED / CANCELLED), `paymentStatus` (UNPAID / PARTIALLY_PAID / PAID), `customer`.
- Six columns: invoice #, customer, date, grand total, payment, status.
- Status pill, payment-state column.
- Click-through to detail; "New Invoice" button.
- Limit: 200 rows, no pagination yet.

**Detail page — lifecycle:**
- Save as draft (`createDraft`).
- Create-and-post atomic (`createAndPostDraft`).
- Post existing draft (`postDraft`) with settlement entry inline.
- Cancel / void (referenced in statuses).
- Period-lock override flow: backend returns `PERIOD_LOCKED` → modal captures reason → re-posts with `periodLockOverrideReason`.
- Credit-check override flow: backend returns credit failure → modal captures reason → re-posts with `creditOverrideReason`; credit-check details surfaced (`creditOverrideInfo`).

**Detail page — accounting controls:**
- Multi-currency: `currency`, `exchangeRate` editable in header.
- Per-line: `taxCodeId`, inclusive/exclusive tax override (`isInclusiveTax: boolean | undefined`), discount per line, calculated totals in doc + base currency.
- Header-level charges (separate from line items) with their own tax handling.
- Settlement at post-time: array of `{ settlementAccountId, amountBase, paymentMethod, reference, notes, paymentDate }` rows captured before posting.
- Payment methods read from `salesSettings.paymentMethodConfigs` (only enabled ones).

**Detail page — integrations / communications:**
- WhatsApp send modal: phone, message, document URL, selected sender account (multiple accounts supported, default account preselected). Uses `buildDefaultOutboundMessage` to template per customer.
- Telegram send modal: chatId, message, document URL, selected sender account.
- Multi-account messaging: filtered by channel + `isActive`, defaults to `isDefault` account.

**Detail page — attachments:**
- Per-invoice file attachments list (`attachments: SalesInvoiceAttachmentDTO[]`).
- Upload, view, delete with busy/optimistic states.

**Detail page — audit & trust:**
- Per-record audit log via `RecordAuditModal` (read of `record_change_logs`).
- Status badges throughout.

**Detail page — references / drill-down:**
- Customer info pulled from `sharedApi.listParties` with role filter.
- Item UOM options resolved lazily per item (`ensureItemUomOptions`).
- Tax codes resolved into a `taxById` map for inclusive/exclusive math.

## Default form surface (today)

### What the seeded `sales_invoice_direct` template carries

From [seedSystemVoucherTypes.ts:357-405](../../backend/src/seeder/seedSystemVoucherTypes.ts):

| Section | Fields |
|---|---|
| Header | `invoiceDate`, `customerId`, `warehouseId`, `currency`, `exchangeRate`, `totalAmount` (read-only calculated), `notes` |
| Lines | `itemId`, `warehouseId`, `invoicedQty`, `uom`, `unitPriceDoc`, `taxCodeId`, `lineTotal` (read-only), `description` |
| Rules | `require_approval` toggle |
| Actions | `print`, `download_pdf` |

### Routes/render path

The default form opens at `/sales/{formId}` — a generic voucher renderer reads the form definition and produces an input surface. Posting goes through the same backend use cases as native (`createSI`, `postSI`).

## Capability matrix (filled in)

Legend: ✅ present, ⚠ partial, ❌ absent

| Capability | Native | Default | Gap → Field Library work |
|---|:-:|:-:|---|
| **List / browse** | ✅ filtered + paged | ❌ | New: default-driven list surface. Bigger than a single component — see "List surface" section below. |
| Status filter (DRAFT/POSTED/CANCELLED) | ✅ | ❌ | Part of list surface |
| Payment-status filter | ✅ | ❌ | Part of list surface |
| Customer filter | ✅ | ❌ | Part of list surface |
| Status / payment column badges | ✅ | n/a | Part of list surface |
| **Create draft** | ✅ | ✅ | — |
| **Edit existing** | ✅ | ✅ | — |
| **Post** | ✅ | ⚠ | Default routes through same backend but lacks the *settlement entry* and *period-lock override* surfaces. New: `post-action-button` + settlement panel. |
| Settlement entry at post time (multi-row) | ✅ | ❌ | New: `settlement-rows-panel` (settlementAccountId, amountBase, paymentMethod, reference, notes, paymentDate; reads paymentMethodConfigs) |
| **Cancel / void** | ✅ | ❌ | New: `lifecycle-action-button` (post / cancel / void with confirm + reason if required) |
| **Period-lock override flow** | ✅ | ❌ | New: `period-lock-override-handler` — wraps post action, catches `PERIOD_LOCKED`, shows reason modal, retries with reason |
| **Credit-check override flow** | ✅ | ❌ | New: `credit-override-handler` — wraps create/post, catches credit failure, shows reason modal, surfaces credit details, retries with reason |
| Multi-currency (currency + exchangeRate) | ✅ | ✅ | — |
| Tax inclusive/exclusive override per line | ✅ | ❌ | Enhancement to existing `line-tax` rendering — add toggle column |
| Header-level charges | ✅ | ❌ | New: `header-charges-panel` (charges array with tax handling) |
| Per-line discount | ✅ | ❌ | Add `discount` column to default template line layout; renderer maps it. |
| Calculated totals (doc + base) | ✅ | ⚠ totalAmount only | Renderer enhancement — show base equivalents per line and per total |
| **WhatsApp send** | ✅ multi-account | ❌ | New: `send-whatsapp-action` — reads messagingAccounts(WHATSAPP), shows account picker + phone/message/url modal, calls `salesApi.sendWhatsApp` |
| **Telegram send** | ✅ multi-account | ❌ | New: `send-telegram-action` — same pattern, channel TELEGRAM |
| Email send | ❌ deferred | ❌ | Out of scope until backend email channel ships |
| **Attachments panel** | ✅ | ❌ | New: `attachments-panel` — list + upload + delete + busy states, uses `SalesInvoiceAttachmentDTO` shape (generalize to `RecordAttachmentDTO`) |
| **Audit log viewer** | ✅ | ❌ | New: `audit-log-action` — opens RecordAuditModal pattern for any voucher record |
| **GL Impact view** | ⚠ scattered | ❌ | New: `gl-impact-panel` — reads PostingLog by sourceId (see [planning/tasks/alpha-readiness-remediation-plan.md](./alpha-readiness-remediation-plan.md) PR2) |
| Customer info side panel | ✅ | ❌ | New: `party-info-panel` — selectable party shows phone/email/credit/AR balance |
| Default outbound message templating | ✅ `buildDefaultOutboundMessage` | n/a | Lives inside `send-whatsapp-action` and `send-telegram-action`; reuse helper |
| Drill-down to related documents (SO/DN) | n/a for Direct persona | n/a | Relevant for Linked persona, not Direct |
| **Recurring invoice link** | ✅ via separate page | n/a | Out of scope for SI Direct itself |
| Permission gating on actions | ✅ via RBAC | ⚠ partial | Each new action component must accept a `permission` prop and call `hasPermission` |

## Component shopping list (prioritized)

Ordered by impact × ease, smallest first within each tier:

### Tier 1 — low effort, completes the create/edit story

1. **Per-line discount column** in default template. Schema is already in the backend DTO; just expose it in the line layout and the renderer's math. ~1 h.
2. **Tax inclusive/exclusive toggle** per line. Adds one column to the line layout; renderer already differentiates if data carries the flag. ~1 h.
3. **Calculated base-equivalent totals** in the renderer. Multiplies line total × exchangeRate, shows alongside doc total. ~1 h.

### Tier 2 — lifecycle (medium effort, unlocks "default can post invoices for real")

4. **`lifecycle-action-button` Field Library component**. Generic: takes `{ action: 'post'|'cancel'|'void', endpoint, requireReason, permission }`. Used by every voucher type. ~3 h.
5. **`settlement-rows-panel` Field Library component**. Specific to invoices: multi-row settlement entry, reads `paymentMethodConfigs` from settings, validates totals. ~4 h.
6. **`period-lock-override-handler`**. Cross-cutting: intercepts post errors of code `PERIOD_LOCKED`, shows reason modal, retries. Shipped as a wrapper around the post action, not a UI component itself. ~2 h.
7. **`credit-override-handler`**. Same pattern as period-lock but for credit-check failures, surfaces credit details. ~2 h.

### Tier 3 — communications (medium effort, big perceived value)

8. **`attachments-panel`** Field Library component. Generic record-attachment UI. Backend exists per [done/119-phase-d6-invoice-attachments.md](../done/119-phase-d6-invoice-attachments.md). Generalize the DTO to `RecordAttachmentDTO`. ~4 h.
9. **`send-whatsapp-action`** Field Library component. Reads messagingAccounts(WHATSAPP), reuses `buildDefaultOutboundMessage`. ~3 h.
10. **`send-telegram-action`** Field Library component. Same pattern. ~2 h.

### Tier 4 — trust & visibility (medium-large effort)

11. **`audit-log-action`** Field Library component. Generic record audit log viewer. ~3 h.
12. **`gl-impact-panel`** Field Library component. Reads PostingLog by sourceId — depends on PR2 (PostingLog entity) landing first. ~5 h **but blocked**.
13. **`party-info-panel`** Field Library component. Side panel showing customer/vendor details + balances. ~4 h.

### Tier 5 — list surface (large architectural piece)

14. **Default-driven list-surface renderer**. Reads a voucher type, queries its records, exposes filter columns declared on the type. Touches routing, listing endpoints, sidebar (the `Forms` group entry needs to point at this renderer instead of native pages). ~2–3 days.

### Tier 6 — header-level charges (specialized)

15. **`header-charges-panel`** Field Library component. Less common but needed for SI Direct parity. ~3 h.

## Parity gate

A given voucher type is "at parity" only when:

- Every native action button has a Field Library component mounted on the default template.
- Every native modal / overlay has a default equivalent (or has been certified as deferred).
- The default-driven list surface exists and exposes the same filters as the native list page.
- Side-by-side QA: create + edit + post + cancel + send + attach + audit + drill-down — match.

Total estimated effort to SI Direct parity: **~35–45 hours** of focused work, plus the list surface (~2–3 days) which unlocks every voucher type at once.

## Open questions

- Should the **list surface** be one shared renderer (parameterized by voucher type) or one renderer per module? One shared, parameterized, is the cleaner answer.
- Should lifecycle actions (`post`, `cancel`, `void`) be one component with action prop, or three components? One with action prop — keeps the contract small.
- Where does `salesApi.sendWhatsApp` belong if we generalize it across modules? Probably move to a generic `messagingApi` keyed by module + voucher type.
- Period-lock and credit overrides are *error-handling wrappers*, not UI components. Where do they attach in the renderer? Around the post action's onClick — leave as composition.

## Next concrete step

If the product owner approves the prioritization, **start with Tier 1** (~3 hours total). Three small wins land in one PR, default template gains feature surface visibly, momentum and confidence build before Tier 2's bigger lifecycle work. Update this audit doc as components ship and capabilities flip from ❌ to ✅.

## Notes on stale worktree changes

Two SI-Direct-adjacent files are dirty from a prior session and left out of the previous commit:

- [seedSystemVoucherTypes.ts](../../backend/src/seeder/seedSystemVoucherTypes.ts) — promotes `warehouseId` to `required: true` on SI Direct header and removes it from line columns. This is a real product decision (per-invoice default warehouse instead of per-line warehouse) and should be reviewed as part of the Tier 1 changes since it touches the same template.
- [VoucherTemplateEditorPage.tsx](../../frontend/src/pages/super-admin/pages/VoucherTemplateEditorPage.tsx) — 74-line change to the super-admin template editor. Likely related to the same SI Direct refinement work.

Recommend folding these into the Tier 1 commit so the SI Direct surface lands as one coherent slice.
