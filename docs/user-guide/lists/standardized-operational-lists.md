# Standardized Operational Lists User Guide

Operational list pages in ERP03 have been standardized to provide a consistent, responsive, and powerful user experience across Sales, Purchases, and Inventory modules.

## Standardized Modules

The following lists share this unified interface:
- **Sales Invoices**: `Sales -> Invoices`
- **Purchase Invoices**: `Purchases -> Invoices`
- **Sales Orders**: `Sales -> Orders`
- **Purchase Orders**: `Purchases -> Orders`
- **Delivery Notes**: `Sales -> Delivery Notes`

---

## Key Features

### 1. Unified Toolbar and Search
- A search box is located at the top-left of the table to let you quickly find records by document number or names.
- A **Refresh** button is located in the top-right toolbar to update the lists with real-time data from the server.
- The **New** button (e.g., *New Invoice*, *New Order*) is prominently placed at the top-right to initiate creation.

### 2. High-Density Single-Row Filters Bar
- Located below the header, the filter panel organizes all filter controls (Search, Customer/Vendor selector, Document Type, Status select, Payment status select, Date From, and Date To range pickers) into a single, high-density horizontal row.
- Filter labels are displayed inline as placeholders (e.g. *Date From*, *Date To*) or as default selected options to save vertical screen space.
- Master data filters use smart auto-complete selectors to guarantee data integrity.
- Click **Apply** or press **Enter** in the search field to execute filters. Click the reset icon to clear all filters.

### 3. Interactive Column Visibility (Control Button)
- A **Settings (Gear/Control)** button is located at the top-right toolbar of the table.
- Clicking this opens a dropdown checklist where you can toggle columns (such as *Created By*, *Expected Delivery*, *Posted At*, etc.) on and off.
- The default visible columns are pre-configured to show essential document information (Invoice #, Customer, Date, Grand Total, Currency, Payments, Status, Actions) without cluttering the screen.

### 4. Default and Interactive Sorting
- By default, the list is automatically sorted by **Date and Time descending**, and then by **Document Number descending** as a secondary tie-breaker.
- You can sort by any individual column (e.g., Customer, Grand Total, Status) by clicking on the column header. Clicking the header toggles between Ascending, Descending, and Unsorted states.

### 5. Standard Pagination
- To keep lists fast and responsive, pages load **25 records** by default.
- You can change the page size to **10, 25, 50, or 100** items using the dropdown at the bottom of the table.
- Navigation links let you paginate through the list pages easily.

### 6. Row Actions & Kebab Menu
- Clicking any row opens that document's details immediately.
- Specific secondary actions are grouped inside a **kebab menu (three-dots icon)** at the end of each row:
  - **View**: Opens the document in view/edit mode.
  - **Print**: Prepares the document layout and invokes the print/PDF generation dialog.
  - **Delete**: (Available for *Draft* documents only) Deletes the draft after confirmation.

### 7. Actions & Deletion Security
- Deleting any draft document will trigger a React-based confirmation modal (*Confirm Dialog*) to verify the action.
- Every successful or failed action shows a notification toast at the top-right of the window to confirm the operation succeeded or reported errors.

### 8. Quick Status Filters (Pill Bar)
- A horizontal quick status filter pill bar is located directly below the page header.
- This bar shows interactive pills for each document status (e.g. *Draft*, *Pending Approval*, *Posted*, *Cancelled*) along with the active document counts for each status.
- Clicking on a pill filters the list by that status instantly.
- Clicking the active pill again clears the status filter and returns the view to show all documents.
- The status counts are dynamically updated based on other active filters (like selected Customer or Payment status), letting you see exactly how many documents in other statuses exist for the filtered set.
