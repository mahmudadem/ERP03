# Apex Shell Candidate

## What This Is

The Apex shell is the new ERP navigation and workspace design being prepared to replace the current tenant shell later. It is not the default shell yet.

## How To Test

Open the direct route:

`/#/dev/apex-ledger`

You must be signed in and have an active company selected.

## What To Check

- The sidebar should show only modules your company and role can access.
- Inside each visible module, the sidebar should also hide links you do not have permission to use.
- Sales and Purchases workflow links should follow the same policy as the main shell. For example, operational Sales Orders or Delivery Notes should be hidden when the company is configured for direct invoicing only.
- Default and cloned document/form links should appear in the same groups as the main shell.
- The top header should show the active company, fiscal year, base currency, UI mode, and current user initial.
- The sidebar should fill the full vertical height of the browser window. The menu can scroll inside the sidebar, but the Apex logo area and bottom Company Settings area should stay inside the full-height shell.
- The Apex shell should feel the same size as the downloaded Apex prototype, closer to how the old smaller shell looked when the browser was zoomed to about 110%.
- Text in the Apex shell should visually match the prototype typography: Inter for normal UI text, JetBrains Mono for small metadata/counters, and no smaller 90% legacy-shell text scale.
- The bottom of the Apex sidebar should show **Company Settings**, matching the main sidebar, not the old Apex user/profile card.
- Open the Company Settings footer and test Overview, Users, Roles, Modules, Features, Bundles, Currencies, Tax Codes, Notifications, Communications, and General Settings.
  - Expected: each page stays inside `/#/dev/apex-ledger/...` with the Apex sidebar and topbar still visible.
- Empty tenants should show empty data, not sample invoices or fake balances.
- Deleting an invoice from the Apex Sales candidate should open a confirmation dialog before removal.
- The dashboard activity panel should show loaded tenant activity or an empty state, not fake audit logs.
- Sales subpages should open inside the Apex shell instead of switching back to the old shell. Try Sales Invoices, New Sales Invoice, Sales Orders, Delivery Notes, Sales Returns, Customer Statement, Sales Analytics, Recurring Invoices, and Sales Settings.
- From a native Sales page inside Apex, click actions such as open row, create new, back to list, convert quote, create return, or open a linked document. The URL should remain under `/#/dev/apex-ledger/sales/...`.
- Purchases subpages should open inside the Apex shell instead of switching back to the old shell. Try Purchase Invoices, New Purchase Invoice, Purchase Orders, Goods Receipts, Purchase Returns, Vendors, Vendor Statement, AP Aging, Purchases Analytics, and Purchase Settings.
- Inventory subpages should open inside the Apex shell instead of switching back to the old shell. Try Items, Item Detail, Categories, Warehouses, Stock Levels, Stock Movements, Stock Adjustments, Stock Transfers, Opening Stock, Low Stock Alerts, Inventory Valuation, UOMs, and Inventory Settings.
- Settings and RBAC subpages should open inside the Apex shell instead of switching back to the old shell. Try General Settings, Topbar Widgets, Sidebar/Menu Config, Approval Workflow, Roles, Edit Role, and Assign Users.
- AI subpages should open inside the Apex shell through the Apex alias. Try AI Home, AI Settings, AI Usage, AI Proposals, Proposal Detail, and AI Setup.
- Accounting utility and detail pages should open inside the Apex shell. Try Accounting Setup, Recurring Vouchers, Cost Centers, Voucher Detail/View, Voucher Designer, Budgets, Subgroup Tagging, and Forms Designer.
- Remaining native route groups should also stay inside Apex when opened directly. Try Companies, Notifications, Company Admin, HR, POS, Super Admin, Company Wizard, CRM, Manufacturing, Projects, and Canvas Dev routes where your role has access.

## Current Limitations

- Apex is still a candidate route and is hidden from normal navigation.
- Super Admin pages now stay inside Apex for route continuity, but they are platform-owner workflows and still need separate role/permission QA before Apex can replace their normal shell.
- Sales pages are now mounted, but still need authenticated manual QA across English, Arabic RTL, direct-invoicing mode, operational workflow mode, and restricted roles.
- Purchases and Inventory pages are now mounted, but still need authenticated manual QA across English, Arabic RTL, direct-invoicing/operational workflow modes, stock permissions, restricted roles, and empty tenant data.
- Settings/RBAC and AI pages are now mounted, but still need authenticated manual QA across English, Arabic RTL, restricted roles, disabled modules, and AI permission combinations.
- Full authenticated QA in Arabic RTL and small screens is still required before making Apex the default shell.
- The restored prototype scale still needs authenticated visual QA on Mahmud's screen, because the local build checks cannot confirm the subjective "perfect prototype" match.

## What Did Not Change

This update does not change accounting posting, approvals, period locks, taxes, balances, inventory costing, receivables, payables, or reports.
