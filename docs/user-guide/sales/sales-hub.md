# User Guide: Sales Hub Dashboard

The **Sales Hub** is the central command center for the Sales module. It provides an immediate, high-density overview of your sales metrics, active pipeline, configuration settings, recent activities, and top customers.

## Navigation and Layout

You can access the Sales Hub by clicking **Sales** in the sidebar.

The page is structured into several key sections:

### 1. Header & Last Updated Stamp
At the top of the page, you'll see the **Sales Hub** title with a graphic icon and a "Module Dashboard" label. 
Next to it, a **Last updated** timestamp shows exactly when the data on the screen was last loaded.

### 2. Action Buttons
Use the quick action buttons in the header to create records:
- **+ Create Sales Order**: Quickly create a new Sales Order.
- **+ Create Invoice**: Directly create a new Sales Invoice.
- **+ Create Sales Return**: Directly create a new Sales Return.
- **Settings**: Navigate to the Sales Settings page.

### 3. Financial KPI Cards
Four clean, border-accented metric cards displaying:
- **Total Revenue**: Total sales values with base currency, representing cash settlements.
- **Outstanding AR**: Total accounts receivable currently due.
- **Overdue Invoices**: A count of active invoices past their due date.
- **Pending Approval**: A count of invoices awaiting manager approval.

---

## Workspace Layout

The main workspace is split into two columns:

### Left Column: Transaction Tables
- **Recent Sales Orders (SO)**: Displays the 5 most recent Sales Orders in the system. Clicking a row opens the detail page for that Sales Order.
- **Recent Sales Invoices (INV)**: Displays the 5 most recent Sales Invoices. Clicking a row opens the detail page for that Sales Invoice.

Both tables show all the key metadata columns for maximum readability:
- Document Number / ID
- Transaction Date
- Customer Name
- Document Currency
- Raw Total Amount
- Created By (Operator name)
- Created At Timestamp
- Approved At Timestamp
- Current Status Badge

### Right Column: Sidebar
- **Quick Navigation**: Jump straight to document listing pages (Invoices, Orders, Delivery Notes, Quotations, Returns) or settings.
- **Recent Activity Log**: A compact chronological timeline feed of the latest updates across all document types. It displays document numbers, transaction dates, customer info, and total amounts in a space-saving vertical card list.
- **Top Client Accounts**: Cards displaying your highest-revenue customer accounts. Each card shows the primary Arabic customer name, its English translation, the current total balance, and a thin nested progress line representing their share of total company sales.

---

## Data Caching and Refreshing

To guarantee fast page load speeds, the Sales Hub automatically caches data in memory:
- **Sales Settings**: Cached for 5 minutes.
- **Invoices, Orders, Delivery Notes, and Returns**: Cached for 60 seconds.

If you want to view the absolute latest real-time data, you don't need to reload the entire web page. Each section (Document Pipeline, Recent Activity, Top Customers) has a **↻ Refresh** icon button. Clicking it invalidates that specific section's cache and fetches fresh data from the server instantly.
