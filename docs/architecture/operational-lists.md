# Operational List Architecture

## Purpose

Operational lists are the primary work surfaces for managing transactional documents in the ERP. Unlike reports, they are not read-only analysis pages; users interact with them to find, view, print, create, and delete documents. To ensure consistency, ease of use, and visual appeal, all operational lists are built using the standardized `OperationalListLayout` template component.

## Standardized Pages

The following operational lists have been fully standardized:
- **Sales Invoices List**: [SalesInvoicesListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesInvoicesListPage.tsx)
- **Purchase Invoices List**: [PurchaseInvoicesListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchaseInvoicesListPage.tsx)
- **Sales Orders List**: [SalesOrdersListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesOrdersListPage.tsx)
- **Purchase Orders List**: [PurchaseOrdersListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchaseOrdersListPage.tsx)
- **Delivery Notes List**: [DeliveryNotesListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/DeliveryNotesListPage.tsx)
- **Sales Returns List**: [SalesReturnsListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/SalesReturnsListPage.tsx)
- **Quotations List**: [QuotationsPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/sales/pages/QuotationsPage.tsx)
- **Goods Receipts List**: [GoodsReceiptsListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/GoodsReceiptsListPage.tsx)
- **Purchase Returns List**: [PurchaseReturnsListPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/purchases/pages/PurchaseReturnsListPage.tsx)
- **Stock Transfers List**: [StockTransfersPage.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/inventory/pages/StockTransfersPage.tsx)

## Layout & Styling Standards

Every standardized operational list page must adhere to the following rules:

### 1. Viewport Height Containment
To maintain a professional, desktop-like app feel, operational list pages must not cause page-level overflow scrolling.
- The root layout uses a full viewport flex container (`flex flex-col h-full overflow-hidden`).
- All nested child containers (header, KPI summary widgets, filter panel) have fixed heights (`flex-none`).
- The `DataTable` container occupies the remaining space (`flex-1 min-h-0 overflow-hidden`) and uses internal scrollbars for table data.

### 2. Full-Page Width & Responsiveness
- Lists use 100% of the horizontal screen real estate to maximize column readability.
- Layouts are fully responsive. Page elements (headers, summaries, filter grids) stack on mobile viewports and expand to multi-column arrangements on desktop viewports.
- Spacing adapts dynamically based on the active user preference UI mode:
  - **Classic Mode**: Comfortable, standard web spacing (`p-6 space-y-5`).
  - **Windows Mode**: Compact, windows-like layout (`p-3 space-y-3`).

### 3. Default Sorting
- Standardized lists must default to sorting by **Date and Time descending** first, and then by **Document Number descending** as a secondary tie-breaker.
- Custom sorting logic must be implemented inside the component's sorting selectors/comparators to preserve this ordering when no user sort is active.

### 4. Pagination
- Pagination must default to **25 records per page**.
- Page size options must be configured exactly as `[10, 25, 50, 100]`.
- The pagination controller is sticky and visible at the bottom of the table container.

### 5. Column Visibility & Settings Control
- All primary document data columns (such as Invoice #, Customer/Party, Date & Time, Grand Total, Currency, Invoice Type/Persona, Payments, Status) must be set to `priority: 1` so they are visible by default.
- Secondary detail columns (like Created By, Expected Delivery, Posted At) must use `priority: 2` or `priority: 3`.
- A table settings icon button (the **Column Control Button**) is rendered at the top-right of the table toolbar, allowing users to toggle the visibility of any column dynamically. Checking or unchecking columns immediately updates the visible headers and cells.

### 6. Action Menu & Kebabs
- Primary row actions (such as viewing/opening a document) should happen on double-click or clicking a row.
- Secondary actions (such as **View**, **Print**, and **Delete**) are configured within the `RowAction` array of the table.
- All actions must be collapsed inside a **kebab menu dropdown** on each row (accomplished by setting `primary: false` on each defined `RowAction`).

### 7. Operational & Destructive Safety
- Any destructive or status-altering action (such as deleting a Draft document) **must** use the React-based `ConfirmDialog` via the `useConfirm` hook. The native `window.confirm()` or `alert()` functions are strictly blocked by build-time lint checks.
- Every state-changing user action must produce a toast feedback using `react-hot-toast` (success, info, or error messages).

### 8. Quick Status Filters
- Transaction lists render a horizontal quick status filter pill bar above the filter cards to let users filter the records dynamically with one click.
- The pills show a colored status dot, status label, and the total count of documents in that status.
- Document counts are calculated dynamically from the loaded dataset in memory, respecting other active filters (e.g. customer/vendor, payment).
- The list pages fetch document lists from the API without a status filter, executing the status toggling in memory for instantaneous page rendering and zero-latency filtering transitions.

### 9. High-Density Single-Row Filters Bar
- The filter elements must be organized in a single horizontal row (`flex flex-col lg:flex-row items-center gap-3 w-full flex-wrap`) rather than a multi-row grid layout.
- Vertical label texts above input fields are removed to preserve vertical height.
- Descriptive placeholders or defaults are passed inline (e.g., "All Customers", "All Statuses", "Date From").
- Input elements are configured with standard inline widths on desktop viewports (e.g., `lg:w-64` for selectors, `lg:w-36` for standard select dropdowns, and `lg:w-40` for date pickers).
- The DatePicker component is enhanced with a custom `placeholder?: string` prop to show helper labels inline when the date value is empty.
- Sales Invoices default their list date range to the active/open fiscal-year beginning through company-today. The date filter controls and date columns must display dates through the shared company date-format utilities, not raw ISO strings or browser-default locale formatting.

### 10. Cell Alignment and Status Chip Wrapping
- Standardized list cells are center-aligned for scan consistency across document number, party, date, amount, currency, type/context, payment, status, creator, due date, and posted date.
- Status/payment/context chips must use non-wrapping inline styling so long labels such as "Pending Approval" remain on one line.
- Sales Returns follow the same pattern as Sales Invoices: shared customer selector, inline search/context/status/date filters, dynamic status pills, company-aware dates, row actions, default newest-first sorting, and 25-row pagination.
- Quotations, Goods Receipts, and Purchase Returns now follow the same shared operational-list shell with quick status pills, inline filters, centered cells, row actions, and 25-row pagination.

## File Map & Architecture

- **Layout Wrapper**: `frontend/src/components/shared/OperationalListLayout.tsx`
- **Table Component**: `frontend/src/components/ui/DataTable/DataTable.tsx`
- **Column Priority Hook**: `frontend/src/components/ui/DataTable/useResponsiveColumns.ts` (manages reactive state for checkbox overrides)
- **Confirm Hook**: `frontend/src/hooks/useConfirm.ts`

## Master Data Save Refresh Contract

Master-data list pages that open native master cards must refresh after a successful save, whether the card is opened as a full route or as a Windows-mode MDI card.

Current covered pages:
- Customers list -> `PartyMasterCard` with `role=CUSTOMER`
- Vendors list -> `PartyMasterCard` with `role=VENDOR`
- Inventory Items list -> `ItemMasterCard`
- Warehouses list -> `WarehouseMasterCard`

Route mode uses React Router location state key `masterDataRefreshToken` when navigating back to the list. The list page watches that token and reloads its data. Windows mode passes the list reload function through `openWindow(... data.onSaved ...)`; the card window invokes that callback before closing. This keeps refresh behavior local to the list/card pair and avoids a global cache invalidation bus for these simple master-data pages.

## Master Card Save Button Labels (Task 245 NOTE-05)

`MasterCardLayout` accepts two new props that override the generic **"Save"** / **"Update"** labels with entity-specific copy:

- `saveNewLabel` — label on the primary action when `isNew` is true
- `updateLabel` — label on the primary action when editing an existing record

Callers today: `PartyMasterCard` ("Save New Customer" / "Update Customer" / "Save New Vendor" / "Update Vendor"), `ItemMasterCard` ("Save New Item" / "Update Item"), `WarehouseMasterCard` ("Save New Warehouse" / "Update Warehouse").

When a caller does not pass the labels, the layout falls back to neutral "Save" / "Update". This replaces the old generic "SAVE NEW RECORD" / "UPDATE MASTER RECORD" copy that did not reflect the entity being saved.

## Customer Account Code Format (Task 245 NOTE-04)

`PartyMasterCard` exposes a 4-option **Account code format** selector inside the Auto-create preview block on the **Financial Settings** tab:

- `{parent}-{partyCode}` (default) — e.g. `10401-C001`
- `{parent}-{seq3}` — e.g. `10401-001` (auto-disambiguating 3-digit sequence)
- `{parent}.{partyCode}` — e.g. `10401.C001`
- Custom — any pattern that uses `{parent}`, `{partyCode}`, `{seq3}` tokens

When the user changes the format on a new party, the chosen template is persisted to the company-level Sales / Purchase settings on save, so subsequent parties follow the same pattern. The currently-active format is read from those settings when the card opens; the preset selector is matched against the active template and falls back to **Custom** for any value that does not match a preset.

## Customer Account Strategy Default (Task 245 NOTE-03)

`PartyMasterCard` now defaults the **Account Strategy** to **Auto-create sub-account** for new customers/vendors whenever the parent AR / AP account is already configured in Sales / Purchase Settings. The signal is the presence of `arParentAccountId` (customers) or `apParentAccountId` (vendors) returned by the settings endpoint. When the parent account is missing, the user must still pick a strategy explicitly.

## Customers List Page (Task 245 NOTE-02)

`CustomersListPage` now includes a 4-card KPI strip (Total / Active / With email / With credit limit), a single-row search + status filter bar with `Refresh` and `Clear` actions, a richer header with subtitle + `Add Customer` action button, a richer table including the **Credit Limit** column and inline legal name text, and a footer count line that distinguishes the filtered vs. total customer count. The page is the visual template for the Vendors list page, which still uses the older `OperationalListLayout` pattern and should follow when next touched.

## Inventory Items List Page (Task 245 NOTE-12, NOTE-13)

`ItemsListPage` was simplified:

- The **Quick Add Item** inline form was removed. New Item is the only creation path; the card has parity with the rest of the master-data flow.
- A **status filter** was added alongside the existing search + type filter (All / Active only / Inactive only). The status column now documents what Active means via the filter's tooltip.
- Each row exposes a per-row **Activate / Deactivate** button alongside the existing **Open** action. The action uses the shared `useConfirm` dialog, gates on `inventory.items.manage`, persists the change through `inventoryApi.updateItem(id, { active })`, refreshes the list, and emits a success / error toast.

Do not rely on browser back/close alone after creating a master record. The successful save callback is the source of truth for list refresh.
