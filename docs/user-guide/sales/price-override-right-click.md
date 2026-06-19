# Right-click price-override (sales and purchase documents)

**Where:** Sales Invoice, Sales Order, Purchase Invoice, Purchase Order (native pages) AND the same documents rendered through the Form-Designer (Generic Voucher Renderer).

**Why:** Most of the time the company default pricing policy is correct, but every so often a single line — or a single document — needs a different source (e.g. this customer is on a special price list for this invoice, or that one item is locked at a manual price for this sale). Task 243 Parts C and D add two right-click affordances so the user can change the source without leaving the line table.

## Two right-click triggers

| Where you right-click | What changes | When to use it |
|---|---|---|
| The **"Unit Price" column header** | Every priced line on this document re-resolves using the new source. The document's `linePriceSource` field changes. | "This whole invoice is on a price list — switch it." |
| Any single **Unit Price cell** | That one line gets a per-line override (or a manual lock). The other lines are unaffected. | "Just this one line — pull from the price list and leave the rest as last-party price." |

Both affordances show a tiny `Override` badge next to the price when they're active, so the user can see at a glance that an override is in effect.

## What the menus offer

### Column header menu (right-click "Unit Price")

```
✓ Last party price            ← current source has a check mark
  Price list
  Last sale/purchase
  Item default
─── divider ───
↺ Reset to company default    ← only shown when an override is active
```

Picking any source re-resolves every priced line and shows a toast confirmation. "Reset to company default" appears only when the current source is different from the company baseline — and resets the document to use that baseline.

### Cell menu (right-click one price)

```
  Use document source         ← default; line follows the document
✓ Last party price             ← current per-line source has a check mark
  Price list
  Last sale/purchase
  Item default
─── divider ───
🔒 Lock (manual, no auto-resolve)
```

Picking a source for one line re-resolves only that line. Picking **🔒 Lock (manual, no auto-resolve)** sets the line's `priceLocked` flag — the line is never auto-resolved again until you clear the lock. The user's typed price is preserved.

## What the badges mean

- **`Override: <source>`** in the column header → the document is using a different source than the company baseline.
- **`Override: <source>`** in a price cell → that line has a per-line source override.
- **`🔒 Locked`** in a price cell → that line is manually locked; the resolver will not touch it.

## What's preserved (and what's not)

| Field | Saved to the backend? | Notes |
|---|---|---|
| `form.linePriceSource` | Yes (existing behavior) | The user-selected document source is persisted. |
| `line.unitPriceDoc` | Yes (existing behavior) | The resolved-or-typed unit price. |
| `line.priceSourceOverride` | **No** | Transient. Stripped from `buildLinePayload` before posting. |
| `line.priceLocked` | **No** | Transient. Stripped from `buildLinePayload` before posting. |

So once the document is posted, the override context is gone — the only artifact is the unit price the user (or the override) ended up with.

## Native page vs Form-Designer form

Both surfaces share the same `salesLinePriceResolver` / `purchaseLinePriceResolver` services, the same `createPriceOverrideMenuItems` factories, and the same `LinePriceOverrideBadge` component. Right-click on a Form-Designer-rendered sales/purchase form behaves identically to the native page. Task 243 Part D is the standing principle: the two surfaces must stay in feature parity for pricing.

## How the strict single-source policy still holds (Task 242)

Task 242 made the resolver strict — a miss returns blank, no cross-source fallback. The override system **does not weaken this**. It only chooses WHICH strict source to query. A per-line override of `PRICE_LIST` will check only the applicable price list; if it misses, the line stays at its current price and the user can type a new one (or pick a different override).

## Common scenarios

- **"This customer is on the Wholesale price list for this invoice only"** → right-click the **Unit Price column header** → pick **Price list** → all lines re-resolve against the wholesale list. To undo, right-click again and **Reset to company default**.

- **"Lock the freight line at 50, don't let the resolver overwrite it"** → right-click the freight line's **Unit Price cell** → pick **🔒 Lock (manual, no auto-resolve)** → type 50. The lock persists for the rest of the session.

- **"Use the item default for this one free-goods line"** → right-click the line's **Unit Price cell** → pick **Item default** → that line re-resolves against the item's `salePrice` / `purchasePrice` field.

## Limitations

- The column-header right-click is only available on documents that already support the document-level `linePriceSource` selector — currently Sales Invoice, Sales Order, Purchase Invoice, Purchase Order. Quotations, Sales Returns, Delivery Notes, Goods Receipts, and Purchase Returns do NOT yet have this infrastructure; right-click is suppressed on those pages by design (Task 243 deferred to a follow-up).
- The per-line override and lock are **transient**: they exist only in the open document and are not persisted with the line. They affect auto-resolution behavior for that line while the document is being edited.
- The override is visual only — the resolver still queries the same backend endpoint; it's just told to use a different source. A new task (Task 247+ territory) could persist the override if the business needs it on the saved document.
