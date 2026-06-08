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

## File Map & Architecture

- **Layout Wrapper**: `frontend/src/components/shared/OperationalListLayout.tsx`
- **Table Component**: `frontend/src/components/ui/DataTable/DataTable.tsx`
- **Column Priority Hook**: `frontend/src/components/ui/DataTable/useResponsiveColumns.ts` (manages reactive state for checkbox overrides)
- **Confirm Hook**: `frontend/src/hooks/useConfirm.ts`
