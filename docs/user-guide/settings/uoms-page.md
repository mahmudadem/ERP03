# Units of Measure Page

The Units of Measure page (`Settings > Inventory > Units of Measure`) defines the measurement units your company uses (e.g. `KG`, `BOX`, `EA`, `L`, `m²`). Item master records reference a base UOM, and Sales / Purchase / Inventory document lines can use any UOM that has a defined conversion factor back to the item's base UOM.

## What you can do here

- **Add a new UOM** — fill in the form above the list and click **Add new UOM**. The new UOM appears in the list immediately.
- **Edit an existing UOM** — click **Edit** next to a row. The form switches to the **Edit UOM** mode (highlighted row + Cancel edit button), pre-filled with the row's values. Change anything, then click **Save changes**.
- **Cancel an in-progress edit** — click **Cancel edit** or **Reset** to clear the form and go back to Add mode.
- **See whether a UOM is `System`** — the Status column shows `Active`, `Inactive`, or `Active · System`. System UOMs are seeded by the platform and cannot be deleted through this page, but you can still update their `Name`, `Decimals`, or `Active` flag.

## Form fields

| Field | Required | Notes |
|---|---|---|
| Code | Yes | 2–10 characters, stored uppercase. Examples: `KG`, `BOX`, `EA`, `L`. |
| Name | Yes | Human-readable label. Example: `Kilogram`. |
| Dimension | No | One of `COUNT`, `WEIGHT`, `VOLUME`, `LENGTH`, `AREA`, `TIME`, `OTHER`. Helps pickers group units semantically. |
| Decimals | No | 0 to 6. How many decimals to keep when transacting in this UOM. `0` for whole units (EA, BOX), `3` for weight, `2` for currency. |
| Active | No | Defaults to true. Uncheck to hide the UOM from new item pickers while keeping it on existing item cards. |

## Decimals (why it matters)

The decimals value is used by:

- The line UOM picker when posting a Sales Invoice, Purchase Invoice, or inventory movement.
- Stock-level rollups and report-time inventory valuation.
- Document print and PDF generation.

Picking a value that matches the unit's physical precision (e.g. `0` for `BOX`, `2` for `KG`) prevents rounding surprises when posting.

## Editing vs. adding

The form is the same in both modes, but the heading and the primary button label change so you can never confuse the two:

- **Add a new UOM** heading + **Add new UOM** button — no row is highlighted, the form is empty.
- **Edit UOM** heading + **Save changes** button + a **Cancel edit** shortcut — the row you're editing is highlighted in amber.

Switching modes does not lose data from the other mode (the new-UOM draft and the edit draft are kept in the same state until you actually save or cancel).

## Feedback

Every save and load outcome emits a toast in the bottom-right corner:

- `UOM added` / `UOM updated` on success.
- `Failed to load units of measure` on a load error.
- `Failed to save UOM` on a save error, with the backend's message when available.

## Permissions

- `inventory.uom.manage` — required to add or edit a UOM.

## Related

- [Inventory Items Page](../../inventory/inventory-items-page.md) — uses base UOM + item-level conversion factors.
- [Item UOM Conversions](../../inventory/item-uom-conversion.md) — how items map alternate UOMs back to the base UOM.
# Translated unit names

Each UOM has a stable code and a default name. English, Arabic, and Turkish
localized names can be entered on the UOM page. The code does not change when
the application language changes; only the displayed name changes. If a
translation is empty, the default name is shown.

Once a conversion factor has been used in a posted stock transaction, it cannot
be changed or deleted. Correct the source transaction through an approved
reversal workflow instead of rewriting the historical factor.
