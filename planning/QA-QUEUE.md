# ERP03 — QA Queue

> Items in this list are **built and ready for Mahmud to manually test**.
> Agents add items here when a feature is complete.
> Mahmud checks them off after testing and marks Pass ✅ or Fail ❌ (with notes).

> **🚫 SYCO tenant is closed (2026-06-05).** Do not run QA against SYCO — its COA / item cost basis / posting data are corrupt and we will not clean them. All QA runs use a **fresh template-seeded tenant**. See [121 — Phase C QA Results](./done/121-phase-c-qa-results.md) for the closure note.

---

## 🧪 Ready to Test

### Sales/Purchases - Document Template True Adoption (Phases 1-3)
**Added by:** Claude (report 202)
**What to test:**
- Open `Purchases -> Invoices -> New Bill` (the pilot page).
  - Expected body order: source control strip, compact header card, line table, allocation grid placeholder, attachments/audit cards, settlement block, sticky footer.
  - Expected rail order: Info, Posting Readiness, Settlement, Totals.
  - With the side rail visible, the footer left side shows a short status text; hide the rail with its round button and the footer switches to the boxed Subtotal/Tax/Grand totals strip (same behavior as Sales Invoice).
  - Confirm the Vendor dropdown is not clipped by the header card edge.
- Open a posted Purchase Invoice and confirm the same anatomy read-only, with Outstanding in the footer strip when the rail is hidden.
- Check the footer totals strip on SO, DN, SR, PO, GRN, and PR: it now renders as one bordered box with small uppercase labels and mono values, visually matching the Sales Invoice footer.
- Open Sales Order: confirm the credit-override dialog still opens and works when confirming an order over the customer's credit limit.
- Open a posted/saved Goods Receipt: it now uses the shared document template (topbar with back button and status pill, Info/Totals side rail, sticky footer with actions). Confirm Post/Unpost/Create Return actions still work, including the Unpost confirmation dialog.
- Open a Purchase Return saved view: header grid, lines, totals summary, rail Info -> Document Status -> Totals; Unpost dialog still works.
- On every document: hide the rail, restore it from the edge button, shrink the window below ~1280px and confirm the rail becomes an edge drawer. Repeat a sample in Arabic/RTL (drawer mirrors to the left).
- On a very wide (2xl) screen, rail cards should fill the column height in the Sales Invoice rhythm instead of compressing into the top quarter.
- **Rail interiors (added same day):** on SO, PO, DN, SR, GRN, and PR, each rail Totals card now looks like the Sales Invoice Totals card — light label/value rows ending in the dark Grand Total box with the green number — and status/source cards use the same key-value row style. Sections that do not apply to a document (e.g. Settlement on Sales Order) stay hidden by design.
- Full QA script: [done/202-document-scaffold-true-template-adoption-phases-1-3.md](./done/202-document-scaffold-true-template-adoption-phases-1-3.md).

**Known limitations:**
- UI/layout only; no posting, tax, settlement, AP/AR, inventory, approval, period-lock, audit, or ledger behavior changed.
- Sales Invoice itself is rebuilt onto the template in Phase 4, after the settlement QA (report 194) passes. Quotation intentionally stays page-local.

---

### Sales/Purchases - Shared Line Table Auto-Append Regression Fix
**Added by:** Codex (report 201)
**What to test:**
- Open `Sales -> Delivery Notes -> New Delivery Note` in Direct mode.
- Expected: the line table shows a stable working grid and does not keep adding rows by itself.
- Open `Sales -> Returns -> New Return`, select `Direct Return`.
- Expected: the form opens without an infinite error/render loop, and the direct return line table stays stable.
- Repeat the same stability check on Sales Orders, Quotations, Purchase Orders, Goods Receipts, Purchase Invoices, and Purchase Returns.
- Right-click a row in DN or SR direct lines, choose a row color swatch, reload, and confirm the local row color persists for that table.
- Right-click the row again and clear the row color.
- Confirm the context menu shadow is subtle and does not look like a heavy floating card.

**Known limitations:**
- This is UI/local-preference behavior only. It does not change document totals, Delivery Note stock movement, Goods Receipt receipt behavior, Sales Return/Purchase Return posting, tax, AR/AP, refund/credit-note settlement, inventory valuation, approval, period locks, audit, backend DTOs, or ledger behavior.

---

### Sales/Purchases - Native Document Shared Table And Action Tray
**Added by:** Codex (report 200)
**What to test:**
- Open SI, PI, SO, DN, SR, Quotation, PO, GRN, and PR create/edit/view screens.
- Confirm the top icon cluster appears as one compact document action tray.
- In editable line grids, right-click a row and confirm Copy, Paste, Insert row, Highlight, and Delete actions appear.
- Confirm Delete/Insert are disabled or absent where linked-source rows should not be structurally edited.
- Click or right-click the empty `#` header cell and confirm Copy, Paste, Clean, Export, Import, and UI selector actions appear.
- Resize several columns, reload the page, and confirm widths persist for that document table only.
- Open the UI selector, change classic/web layout, row coloring, text size, and number font; reload and confirm preferences persist.
- Confirm empty cells do not show placeholder text and selectors visually blend into table cells.
- Repeat representative tests in Windows mode with a resized window.

**Known limitations:**
- This is UI/data-entry parity only. It does not change posting, tax, AP/AR, settlement, inventory valuation, COGS, approval, period locks, audit, backend DTOs, or repository behavior.
- Allocation grid behavior remains placeholder/display-only until the controlled allocation contract is implemented.

---

### Sales - Sales Return Source Control Parity
**Added by:** Codex (report 199)
**What to test:**
- Open `Sales -> Returns -> New Return`.
- Confirm the top **Return Control** strip shows `After Invoice`, `Before Invoice`, and `Direct Return`.
- Select `After Invoice`; expected header field is posted Sales Invoice.
- Select `Before Invoice`; expected header field is posted Delivery Note.
- Select `Direct Return`; expected header field is Customer.
- Confirm the create-draft validation still requires the correct source/customer for the selected mode.
- Repeat in Windows mode with a resized window.

**Known limitations:**
- This is UI/data-entry layout only. It does not change Sales Return posting, tax, AR reversal, credit-note/refund settlement, inventory receipt, COGS reversal, approval, period locks, audit, or ledger behavior.

---

### Sales/Purchases - Native Document Header Density
**Added by:** Codex (report 198)
**What to test:**
- Open SI, PI, SO, DN, Quote, PO, GRN, SR, and PR create/edit/view screens.
- Confirm the main header inputs use compact Sales Invoice sizing.
- Confirm the header fits into the two-row/five-column rhythm on wide layouts.
- Confirm Notes/Reason text areas sit below the compact header instead of stretching the header rows.
- Repeat in Windows mode with resized windows and with long customer/vendor names.

**Known limitations:**
- This is layout-only. It does not change posting, tax, inventory valuation, settlement, approval, period locks, AP/AR, audit, or ledger behavior.
- Some return/source flows still need a deeper business UX pass, especially raw source-ID entry in Purchase Return. This task only standardized density.

---

### Sales/Purchases - Sectioned Document Scaffold Contract
**Added by:** Codex (report 197)
**What to test:**
- Open Sales Invoice, Purchase Invoice, Sales Order, Delivery Note, Sales Return, Purchase Order, Goods Receipt, Purchase Return, and Quotation pages.
- Confirm the document anatomy stays consistent: controls/header at the top, line table in the main work area, secondary panels where applicable, right rail where applicable, and sticky footer actions where applicable.
- Confirm sections can be absent without changing the whole page shell. Example: invoices can show settlement/totals while Delivery Note and Goods Receipt omit settlement.
- Repeat representative pages in Classic and Windows mode, including narrow/resized windows.
- Switch to Arabic/RTL and confirm rail edge buttons, drawers, and back direction still mirror correctly.

**Known limitations:**
- This is layout architecture only. It does not change posting, tax, settlement, inventory valuation, approval, period locks, AP/AR, audit, or ledger behavior.
- Existing scaffold consumers are normalized through compatibility `custom` slots; the next visual cleanup pass should split all page bodies into direct `control`, `header`, `lines`, `secondary`, and `attachments` props.

---

### Sales/Purchases - Native Document Scaffold And List Parity
**Added by:** Codex (report 196)
**What to test:**
- Open Sales -> Quotations.
  - Expected: list uses the shared operational list layout with quick status pills, inline filters, centered columns, row actions, and pagination.
  - Open or create a quote.
  - Expected: line items use the same shared table style as invoices/orders; quote lifecycle buttons still appear in the quote header.
- Open Sales Order, Delivery Note, and Sales Return create/edit/view pages.
  - Expected: line tables match the Sales Invoice/Purchase Invoice table style while columns remain document-specific.
  - Expected: existing save/post/confirm/deliver/return actions still work from the same document status rules.
- Open Purchases -> Goods Receipts.
  - Expected: list uses the shared operational list layout.
  - Open or create a GRN.
  - Expected: draft/edit page uses the shared document shell with right rail, sticky footer, shared line table, item selector, and warehouse selector.
- Open Purchases -> Returns.
  - Expected: list uses the shared operational list layout.
  - Open a Purchase Return.
  - Expected: saved/edit view uses the shared document shell with right rail, sticky footer, and shared line table.
- Repeat representative pages in Classic and Windows mode.

**Known limitations:**
- This is UI/data-entry consistency only. It does not change posting, tax, inventory valuation, settlement, approval, period locks, AP/AR, or ledger behavior.
- Quotation detail outer header is still page-local; only its list and line table were standardized in this slice.
- Purchase Return create mode keeps its source-picking card flow; its return line table is standardized.

---

### Sales/Purchases - Document UI Parity
**Added by:** Codex (report 191)
**What to test:**
- Open Sales -> Returns.
  - Expected: list uses the same layout style as Sales Invoices, with quick status pills, search, customer/context/status/date filters, row actions, company date formatting, centered cells, and pagination.
- Open Sales Order, Delivery Note, and Sales Return detail pages.
  - Expected: pages use the shared Sales Invoice-style document scaffold: compact topbar, document icon/status pills, full-height scroll workspace, responsive right rail, and persistent footer.
  - Expected: the right rail shows SO totals/status, DN delivery quantity/cost/source, and SR return totals/settlement/source context.
  - Expected: footer actions stay visible while scrolling and the rail can be hidden/restored or opened from the edge on smaller windows.
- Open Purchases -> Purchase Orders detail.
  - Expected: page uses the shared Sales Invoice-style document scaffold with right rail and footer actions visible with subtotal/tax/grand total.
- Open Purchases -> Invoices -> New.
  - Expected: page uses the shared Sales Invoice-style document scaffold with persistent footer.
  - Expected: inside the page, PI follows the Sales Invoice anatomy: source controls, compact source-aware header, line table, allocation grid placeholder, attachments/audit shortcuts, and right rail cards ordered Info -> Posting Readiness -> Settlement -> Totals.
  - Expected: the Vendor picker is vendor-only, not a generic customer/vendor selector.
  - Expected: PO Reference is a dropdown of real purchase orders, not a typed ID field.
  - Expected: selecting a PO loads open lines and pre-fills vendor/currency data.
- Open a posted Purchase Invoice.
  - Expected: page uses the shared Sales Invoice-style document scaffold and the same PI internal anatomy as the new/edit screen, with read-only header fields, line table, allocation grid placeholder, attachments/audit shortcuts, and Info/Document Status/Settlement/Totals rail.
  - Expected: sticky footer shows subtotal/tax/grand total/outstanding and keeps payment/return/unpost actions reachable.

**Known limitations:**
- This is UI/data-entry parity only. It does not change posting, tax, settlement, AP/AR, inventory valuation, approval, period-lock, COGS, or ledger behavior.
- Visual QA should be repeated in both Classic and Windows mode to confirm sticky footers do not cover important fields in small windows.
- SO, DN, SR, and PO still need a follow-up internal-anatomy audit against Sales Invoice; this QA item now specifically expects PI to match the SI body/rail structure.
- Browser screenshot QA was not completed because the in-app Browser navigation/screenshot tool was not exposed in this session.

---

### Sales - Invoices List Filter Polish
**Added by:** Codex (report 190)
**What to test:**
- Open Sales -> Invoices.
- Confirm Type, Status, and Payment filters show placeholder-style neutral text.
- Confirm the date range defaults from fiscal-year beginning through today and displays in the company date format.
- Confirm table cell content is centered.
- Confirm Pending Approval stays on one line in both the quick status pills and the Status column.

---

### Sales - Invoice Responsive Window Layout
**Added by:** Codex (report 187)
**What to test:**
- Sign in with an active company.
- Open `/#/sales/invoices/new` in normal web mode.
  - Expected: the Sales Invoice header, line items, allocation grid, attachments/audit shortcuts, right-side information panels, settlement, totals, and footer actions are reachable.
  - Expected on a wide screen: the side rail is pinned by default, can be hidden, and can be restored from the small edge button.
- Switch to Windows mode and open a Sales Invoice window from the Sales Invoices list.
- Resize the invoice window smaller than its default `1100x750` size.
  - Expected: page content scrolls vertically inside the available window area instead of hiding sections.
  - Expected: the side rail does not push over invoice fields; it opens from the edge button as a drawer.
  - Expected: wide line-item/allocation tables scroll horizontally inside their table area.
  - Expected: footer actions such as Close/Save/Post remain reachable.

**Known limitations:**
- This is a layout-only fix. It does not change posting, taxes, totals, settlement, approval, period-lock, inventory, or ledger behavior.
- Automated visual screenshot QA was not completed because the in-app Browser tool was unavailable and Playwright is not installed.

---

### Navigation - Apex Route Coverage Gap Audit
**Added by:** Codex (report 179)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger`.
- Open these Accounting/Tools routes directly or through sidebar/actions where available:
  - `/#/dev/apex-ledger/accounting/setup`
  - `/#/dev/apex-ledger/accounting/recurring-vouchers`
  - `/#/dev/apex-ledger/accounting/cost-centers`
  - `/#/dev/apex-ledger/vouchers/<voucherId>`
  - `/#/dev/apex-ledger/vouchers/<voucherId>/view`
  - `/#/dev/apex-ledger/vouchers/demo`
  - `/#/dev/apex-ledger/accounting/tools/forms`
  - `/#/dev/apex-ledger/accounting/tools/budgets`
  - `/#/dev/apex-ledger/accounting/tools/subgroup-tagging`
  - `/#/dev/apex-ledger/tools/forms`
- Specifically click these Apex sidebar entries that previously had stale URLs:
  - Sales Analytics -> `/#/dev/apex-ledger/sales/reports/sales-analytics`
  - Aged Backlog -> `/#/dev/apex-ledger/sales/aged-backlog`
  - Sales Voucher Designer -> `/#/dev/apex-ledger/sales/tools/voucher-designer`
  - Purchases Analytics -> `/#/dev/apex-ledger/purchases/reports/purchases-analytics`
  - Purchases Voucher Designer -> `/#/dev/apex-ledger/purchases/tools/voucher-designer`
  - Low Stock Alerts -> `/#/dev/apex-ledger/inventory/alerts/low-stock`
  - Unsettled Costs -> `/#/dev/apex-ledger/inventory/reports/unsettled-costs`
  - Inventory Valuation -> `/#/dev/apex-ledger/inventory/reports/valuation`
- Open representative remaining route groups directly where your role has access:
  - `/#/dev/apex-ledger/companies`
  - `/#/dev/apex-ledger/notifications`
  - `/#/dev/apex-ledger/companyAdmin/setup`
  - `/#/dev/apex-ledger/hr/employees`
  - `/#/dev/apex-ledger/pos`
  - `/#/dev/apex-ledger/super-admin`
  - `/#/dev/apex-ledger/company-wizard`
  - `/#/dev/apex-ledger/crm/leads`
  - `/#/dev/apex-ledger/manufacturing/work-orders`
  - `/#/dev/apex-ledger/projects`
  - `/#/dev/apex-ledger/canvas-dev`
- Expected: each page renders inside Apex with the Apex sidebar and topbar still visible.
- Expected: protected pages keep the same permission/module behavior as the main shell.

**Known limitations:**
- This verifies route continuity only. Some pages still use their native/basic visual design inside Apex.
- Super Admin routes now stay inside Apex, but platform-role QA is still required before default-shell cutover.

---

### Navigation - Apex Settings/RBAC/AI Native Page Mounting
**Added by:** Codex (report 178)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger/settings`.
- Click Settings/RBAC links for General Settings, Appearance, Topbar Widgets, Sidebar/Menu Config, Approval Workflow, Roles, Edit Role, and Assign Users.
  - Expected: concrete Settings/RBAC pages render inside Apex, with the Apex sidebar and topbar still visible.
  - Expected: Company Settings footer pages still use the Company Settings footer routes and stay inside Apex.
- From a Settings/RBAC page inside Apex, use internal navigation such as edit role, back to list, or settings hub links.
  - Expected: the URL stays under `/#/dev/apex-ledger/settings/...`, not `/#/settings/...`.
- Open `/#/dev/apex-ledger/ai`.
- Click AI links for AI Home, AI Settings, AI Usage, AI Proposals, Proposal Detail, and AI Setup where available to the signed-in role.
  - Expected: concrete AI pages render inside Apex, with the Apex sidebar and topbar still visible.
- From an AI page inside Apex, use internal AI navigation.
  - Expected: the URL stays under `/#/dev/apex-ledger/ai/...`, not `/#/ai-assistant/...`.
- Test restricted roles, disabled AI module, and non-super-admin users.
  - Expected: protected Settings/RBAC/AI pages remain blocked exactly as they are in the main shell.

**Known limitations:**
- This mounts the existing native pages inside Apex. It does not yet redesign those native pages with Apex view styling.
- Full Apex cutover still needs feature flag integration and authenticated cross-role QA.

---

### Navigation - Apex Purchases And Inventory Native Page Mounting
**Added by:** Codex (report 177)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger/purchases`.
- Click Purchases sidebar links for Vendors, Vendor Groups, Price Lists, Purchase Orders, Goods Receipts, Purchase Invoices, Purchase Returns, Vendor Statement, AP Aging, Purchases Analytics, and Purchase Settings.
  - Expected: concrete Purchases subpages render the native production Purchases pages inside the Apex shell, with the Apex sidebar and topbar still visible.
- Open `/#/dev/apex-ledger/purchases/invoices/new`.
  - Expected: the real Purchase Invoice detail page opens inside Apex.
- From a Purchases page inside Apex, use open row, create new, back to list, or linked-document actions.
  - Expected: the URL stays under `/#/dev/apex-ledger/purchases/...`, not `/#/purchases/...`.
- Open `/#/dev/apex-ledger/inventory`.
- Click Inventory sidebar links for Items, Categories, Warehouses, Stock Levels, Stock Movements, Stock Adjustments, Stock Transfers, Opening Stock, Low Stock Alerts, Inventory Valuation, UOM Master, and Inventory Settings.
  - Expected: concrete Inventory subpages render the native production Inventory pages inside the Apex shell, with the Apex sidebar and topbar still visible.
- From an Inventory page inside Apex, use open row, create new, back to list, or linked-record actions.
  - Expected: the URL stays under `/#/dev/apex-ledger/inventory/...`, not `/#/inventory/...`.
- Test restricted roles and disabled modules.
  - Expected: protected Purchases and Inventory pages remain blocked exactly as they are in the main shell.

**Known limitations:**
- This mounts the existing native pages inside Apex. It does not yet redesign those native pages with Apex view styling.
- Settings/RBAC and AI native page mounting remain pending.

---

### Navigation - Apex Prototype Typography Restoration
**Added by:** Codex (report 176)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger`.
- Compare the sidebar, topbar badges, module labels, and small counters against the downloaded Apex prototype.
  - Expected: normal UI text uses the same Inter feel as the prototype, and small metadata/counters use the sharper JetBrains Mono style.
- Compare against the old mismatch.
  - Expected: Apex no longer looks like the same Tailwind classes rendered at the main shell's smaller 90% typography scale.
- Leave Apex and return to a normal tenant route.
  - Expected: the main shell keeps its normal compact dashboard typography.

**Known limitations:**
- This is a visual typography fix only. It does not change permissions, posting, settings behavior, routing contracts, or data.

---

### Navigation — Apex Shell RTL Flyout & Contrast Preset Hardening
**Added by:** Antigravity (report 175)
**What to test:**
- Sign in with an active company and open the Appearance Settings page (`/#/settings/appearance` or `/#/dev/apex-ledger/settings/appearance`).
- In the **Curated Presets** section, select **Ocean Breeze** (which has Sidebar Surface set to `Contrast (Brand colored)`).
- Observe the sidebar:
  - Expected: Inactive sidebar item icons are clearly visible inside subtle translucent white pills (`bg-white/10` background layer over the bright blue, rather than solid white/light-blue).
  - Expected: The active sidebar item stands out as a clear translucent white row background (`bg-white/20`) rather than matching the bright blue background color.
  - Expected: Category section hover states and row hovers are subtle semi-transparent overlays (`hover:bg-white/10`) rather than solid bright blue/light-blue page background fills.
- Switch the sidebar layout to **Flyout (Hover menus)**.
- Switch the language to Arabic (`AR`).
  - Expected: Hovering over any sidebar item spawns the flyout submenu to the **left** of the sidebar.
  - Expected: The submenu does **not** overlap the icons or text labels inside the sidebar.
  - Expected: The background of the spawned flyout submenu matches the sidebar's bright blue background (`bg-[var(--app-sidebar-surface)]`) instead of hardcoded white, and the white item text inside it is perfectly readable.
- Switch the language back to `EN` (English).
  - Expected: Hovering over the same sidebar items spawns the flyout submenus to the **right** of the sidebar.

**Known limitations:**
- This layout logic handles fixed-portal menu positioning and Contrast preset overlays; it does not change sub-route navigation rules.

---

### Navigation - Apex Company Settings Sidebar Parity
**Added by:** Codex (report 174)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger`.
- Look at the bottom of the Apex sidebar.
  - Expected: it shows **Company Settings**, matching the main sidebar, not the Apex user/profile card.
- Expand Company Settings and click Overview, Users, Roles, Modules, Features, Bundles, Currencies, Tax Codes, Notifications, Communications, and General Settings.
  - Expected: each page renders inside Apex and the URL remains under `/#/dev/apex-ledger/...`.
- Repeat with Arabic selected.
  - Expected: the Company Settings footer and submenu keep correct RTL alignment.

**Known limitations:**
- This only mounts the Company Settings footer pages. Broader Settings/RBAC/AI native page mounting remains part of Task 167 Slice 3C-Remaining.

---

### Navigation - Apex Prototype Scale Restoration
**Added by:** Codex (report 173)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger`.
- Confirm the Apex sidebar fills the full browser height from top to bottom.
- Confirm the logo/header area and bottom user profile area remain inside the sidebar while the menu list scrolls in the middle.
- Compare the overall shell size against the downloaded Apex prototype.
  - Expected: the shell should feel like the prototype scale, close to the previous app at about 110% browser zoom, without actually requiring browser zoom.
- Switch the language selector from English to Arabic.
  - Expected: the larger shell scale remains stable in RTL, with no sidebar clipping or broken active indicators.
- Open a Sales native subpage such as `/#/dev/apex-ledger/sales/invoices`.
  - Expected: Apex chrome keeps the larger prototype scale while the native page content scrolls inside the workspace.

**Known limitations:**
- This is a visual shell-scale fix only. It does not change posting, approvals, taxes, balances, inventory, permissions, or page routing contracts.

---

### Navigation — Apex Sales Native Page Mounting Slice 3C
**Added by:** Codex (report 171)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger/sales`.
- Click Sales sidebar links for Customers, Products & Services, Quotations, Sales Orders, Delivery Notes, Sales Invoices, Sales Returns, Customer Statement, Sales Analytics, Aged Backlog, Recurring Invoices, and Sales Settings.
  - Expected: concrete Sales subpages render the native production Sales pages inside the Apex shell, with the Apex sidebar and topbar still visible.
- Open `/#/dev/apex-ledger/sales/invoices/new`.
  - Expected: the real Sales Invoice detail page opens inside Apex.
- From a Sales list page inside Apex, open a row and then use the page's back/list/new/open-linked-document actions.
  - Expected: the URL stays under `/#/dev/apex-ledger/sales/...`, not `/#/sales/...`.
- Test a company in direct-invoicing mode.
  - Expected: operational workflow pages such as Sales Orders and Delivery Notes are still hidden/blocked according to the same rules as the main shell.
- Test a restricted role.
  - Expected: protected Sales pages remain blocked if the role lacks the same access in the main shell.

**Known limitations:**
- This slice covers Sales only. Purchases, Inventory, Settings/RBAC, and AI native page mounting are still pending.

---

### Navigation — Apex Route/Sidebar Adapter Slice 3B
**Added by:** Codex (report 170)
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger`.
- Compare the Apex sidebar modules and child links against the normal tenant sidebar for the same user/company.
  - Expected: modules, visible child links, and dynamic/default form groups follow the same permission and workflow rules.
- In a Sales company configured for direct invoicing only, confirm operational full-workflow links such as Sales Orders and Delivery Notes are hidden in Apex when hidden in the main shell.
- In a restricted role, confirm protected Accounting reports/settings links are hidden in Apex if they are hidden in the main shell.
- If cloned Sales or Purchase forms exist, confirm they appear in Apex in the same grouping policy as the main sidebar.
- Click Accounting tool links such as Forms Management, Budgets, and Subgroup Tagging.
  - Expected: they stay inside `/dev/apex-ledger/...` and render the Apex tool surface rather than falling to a generic placeholder.

**Known limitations:**
- This slice fixes sidebar/route mapping only. Sales, Purchases, Inventory, Settings/RBAC, and AI child pages may still render Apex workbench pages until Slice 3C mounts the native production pages.

---

### Navigation — Apex Shell Production Candidate Slice 2
**Added by:** Antigravity (report 168), Codex topbar hotfix
**What to test:**
- Sign in with an active company and open `/#/dev/apex-ledger` directly.
- Confirm the top header shows the active company, fiscal year, base currency, UI mode, and current user initial.
- In the topbar language selector, switch from `EN` to `AR`.
  - Expected: Arabic becomes active immediately, the app direction changes to RTL, and the Apex shell remains visually stable.
- Click the topbar Settings icon.
  - Expected: `/dev/apex-ledger/settings/appearance` opens directly *inside* the Apex layout.
- Click the topbar avatar/user initial.
  - Expected: `/dev/apex-ledger/profile` opens directly *inside* the Apex layout.
- Verify user profile/avatar details navigation: click the avatar button at the bottom-left of the sidebar.
  - Expected: The Appearance settings page opens directly *inside* the Apex layout, preserving shell/sidebar continuity.
- Verify Accounting Settings navigation: click the Settings button at the top header or in the sidebar. Select any setting card or click "Open Full Page".
  - Expected: The detailed settings tabs render directly *inside* the Apex layout.
- Test wildcard sub-module paths: type or navigate to an unmapped path (e.g. `/#/dev/apex-ledger/crm/leads` or `/#/dev/apex-ledger/hr/employees`).
  - Expected: The page renders the clean "Module Coming Soon" card inside the Apex shell, instead of redirecting you to the legacy dashboard.
- Switch to Arabic/RTL and confirm shell elements and sidebars align properly.

**Known limitations:**
- Apex is still a candidate route and is hidden from normal static navigation.
- Cutover as the main tenant shell requires Slice 3 (putting Apex behind a feature flag).

---

### Accounting — Stage 2b Posting-Authority Decoupling & Reactive Approvals
**Added by:** Antigravity (report 155)
**What to test:**
- Note: This is a backend-only structural change that decouples the posting use cases from local module settings. The user-facing behavior remains functionally identical to before but is now driven by central accounting policies.
- Ensure central approval policies are active (configured in Accounting settings).
- Create a new Sales Invoice and click **Post**.
- Expected: The invoice status changes to **Pending Approval** (amber badge) with no stock or ledger impact.
- Repeat the same for a Purchase Invoice and confirm it also transitions to **Pending Approval**.
- Log in as an authorized approver, open the document, and click **Approve & Post**.
- Expected: The status transitions to **Posted** and the ledger entries and stock levels are finalized.


### AI Assistant — Floating Launcher Toggle
**Added by:** Codex (report 153)
**What to test:**
- Open `AI Assistant -> Settings -> Provider`.
- Confirm the new **Show Floating AI Launcher** switch appears below **Enable AI Assistant**.
- Turn it off and save.
- Navigate to a normal ERP page such as `Settings` or an invoice list.
- Expected: the floating AI shortcut is hidden.
- Open AI Assistant from the normal menu and confirm chat is still accessible if the user has permission.
- Return to AI Settings, turn **Show Floating AI Launcher** on, save, and navigate back to a normal ERP page.
- Expected: the floating launcher appears again with the AI brain/sparkles icon.
- Confirm that disabling **Enable AI Assistant** still blocks chat separately from the launcher toggle.

**Known limitations:**
- This toggle only controls the global floating shortcut. It does not change provider configuration, model certification, permissions, posting, ledger behavior, reports, or AI chat safety rules.

---

### Sales — Native-detail contract: Quotation + editable Delivery Note / Sales Return
**Added by:** Claude (Opus 4.8) — Task 148, commits `5d8d3f17`, `06256cda`
**What to test:**
- **Quotation** (`Sales -> Quotations -> open/new`): status chip is always shown and
  color-coded; Customer/Item/Currency use the shared selectors (not plain dropdowns);
  a new quote defaults its currency to the company base currency; a DRAFT quote shows a
  red **Discard** button that confirms then deletes; action buttons use one
  primary/neutral/danger palette. Switch to Arabic/Turkish — labels translate.
- **Delivery Note** (`Sales -> Delivery Notes -> open a DRAFT`): an **Edit** button appears
  next to Post. Click it → the create-style form reopens populated with the note; the
  Sales Order field is locked. Change the delivery date / a line qty (for standalone DNs)
  / notes → **Save Changes** persists and returns to the view; **Cancel** discards.
  Confirm a POSTED note shows no Edit button.
- **Sales Return** (`Sales -> Returns -> open a DRAFT`): an **Edit** button appears. Click it
  → header fields (date, warehouse, settlement, reason, reason code, restocking fee, notes)
  become editable inline; **lines stay read-only** by design. Save persists via the return
  update; Cancel discards. Confirm restocking-fee editing is hidden for BEFORE_INVOICE returns.
- All three: confirm the status chip colors match (DRAFT slate, POSTED/ACCEPTED emerald,
  CANCELLED/REJECTED rose, etc.).

**Known limitations:**
- Quote/DN/SR still lack WhatsApp/Telegram send + attachments (backend is Sales-Invoice-only;
  tracked in task 152). DN/SR have no Cancel/void yet. DN/SR pages are not fully translated yet.
- Editing does not change posting, stock, tax, or accounting math.

### Sales — Sales Invoice V3 Card Layout Mockup Page
**Added by:** Antigravity (report 150)
**What to test:**
- Open `Tools -> Sales Invoice V2 🎨` from the sidebar (or navigate directly to `/#/dev/sales-invoice-v2`).
- Expected: The page loads Variant V3 (Classic Clean Card style) by default.
- Verify that it matches the layout skeleton exactly:
  - Header: Shows "Sales Invoice V2" page, layout variant toggle buttons, and record mode badge.
  - Top Card: Displays details fields including Sales Order, Invoice Template, Customer selector displaying `الشركة العربية للتجارة والخدمات (Arabian Trade Corp)`, salesperson, date fields, Currency `SYP`, and notes.
  - Line Items Card: Uppercase headers (`ITEM`, `QTY`, etc.), 3 pre-populated lines with `[HW-SRV-001] - Server Rack Module` at unit price `2,100,000`.
  - Charges card: Displays charges section with empty state.
  - Attachments card: Displays attachments card with file upload box.
  - Footer actions: Displays Cancel / Return and Save Draft buttons on the left, `Publish & Post` on the right, and Subtotal/Tax/Grand Total values inline side-by-side.
- Click the Variant V2 toggle button in the header bar and verify it transitions to the double-banner style.
- Toggle back to Variant V3, add/remove lines, edit quantities or prices, and confirm totals calculate dynamically.

**Known limitations:**
- This page is a high-fidelity dev layout replica for visual evaluation and styling parity. It runs on mock state values and does not post financial entries to the backend ledger.

---


### Purchases — Direct Purchase Invoice Governance
**Added by:** Codex (report 151)
**What to test:**
- Open `Purchases -> Settings -> Procurement Policy`.
- In OPERATIONAL workflow, enable `Allow Direct Invoicing` and save.
- Open `Purchases -> Invoices -> New Bill` without a PO/GRN reference.
- Expected: saving the direct Purchase Invoice no longer fails with the company governance policy error.
- Return to Purchase Settings, disable `Allow Direct Invoicing`, save, and try another direct invoice.
- Expected: the governance policy error returns unless a form/branch-specific direct exception exists.

**Known limitations:**
- This fix only aligns the settings toggle with the existing governance policy. It does not change posting math, AP accounts, inventory valuation, tax calculation, or Purchase Invoice page layout.

---

### Shared UI — Task 132 Date Control Cleanup
**Added by:** Codex (report 146)
**What to test:**
- Open `Inventory -> Stock Movements` and confirm the from/to filters use the ERP calendar date control.
- Open `Inventory -> Stock Transfers` and confirm the transfer date uses the ERP calendar date control.
- Open `Sales -> Promotions`, create or edit a promotion, and confirm Valid From / Valid To use the ERP calendar date control.
- Open `Sales -> Price Lists`, create or edit a price list, and confirm Valid From / Valid To use the ERP calendar date control.
- In any table with a date-range column filter, confirm the date-range popup uses the ERP date control.
- Right-click a date field where supported and confirm shortcuts such as today / fiscal year / period options are available.

**Known limitations:**
- This slice does not change stock posting, stock valuation, promotion rules, price-list pricing, or ledger behavior.
- Authenticated visual QA is required for actual route access.

---

### Accounting/Inventory — Task 132 Voucher and Item List Standardization
**Added by:** Codex (report 145)
**What to test:**
- Open `Accounting -> Vouchers`.
- Expected: the page uses the shared header style and existing voucher filters/table still work.
- Refresh the voucher list and confirm existing row actions still behave as before.
- Open `Inventory -> Items`.
- Expected: header, New Item button, quick-add form, search/type filters, Refresh, Clear, active/inactive badges, and Open row action appear consistently.
- Create a simple item through Quick Add and confirm a success toast appears.
- Trigger a search/filter and clear it; confirm the list reloads correctly.
- Switch to Arabic and confirm labels and layout remain readable.

**Known limitations:**
- This slice does not change voucher posting/approval, item costing, stock valuation, or inventory posting logic.
- Authenticated visual QA is still required because unauthenticated browser smoke redirects to the auth page.

---

### Sales/Purchases — Task 132 Invoice List Standardization
**Added by:** Codex (report 144)
**What to test:**
- Open `Sales -> Invoices`.
- Expected: header, New Invoice button, status/payment filters, customer selector, Refresh, and Clear filters appear consistently.
- Select a customer through the selector and confirm the list reloads for that customer.
- Confirm status/payment badges are visually distinct for draft/posted/cancelled and unpaid/partial/paid.
- Click Open on a row and confirm it opens the invoice.
- Repeat the same checks in `Purchases -> Invoices` using the vendor selector.
- Switch to Arabic and confirm labels and layout remain readable.

**Known limitations:**
- This slice does not change posting, payment, cancellation, attachment, or audit actions.
- Accounting vouchers and Inventory items are the next operational-list standardization targets.

### Settings — Task 132 Settings Taxonomy Foundation
**Added by:** Codex (report 143)
**What to test:**
- Open `Settings` from the sidebar.
- Confirm the page shows four groups: General, Workflow, Accounting and Tax, Access and Advanced.
- Open each visible link and confirm existing route permissions still apply.
- Open Sales Settings, Purchase Settings, Accounting Settings, and Inventory Settings on desktop and narrow/mobile width.
- Expected: settings tabs are usable on small screens, the save/discard bar remains readable, and no top-bar widget behavior changed.
- Switch to Arabic and confirm the Settings page is readable in RTL.

**Known limitations:**
- This slice does not normalize every Sales/Purchase tab label yet.
- Existing destination pages still own their permissions and save behavior.

### Super Admin — Field Library Phase C2 Voucher Template Authoring
**Added by:** Codex (report 135d)
**What to test:**
- Sign in as SUPER_ADMIN and open `Super Admin -> Voucher Templates`.
- Edit a Sales Invoice template and open the Header Fields tab.
- Expected: the "Available Field Library fields" area offers official fields from Field Library; adding one creates a field row with the library label/type.
- Open the Line Fields tab, add a BODY field from the Field Library, then open Table Columns.
- Expected: that line field appears as an available table column; table column suggestions come from the template's own line fields.
- Save the template, then open a tenant Forms Management wizard for that type.
- Expected: the field placement and required flags follow the saved voucher template.

**Known limitations:**
- `fieldVersionsSeen` drift warnings are not included yet.
- The current Field Library seed has broad shared fields, so super-admins must still choose the correct official fields for each template.

### Forms Management — Field Library Phase C1
**Added by:** Codex (report 135c)
**What to test:**
- Sign in as SUPER_ADMIN and open `Super Admin -> Field Library`.
- Edit `warehouseId` and temporarily change the label to `Warehouse Test`.
- Open `Sales -> Forms Management`, clone or edit a Sales form, and go to the wizard's Fields step.
- Expected: the Warehouse field label reflects the Field Library change, while required fields remain protected.
- Open a Sales or Purchases form that has a line-table Warehouse column.
- Expected: saving the form does not remove the existing `warehouseId` table column.
- Change the `warehouseId` label back in Field Library after the smoke test.

**Known limitations:**
- This C1 smoke confirms company Forms Management consumption. Layer 2 authoring is covered by the Phase C2 QA item above; `fieldVersionsSeen` drift warnings are still pending.

### Purchases — Phase F: Purchase Price Lists
**Added by:** Antigravity (report 131)
**What to test:**
- Open `Purchases -> Price Lists` and click `New Price List`.
- Create a new price list named `USD Wholesale Vendor`, select currency `USD`, set as default: `Yes`.
- Add a line: Item `Widget A`, Min Qty `10`, Unit Price `85.00`.
- Click `Save`.
- Create a new Purchase Order for a vendor using USD. Select `Widget A`, quantity `5`. Verify the price does not resolve to 85.00 (min quantity is 10).
- Change quantity to `10`. Verify the price auto-resolves to `85.00`.
- Override manually to `80.00` to verify overrides work.
- Go to vendor card Commercial Terms, set default price list to `USD Wholesale Vendor`.
- Verify that deletion of a price list triggers the ConfirmDialog.

**Known limitations:**
- Purchase Price Lists resolve unit prices at document entry; they do not block manual price overrides.

### Purchases — Phase F: Vendor Groups
**Added by:** Codex (report 130)
**What to test:**
- Open Purchases -> Vendor Groups
- Create a vendor group, edit it, and confirm it appears in the list
- Open Purchases -> Vendors and assign a vendor to the group from Commercial Terms
- Save and reopen the vendor, then confirm the group persists
- Try deleting a group while a vendor still references it
- Expected: deletion is blocked
- Clear the vendor group from the vendor and save
- Delete the now-unused group
- Expected: deletion succeeds

**Known limitations:**
- Vendor Groups are classification-only in this slice; they do not change AP posting, payment behavior, tax, inventory valuation, or vouchers

### Sales — Phase D.8: Outbound Messaging (WhatsApp + Telegram)
**Added by:** Claude Code (report 116, 117, 118)
**What to test:**
- Go to Sales Settings → Communications
- Add a WhatsApp sender account (test credentials)
- Open a Sales Invoice → Send button → choose WhatsApp
- Verify message is sent and delivery status shows
- Repeat with Telegram sender account
- Verify per-company isolation (switch tenant, confirm sender accounts are separate)

**Known limitations:**
- Email delivery not yet wired (deferred)
- Sender selection UI in Send modal — confirm default auto-selects correctly

---

### Sales — Phase D.7: Invoice Templates
**Added by:** Claude Code (report 115)
**What to test:**
- Go to Forms Designer → create a template
- Open Sales Invoice → Print/Preview → confirm template renders
- Switch templates, verify layout changes

---

### Sales — Phase D.5: Sales Return Enhancements
**Added by:** Claude Code (report 114)
**What to test:**
- Create a Sales Return against an existing invoice
- Verify GL posting reverses correctly
- Check audit log captures the return event

---

### Sales — Phase D.4: Recurring Invoices
**Added by:** Claude Code (report 112)
**What to test:**
- Create a recurring invoice template (monthly)
- Advance the date / trigger the scheduler manually
- Verify invoice is auto-generated with correct line items and dates

---

### Sales — Phase D.2 + D.3: Period Lock + Audit Log
**Added by:** Claude Code (report 111)
**What to test:**
- Lock a period in Accounting Settings
- Attempt to post an invoice in that period — should be blocked
- Check audit log on any Sales Invoice for change history

---

## ✅ Tested & Passed

### Purchases — Phase F: Purchase Invoice Attachments
**Added by:** Codex (report 129)  
**Tested by:** Mahmud  
**Result:** Pass ✅  
**Passed on:** 2026-05-28

**What passed:**
- New PI attachment section is visible.
- Files can be attached before saving a new PI.
- Pre-save files queue locally and upload after saving.
- Saved PI attachments can be viewed and managed.

**Known limitations:**
- Attachments are evidence only; they do not change posting, payment status, tax, AP, or inventory values.

---

## ❌ Failed — Needs Fix

_(none yet)_

---

## 📝 How agents add items

When you finish a feature and it's ready for QA, add a block under "Ready to Test":

```markdown
### [Module] — [Feature Name]
**Added by:** [your agent name] (report NNN)
**What to test:**
- Step-by-step instructions for Mahmud
- Include where to navigate in the UI
- Include expected outcomes
```

Then append to `planning/JOURNAL.md` and update `planning/ACTIVE.md`.

---

_Last updated: 2026-06-04 — Stage 2b Posting-Authority QA carried in; MDI windows unified earlier._
