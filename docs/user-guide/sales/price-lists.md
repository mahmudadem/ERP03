# Price Lists

A price list is a catalog of agreed prices for your items. Instead of typing a price on every invoice, you set prices once in a price list and the system fills them in automatically when you create an invoice.

---

## What a price list is for

A price list lets you:

- set a standard unit price for each item
- offer lower prices when a customer orders a larger quantity (quantity breaks)
- limit a price list to a date range — for example, a promotional price that only applies during a campaign
- assign different prices to different customer groups or individual customers

---

## Creating a price list

1. Go to **Sales → Price Lists**
2. Click **New Price List**
3. Fill in:
   - **Name** — a label you will recognize, for example "Standard USD" or "Wholesale EUR"
   - **Currency** — the currency these prices are in (three-letter code, e.g. USD, EUR, GBP)
   - **Valid from / Valid to** — optional. Leave blank for a price list with no expiry. Set both dates for a time-limited promotion
   - **Status** — set to Active to make the list available for invoicing
   - **Default for this currency** — tick this if you want the system to use this list automatically for all customers who pay in this currency and do not have their own price list assigned
4. Add price lines in the **Lines** section:
   - Choose an item
   - Enter the minimum quantity for this price (use 1 for the base price)
   - Enter the unit price
   - Optionally enter a discount percentage
5. Save

---

## How quantity-break (tiered) pricing works

You can add multiple lines for the same item, each with a different minimum quantity and unit price. The system automatically picks the best price the customer qualifies for based on the quantity they ordered.

**Example:**

| Minimum quantity | Unit price |
|-----------------|------------|
| 1 (and above)   | 100.00     |
| 10 (and above)  | 90.00      |
| 50 (and above)  | 80.00      |

- Customer orders 5 units → price is **100.00**
- Customer orders 10 units → price is **90.00**
- Customer orders 49 units → price is **90.00**
- Customer orders 50 units → price is **80.00**

The system always picks the row with the highest minimum quantity that the actual order quantity meets or exceeds.

---

## Setting a default price list

Every currency can have one default price list. When a customer's invoice is in that currency and the customer does not have a personal price list assigned, the system falls back to the currency default.

To set a price list as the default:
- Open or create the price list
- Tick **Default for this currency**
- Save

The system will automatically remove the "default" flag from the previous default list for that currency.

---

## Assigning a price list to a specific customer

Individual customers can have their own price list that overrides the currency default.

1. Open the customer record (Sales → Customers → select customer)
2. Go to the **Commercial** tab
3. Choose a price list in the **Default Price List** field
4. Save

When the system looks up a price for this customer, it will use their assigned list first, before falling back to the currency default.

---

## How the system auto-fills prices on invoices

When the company's line-price policy is set to **Price List**, editing a sales invoice line and choosing an item/quantity makes ERP03 look up the best matching price from the relevant price list and fill it in. You can still change the price manually if needed.

If no price list applies (no customer-specific list and no currency default, or the item is not on any list), the price field stays empty and you enter it manually. ERP03 does not fall back to remembered customer prices or item defaults when the policy is Price List.

---

## Date-limited price lists

If you want a promotion to expire automatically:

1. Create (or edit) the price list
2. Set **Valid from** to the first day of the promotion
3. Set **Valid to** to the last day of the promotion
4. Make sure Status is **Active**

After the Valid to date passes, the list stops being used for new invoices. Invoices already created are not affected.

---

## Common questions

**Can I have multiple price lists in the same currency?**
Yes. Only one can be the default, but you can assign any list directly to a customer.

**Can one item appear more than once on a price list?**
Yes — as long as each row has a different minimum quantity. This is how tiered pricing works.

**What if the price list is Inactive?**
An inactive list is ignored. Customers assigned to it will get no auto-price and must enter prices manually.

**Does changing a price list affect invoices already posted?**
No. Posted invoices snapshot the price at the time they were created.
