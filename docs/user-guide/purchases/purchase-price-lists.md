# Purchase Price Lists

Purchase Price Lists allow you to define currency-specific pricing agreements with your suppliers. When the company's line-price policy is set to **Price List**, purchase documents can automatically resolve the correct price based on the selected vendor, item, and order quantity.

## What price lists do

- Store vendor-specific pricing agreements.
- Automatically fetch unit prices for line items in Purchase Orders, Purchase Invoices, and Custom Purchase Forms.
- Support quantity breaks (volume discounts) through minimum quantity rules.
- Support multi-currency purchases.

## What price lists do not do

- They do not lock prices permanently; users can manually override the resolved price on a purchase line.
- They do not automatically post to the General Ledger.
- They do not fall back to remembered vendor prices or item defaults when the selected policy is Price List. If no list price matches, the line stays blank for manual entry.

## Create a Purchase Price List

1. Go to `Purchases -> Price Lists`.
2. Click `New Price List`.
3. Enter a price list name (e.g., `Standard Vendor Prices - USD`).
4. Select the **Currency** for this price list.
5. (Optional) Toggle **Set as default price list for this currency** if you want this list to apply to all vendors using this currency who do not have a specific price list assigned.
6. Click **Add Line** to enter price agreements:
   - Select an **Item**.
   - Enter a **Min Qty** (e.g., `0` for any quantity, or `100` for bulk pricing).
   - Enter the agreed **Unit Price**.
7. Click **Save**.

## Assign a vendor to a price list

To link a specific pricing agreement to a vendor:
1. Go to `Purchases -> Vendors`.
2. Open the vendor card and click **Edit**.
3. Under the **Commercial Terms** tab, locate the **Default Price List** field.
4. Select the price list from the dropdown.
5. Click **Save**.

## Delete a price list

You can delete a price list at any time. When you click delete, a confirmation dialog will ask you to verify the deletion. Existing purchase documents that were created using prices from this list will not be affected.
