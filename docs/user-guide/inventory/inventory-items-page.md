# Inventory Items Page

The Inventory Items page (`Inventory > Inventory Items`) is the master record directory for everything you buy, sell, or stock. It lists every item (product, raw material, or service) with quick search, type filter, and status filter.

## What you can do here

- **Search items** by code or name.
- **Filter by type** (All / Product / Raw Material / Service) and by **status** (All / Active only / Inactive only).
- **Open an existing item** — click the code or the **Open** button to open the item card in a full page (web mode) or a window (Windows mode).
- **Activate / Deactivate** — click the **Deactivate** button on an active item, or **Activate** on an inactive one. The action uses the shared confirmation dialog, persists the change, refreshes the list, and emits a success / error toast.
- **Add a new item** — click **New Item** at the top right.

## What "Active" means

An item's `active` flag controls whether the item is selectable in **new** documents. Specifically:

- Active items appear in the item picker on Sales Invoices, Purchase Invoices, Quotations, Delivery Notes, Goods Receipts, Stock Adjustments, and Stock Transfers.
- Inactive items are hidden from those pickers but still appear in **posted history** and **stock level reports**.
- Stock movements, posted vouchers, and existing document lines that reference an inactive item are preserved as-is.

This is the standard soft-delete pattern for items: the row stays in the system so historical postings stay auditable, but new documents can't use it.

## How to deactivate an item

1. Find the item in the list (use the search or filter if needed).
2. Click **Deactivate** on its row.
3. Read the confirmation: deactivating hides the item from new pickers; stock and posted history are preserved.
4. Click **Deactivate** in the dialog.

The list refreshes and the row's status badge changes to **Inactive**. The item is no longer selectable in new documents.

## How to reactivate an item

Same flow but with the **Activate** button. The item is once again selectable in new documents.

## Quick Add was removed

The previous **Quick Add Item** inline form at the top of the page has been removed. To create an item, click **New Item** and use the full item card. This keeps the creation path consistent with every other master record (Customer, Vendor, Warehouse) and lets the wizard validate the full item schema (UoM, pricing, dimensions, GL mappings) on save.

## Permissions

- `inventory.items.view` — required to see the list page.
- `inventory.items.manage` — required to open the card, save changes, or activate / deactivate an item.

## Related

- [Item Master Card](../../inventory/item-master-card.md) — the full create / edit form.
- [Item UOM Conversions](../../inventory/item-uom-conversion.md) — define alternate UOMs for an item.
- [Customers Page](../../sales/customers-page.md) — same list pattern, customer directory.
