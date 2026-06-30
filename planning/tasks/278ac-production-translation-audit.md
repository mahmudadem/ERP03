# 278ac — Production Translation Audit

**Goal:** Scan and fix production UI translations one module at a time, one page at a time.

**Worktree:** `D:\DEV2026\ERP03-unified` production lane.

**Rule:** A page is not complete until visible labels, input placeholders, helper text, empty states, table/report columns, toasts, API-facing errors, warnings, dialogs, confirmations, loading states, and shared component text used by the page have been checked.

**Default-data rule:** Stable codes stay stable. Display names for system defaults must resolve through translation-aware display resolvers. Tenant custom names remain unchanged.

## Module Order

| Order | Module | Status | Notes |
|---:|---|---|---|
| 1 | Purchases | In progress | Start here because production QA is active in Purchases. |
| 2 | Sales | Pending | Shares many document/report patterns with Purchases. |
| 3 | Inventory | Pending | UOM/default item/warehouse selectors and reports. |
| 4 | Accounting | Pending | Largest surface; includes COA/voucher names/JV/PV/RV. |
| 5 | POS | Pending | Terminal, reports, manager override dialogs. |
| 6 | Settings/RBAC | Pending | Policies, roles, tax codes, appearance, notifications. |
| 7 | Super Admin | Pending | Platform setup, bundles, modules, plans, AI admin. |
| 8 | Shell/Common/Onboarding/Profile | Pending | Navigation, global errors, setup, company selection. |
| 9 | AI Assistant and placeholder modules | Pending | AI module plus visible HR/CRM/manufacturing/projects placeholders. |

## Purchases Page Audit

| Page/Route | File | Status | Scope Checked | Notes |
|---|---|---|---|---|
| `/purchases` | `frontend/src/modules/purchases/pages/PurchaseHomePage.tsx` | Fixed, verify pending | labels, cards, errors, warnings, loading | Dashboard KPIs, recent activity headings/actions, create buttons, and load error localized. |
| `/purchases/vendors` | `frontend/src/modules/purchases/pages/VendorsListPage.tsx` | Partially fixed | list labels, filters, actions, messages | Window titles translated; shared Party surfaces still need full recheck. |
| `/purchases/vendors/:id` | `frontend/src/modules/purchases/pages/VendorDetailPage.tsx` | Not checked | form labels, tabs, errors, placeholders | |
| `/purchases/items` | `frontend/src/modules/inventory/pages/ItemsListPage.tsx` | Not checked | purchase doorway to shared catalog | item/UOM display names included |
| `/purchases/items/:id` | `frontend/src/modules/inventory/pages/ItemDetailPage.tsx` | Not checked | shared item detail | item/UOM display names included |
| `/purchases/vendor-groups` | `frontend/src/modules/purchases/pages/VendorGroupsPage.tsx` | Not checked | list/form/messages | |
| `/purchases/price-lists` | `frontend/src/modules/purchases/pages/PurchasePriceListsPage.tsx` | Not checked | list/form/messages/placeholders | |
| `/purchases/orders` | `frontend/src/modules/purchases/pages/PurchaseOrdersListPage.tsx` | Fixed, verify pending | list/actions/messages | Load error, filters, status labels, row actions localized. |
| `/purchases/orders/:id` | `frontend/src/modules/purchases/pages/PurchaseOrderDetailPage.tsx` | Locale recheck in progress | document UI, dialogs, toasts, warnings | Existing key wiring reviewed; Turkish PO/pricing/common labels cleaned. |
| `/purchases/goods-receipts` | `frontend/src/modules/purchases/pages/GoodsReceiptsListPage.tsx` | Fixed, verify pending | list/actions/messages | Load error and filter/list labels use Purchases locale keys. |
| `/purchases/goods-receipts/new` + `/:id` | `frontend/src/modules/purchases/pages/GoodsReceiptDetailPage.tsx` | Fixed, verify pending | document UI, dialogs, toasts, warnings | Validation, source-load errors, rail, headers, footer buttons, linked-PI tooltip, and unpost dialog localized. |
| `/purchases/invoices` | `frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx` | Fixed, verify pending | list/actions/messages | Load error and list/filter labels localized. |
| `/purchases/invoices/new` + `/:id` | `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx` | Locale recheck in progress | document UI, dialogs, toasts, warnings, print labels | Turkish PI rail/header/print/pricing labels cleaned; component-level page pass still pending. |
| `/purchases/returns` | `frontend/src/modules/purchases/pages/PurchaseReturnsListPage.tsx` | Fixed, verify pending | list/actions/messages | Load error, empty state, status/context filters localized. |
| `/purchases/returns/new` + `/:id` | `frontend/src/modules/purchases/pages/PurchaseReturnDetailPage.tsx` | Fixed, verify pending | document UI, dialogs, toasts, warnings | Source-picker errors, validation, line columns, rail, footer buttons, help text, and unpost dialog localized. |
| `/purchases/reports/vendor-statement` | `frontend/src/modules/purchases/pages/VendorStatementPage.tsx` | Previously fixed, recheck pending | report filters, columns, export labels | |
| `/purchases/reports/ap-aging` | `frontend/src/modules/purchases/pages/ApAgingReportPage.tsx` | Fixed, verify pending | report filters, columns, messages | Report load fallback localized. |
| `/purchases/reports/purchases-analytics` | `frontend/src/modules/purchases/pages/PurchasesAnalyticsPage.tsx` | Previously fixed, recheck pending | report filters, columns, messages | |
| `/purchases/settings` | `frontend/src/modules/purchases/pages/PurchaseSettingsPage.tsx` | Partially fixed | settings labels, account selectors, toasts | AP sub-account backfill toasts localized; Turkish settings terminology cleaned; full page recheck still pending. |
| `/purchases/tools/voucher-designer` | `frontend/src/modules/purchases/pages/PurchaseVoucherDesignerPage.tsx` | Not checked | form designer shell, default voucher/form names | |
| Dynamic purchase forms | `frontend/src/modules/tools/pages/DynamicDocumentPage.tsx` | Not checked | runtime designed forms, errors, actions | system default form names included |
| Purchase financial integration wizard | `frontend/src/modules/purchases/wizards/PurchaseFinancialIntegrationWizard.tsx` | Fixed, verify pending | setup validation, accounting default placeholders, errors | AP/GRNI required errors and configure failure localized. |

## Verification Log

| Date | Command | Result |
|---|---|---|
| 2026-06-30 | Arabic Purchases locale pure-English value scan | Passed: 0 pure-English Arabic values. |
| 2026-06-30 | Purchases page hardcoded-message scan | Passed for fixed batch; remaining hits are translated status constants or pending pages. |
| 2026-06-30 | `npm run typecheck` | Passed. |
| 2026-06-30 | `npm run build` | Passed locally and on Vercel production. |
| 2026-06-30 | Vercel production deploy | Passed: `dpl_HF2KVf649ytNueED8t9iBy8pzg4z`, aliased to `https://erp-03.vercel.app`. |
| 2026-06-30 | Live static probe | Passed: `https://erp-03.vercel.app/` returned HTTP 200. |
| 2026-06-30 | Turkish Purchases locale JSON + targeted English-leak scan | Passed for the high-confidence Purchases continuation slice; remaining scan hits are mostly key names, abbreviations, or pages still queued for manual review. |
| 2026-06-30 | `npm run check:i18n-config` | Passed. |
| 2026-06-30 | `npm run typecheck` | Passed. |
| 2026-06-30 | `npm run build` | Passed locally; existing browser-data/chunk-size warnings remain. |
