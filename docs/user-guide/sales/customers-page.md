# Customers Page

The Customers page (`Sales > Customers`) is the customer master record directory. It lists every party whose `roles` include `CUSTOMER`, with quick search, status filtering, and four at-a-glance KPIs above the table.

## What you'll see

The page has three sections:

1. **Header** — page title `Customers` and a short description, plus the **Add Customer** button on the right.
2. **KPI strip** — four summary cards:
   - **Total customers** — every customer record in this company.
   - **Active customers** — records whose `active` flag is true.
   - **With email** — records that have an email address filled in.
   - **With credit limit** — records that have a non-zero `creditLimit`.
3. **Table** — every customer with code, name, role tags, phone, email, credit limit, and status badge. Click a row to open the customer card.

The footer line below the table shows the filtered count vs. the total count (for example `Showing 12 of 27 customers`).

## Searching and filtering

The toolbar above the table has three controls:

- **Search** — type a code, display name, legal name, email, or phone. The filter is applied locally on the loaded data, so you don't need to wait for a server round-trip. Press **Enter** or click the search button to also reload the list from the server.
- **Status filter** — `All statuses`, `Active only`, or `Inactive only`. Inactive customers are typically deactivated instead of deleted so that posted history and stock movements stay valid.
- **Refresh** — reload the list from the server.
- **Clear** — appears only when a search or status filter is active. Resets both.

## Adding a customer

Click **Add Customer**. The new-customer card opens as a full page (web mode) or as a window (Windows mode). After a successful save, the list refreshes automatically so the new row appears without you having to refresh.

## Opening an existing customer

Click any row to open the customer card. The list page re-runs when you return (route mode) or when the window closes (Windows mode), so any changes you make are immediately visible.

## Status lifecycle

The customer record carries a single `active` boolean. **Active** is the default for new customers; **Inactive** is set when you want to hide a customer from new pickers (Sales Orders, Delivery Notes, Sales Invoices) without losing their AR history. The list does not let you toggle status directly — use the customer card.

## Permissions

- `sales.customers.manage` — required to open the customer card and save changes.
- `sales.customers.view` — required to see the list page itself.

## Related

- [Vendors Page](../../purchases/vendors-page.md) — same pattern for the supplier directory.
- [Customer Master Card](../../sales/customer-master-card.md) — the form for adding and editing a single customer.
- [Account Code Format Selector](../../settings/account-code-format-selector.md) — the format selector on the Financial Settings tab of the customer card.
