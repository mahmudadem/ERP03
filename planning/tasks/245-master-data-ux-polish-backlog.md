# Task 245 — Master-data & onboarding UX polish backlog

**Status:** Planned (owner manual-test 2026-06-19). Lower-priority UX items; independent of each other.
**Module:** Onboarding + Sales (customers) + Inventory (items, UOM) + shared master cards.
**Source:** owner manual-test [NOTE-01–07, 12, 13](../qa/241-manual-test-notes.md). Each note has full repro/context there.

These are small, independent improvements found while testing 241. None blocks anything; pick them up individually or in a sweep.

| # | Note | Item | Where |
|---|------|------|-------|
| 1 | NOTE-01 | When "Auto initialize Trading Company – Simple" is on, expose more setup options — at minimum a **Chart-of-Accounts selector** (don't always force periodic-trading COA), and surface the other auto-chosen policies as editable. | Company creation wizard → Company Setup step |
| 2 | NOTE-02 | Customers list needs **KPI cards** (total/active customers, balances, top accounts) + a more "pro" layout matching the premium list-page standard. | Sales → Customers list |
| 3 | NOTE-03 | When sales is auto-initialized, **default the customer Account Strategy to "Auto-create sub-account"** so users add customers directly under the parent without extra clicks. | New Customer → Financial Settings |
| 4 | NOTE-04 | Add an **account-code format selector** (≈3 preset formats is enough) for the generated AR/AP sub-account. | New Customer → Financial Settings |
| 5 | NOTE-05 | Save button label "SAVE NEW RECORD" is too generic — make it entity-specific ("Save New Customer/Vendor/Item") or just "Save"/"Add". | Shared master-card footer |
| 6 | NOTE-06 | **List doesn't auto-refresh after creating** a record (customers/vendors/items/warehouses). **Recurring** — also noted in `planning/ACTIVE.md` from golden-path QA. Fix once, broadly. | Master-data list pages |
| 7 | NOTE-07 | Units of Measure page: top inline form inputs are **unlabeled** and "Add vs Update" is ambiguous; label fields (incl. Decimals) and clarify add/edit. | `frontend/src/modules/inventory/pages/UomsPage.tsx` |
| 8 | NOTE-12 | **Remove the "Quick Add Item"** block from the Inventory Items page (use New Item / full card). (Quick Add also defaulted currency to USD vs base TRY — moot once removed.) | Inventory → Inventory Items |
| 9 | NOTE-13 | "Active" status column is unclear and has **no deactivate toggle** — clarify meaning and/or add an activate/deactivate action. | Inventory → Inventory Items |

## Notes
- NOTE-06 is the only outright **bug** here (the rest are UX/feature). Consider doing it first / separately.
- Each item is self-contained; no ordering dependency.

## Definition of Done (per item or per sweep)
Code merged · relevant user-guide/architecture touch-ups where applicable · `planning/done/245-*.md` report · JOURNAL + ACTIVE updated.
