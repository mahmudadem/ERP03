# Backorder and Fulfillment Progress

When you work with Sales Orders and Delivery Notes in OPERATIONAL mode, the system tracks exactly how much has been delivered, invoiced, and returned against each order line. This guide explains how to see fulfillment status and create backorder delivery notes for partially-shipped orders.

---

## Fulfillment Progress on a Sales Order

When you open a confirmed Sales Order, a **Fulfillment Progress** section shows below the totals. For each line you can see:

- **Ordered Qty** — how many units the customer ordered
- **Delivered Qty** — how many have been shipped so far
- **Invoiced Qty** — how many have been invoiced
- **Returned Qty** — how many have been returned
- **Progress bar** — a visual bar showing the delivery percentage (delivered ÷ ordered)

At the top of the section, an **overall** row shows total ordered vs total delivered across all lines.

This section only appears for **confirmed** orders (not drafts).

---

## Partial Fulfillment on a Delivery Note

When you view a Delivery Note that is linked to a Sales Order, each line shows:

- **Ordered** — the quantity from the original Sales Order line
- **Delivered Qty** — what was shipped on this Delivery Note

Next to each line you will see a badge:

- **Fulfilled** (green) — the delivered quantity meets or exceeds the ordered quantity
- **Partial** (amber) — the delivered quantity is less than the ordered quantity

---

## Creating a Backorder Delivery Note

If some lines on a Delivery Note are marked **Partial** (shipped less than ordered), a **Create Backorder Delivery Note** button appears below the lines table.

Click it to go directly to the Create Delivery Note screen, pre-loaded with the remaining quantities from the original Sales Order. You can adjust quantities and ship the rest.

This lets you handle partial shipments easily: ship what is available now, come back later to ship the balance on a separate Delivery Note.

---

## Common questions

**Can I see fulfillment status for all my orders at once?**
Not in a single list view yet. Open each confirmed Sales Order to see its fulfillment progress section.

**The progress bar shows 50% — what does that mean?**
Half of the ordered quantity has been delivered so far. The percentage is calculated per line as `deliveredQty / orderedQty × 100`.

**I fully delivered an order but the bar shows less than 100%.**
Check if some lines were delivered on different Delivery Notes. The progress includes all deliveries against the order, not just the current Delivery Note.

**Can I create a backorder from a Delivery Note that has both fulfilled and partial lines?**
Yes. The button appears as long as at least one line is partially delivered. The new Delivery Note will only include the remaining quantities for the partial lines.
