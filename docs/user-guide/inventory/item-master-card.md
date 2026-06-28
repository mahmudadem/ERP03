# Item Master Card

Use the item master card to review or edit an inventory item.

## Open an existing item

1. Go to `Inventory -> Items`.
2. Search or refresh the list.
3. Click the item code or the `Open` action.
4. The card opens with the saved item details, including code, name, type, category, UOM defaults, prices, stock-control settings, and accounting mappings.

After editing, save the card. Reopen the item from the list to confirm the saved values round-trip.

## Notes

- In Windows mode, the item opens in a window; in normal mode, it opens as a page. The fields and saved data are the same in both modes.
- UOM conversion maintenance is handled from the Stock Control tab after the item has been saved.
# Barcodes by unit

An item may keep its optional primary and additional general barcodes. In
**General Info → Barcodes by Unit of Measure**, you can also enter one or more
comma-separated barcodes for each configured item unit.

Example:

- `111111` identifies one piece.
- `222222` identifies a box.
- `333333` identifies a carton.

At POS, scanning a unit barcode selects that unit and its applicable price.
The same barcode cannot be assigned twice within one company.
