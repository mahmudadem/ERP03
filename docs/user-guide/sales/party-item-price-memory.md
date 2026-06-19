# Party and Item Price Memory

ERP03 can remember the last real price used for each customer or vendor and item. This helps new invoices start with the price the business actually used before, while still letting the user override the line price.

## What Is Remembered

The system stores three kinds of price/cost information:

| Type | Meaning |
|---|---|
| Last for this party | Last price sold to this customer, or last cost bought from this vendor, for this item. |
| Last event | Last price sold or bought for this item with anyone. |
| Average cost | One moving-average cost for the item, in the company/base stock UOM. This is cost only, not a selling-price average. |

Prices are remembered separately by currency and UOM. For example, USD per box and USD per piece are separate records, and SYP and USD records do not overwrite each other.

## How a New Line Gets a Price

When you choose a customer/vendor, item, document currency, and UOM, ERP03 uses one configured price source. It does not try other sources if the selected source has no price.

The current default is **Last price for this customer/vendor and item**. That means:

- Returning customer/vendor with a remembered price: ERP03 fills the line price.
- New customer/vendor with no remembered price: ERP03 leaves the line blank.
- Another customer/vendor used this item before: ERP03 still leaves the line blank, because it does not borrow prices from other parties.

Other policies can use a price list or item default price, but each policy is strict. If the selected source has no matching price, the line stays blank for manual entry.

If there is no remembered price in the document currency, ERP03 leaves the line blank. It does not convert prices between currencies because prices are negotiated facts, not accounting rates.

## UOM Behavior

By default, ERP03 only uses an exact currency and UOM match. If the last customer price was USD per box and the new line is USD per piece, the line stays blank unless cross-UOM derivation is enabled.

Admins can enable this in:

- `Sales Settings -> Sales Policy -> Derive remembered prices across UOM`
- `Purchase Settings -> Procurement Policy -> Derive remembered prices across UOM`

When enabled, ERP03 may derive a same-party, same-currency price across UOMs using the item conversion factor. Example: a box price of 10 USD and 1 box = 4 units can default a unit price of 2.5 USD. The user can still override it.

## Cost Behavior

Cost behaves differently from price. Average cost is always one base-cost value, and ERP03 derives it for the document currency and UOM when needed. The company inventory setting `inventoryFxCostBasis` controls how foreign-currency average cost is shown:

- `REPLACEMENT` (default): use stable-currency replacement cost behavior for volatile base currencies.
- `HISTORICAL`: use recorded base average divided by the document rate.

## When Memory Updates

Price memory updates when these documents are posted:

- Sales Invoice
- Sales Return
- Purchase Invoice
- Purchase Return

The remembered price is saved in the same posting transaction as the document, so it updates only when the posting succeeds.

## Practical Examples

- Sell item A to customer X in USD per box at 10. The next USD-per-box invoice for customer X defaults to 10.
- Sell item A to customer X in SYP per piece later. ERP03 keeps the SYP-per-piece record separately from USD-per-box.
- Buy item B from vendor V in USD at 7.25. The next USD purchase invoice for vendor V and item B defaults to 7.25.
- Create an EUR document when no EUR price was ever used. ERP03 leaves the price blank; the typed EUR price becomes the first EUR memory after posting.
