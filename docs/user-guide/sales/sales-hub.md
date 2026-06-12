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
- **+ New SO**: Quickly create a new Sales Order (visible in Operational mode).
- **+ New Invoice**: Directly create a new Sales Invoice.
- **Settings Icon**: Navigate to the Sales Settings page.

### 3. Quick Links
A compact row of horizontal tiles lets you jump to specific documents:
- **Invoices**
- **Orders** (if operational mode is enabled)
- **Delivery Notes** (if operational mode is enabled)
- **Quotations**
- **Returns**

Each link displays a total count of documents currently in the system.

### 4. Document Pipeline
The **Document Pipeline** displays status counts for Invoices, Orders, Delivery Notes, and Returns.
- **Clickable Badges**: Each status count (e.g. `Draft`, `Pending Approval`, `Posted`) is an interactive button. Clicking a badge will navigate you to the document's list page with that specific status filter pre-applied.
- **Total Counts**: Displays the overall count of documents.
- **Row Navigation**: Clicking the arrow button (`->`) on the right side of the row takes you directly to the full document list.

### 5. Settings Summary
This panel lists your active Sales configurations, including:
- **Workflow Mode**: Simple or Operational workflow.
- **Prefixes and Sequences**: Standard document numbering templates.
- **Payment Terms**: Default company payment rules.
- **Operational Options**: Flags for credit-limit checks, over-deliveries, and direct invoicing overrides.

### 6. Recent Activity
A unified table showing the 10 most recent transactions (Invoices, Orders, and Returns) sorted by update time.
Each entry displays:
- Document number (with a link to its details)
- Customer name
- Document type badge
- Status badge
- Financial amount
- Date and time of the last update

### 7. Top Customers
A visual percentage progress bar chart displaying your highest-revenue customers. The progress bar for each customer is dynamically scaled relative to your highest-producing customer.

---

## Data Caching and Refreshing

To guarantee fast page load speeds, the Sales Hub automatically caches data in memory:
- **Sales Settings**: Cached for 5 minutes.
- **Invoices, Orders, Delivery Notes, and Returns**: Cached for 60 seconds.

If you want to view the absolute latest real-time data, you don't need to reload the entire web page. Each section (Document Pipeline, Recent Activity, Top Customers) has a **↻ Refresh** icon button. Clicking it invalidates that specific section's cache and fetches fresh data from the server instantly.
