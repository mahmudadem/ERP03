# Line Price Source Selection

ERP03 can suggest a line price from different sources. On draft sales and purchase documents, use **Line price source** in the header to choose how item prices are suggested.

## Available Sources

| Source | What it means |
|---|---|
| Last party price | Use the last price for this same customer/vendor and item. |
| Price list | Use the party's assigned price list, or the default active list for the document currency. |
| Last sale/purchase | Use the last sale or purchase event for this item with anyone. |
| Item default | Use the default sale or purchase price on the item card. |

The selection is strict. If the selected source has no price for the item, currency, and UOM, ERP03 leaves the line price for manual entry instead of trying another source.

## Party Price Lists

Customer and vendor master cards have **Default Price List** on the Commercial tab. When a party has a price list and the document source is **Price list**, the document uses that party list first. If the party has no list, ERP03 checks the active default price list for the document currency.

## Where It Appears

- Sales Invoice drafts
- Purchase Invoice drafts
- Purchase Order drafts
- Forms Designer-rendered sales/purchase line tables

Changing the source refreshes existing item lines where a matching price is available. Users can still type a manual line price.
