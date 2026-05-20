# Promotions

Promotions let you set up rules that automatically calculate free-goods entitlements or volume discounts. Instead of remembering to apply a deal manually on every order, you define the rule once and the system works out what the customer is entitled to when you check the order or invoice against it.

---

## The two promotion types

### Buy X Get Y free

The customer buys a certain quantity of an item and receives a number of units free. The free units can be the same item or a different one.

**Example:** Buy 3 units of Widget A, get 1 unit of Widget A free.

The system calculates how many free units the customer qualifies for based on how many they ordered:
- Order 3 → 1 free
- Order 6 → 2 free
- Order 7 → 2 free (only complete multiples of 3 count)

### Threshold discount

The customer receives a percentage discount on a line when they reach a minimum quantity or minimum order amount.

**Example:** Order 10 or more of any item in the Accessories category and receive 10% off those lines.

---

## Creating a promotion rule

1. Go to **Sales → Promotions**
2. Click **New Promotion**
3. Fill in the basic details:
   - **Name** — a label you will recognize, for example "Summer Buy 3 Get 1" or "Volume 10% Off"
   - **Status** — set to **Active** to make the rule available; set to **Inactive** to pause it without deleting it
   - **Valid from / Valid to** — optional date window. Leave blank for a rule with no expiry. Set both dates for a campaign that should switch off automatically
   - **Priority** — a number (lower = higher priority). When multiple rules could apply to the same line, the one with the lowest priority number fires first. Default is 0
4. Choose the **type**:

   **For Buy X Get Y:**
   - **Buy quantity** — the quantity the customer must purchase to trigger the deal
   - **Get quantity** — how many free units they receive
   - **Free item** — leave blank to give the same item free, or pick a different item

   **For Threshold Discount:**
   - **Threshold basis** — **Quantity** (based on units ordered) or **Amount** (based on the line value in document currency)
   - **Threshold value** — the number the line must reach or exceed
   - **Discount %** — the percentage off applied to the qualifying line

5. Set the **scope** — which items the rule applies to:
   - **All items** — every item on the order or invoice
   - **Specific items** — only items you pick from the item list
   - **Categories** — only items belonging to specific item categories

6. Save

---

## How to use promotions on an order or invoice

Promotions are not applied automatically during order or invoice entry in the current version. To evaluate which promotions apply:

1. Build the order or invoice lines as normal (with quantities and prices)
2. Use the **Evaluate Promotions** action (available via the system or your administrator can call the evaluate endpoint)
3. Review the suggestions:
   - **Free goods suggestions** — show which lines qualify for free units and how many
   - **Line discount suggestions** — show which lines qualify for a percentage discount and what the rate is
4. Apply the suggestions manually: add a free-goods line at zero price, or apply the discount percentage to the relevant line

This gives you full visibility and control before committing to the document.

---

## How manual discounts interact with promotions

If you have already entered a discount on a line yourself (a manual discount), the system will **not** suggest an automatic threshold discount on top of it. Your manual discount takes priority.

This means:
- you negotiated a special rate → the system respects it and does not override it with a campaign discount
- the customer did not get a manual discount → the system can suggest the threshold discount if the rule applies

**Important:** Free-goods (Buy X Get Y) suggestions are not affected by this rule. A line can still qualify for free goods even if it already has a manual discount.

---

## Deactivating or pausing a promotion

To stop a promotion from being suggested without deleting it:

1. Open the promotion rule
2. Change the **Status** to **Inactive**
3. Save

Inactive rules are ignored by the evaluation engine. You can reactivate them at any time.

Alternatively, set a **Valid to** date — the rule will switch off automatically after that date.

---

## Common questions

**Can one order line receive both a free-goods deal and a discount?**
Yes. The two mechanics are independent. A line that qualifies for both a Buy X Get Y rule and a threshold discount rule can receive both suggestions.

**Can two different Buy X Get Y rules fire on the same line?**
No. For each mechanic (free goods or discount), only the first matching rule in priority order fires per line. If Rule A (priority 0) fires for a line, Rule B (priority 1) is skipped for that line's free-goods calculation, even if the customer also qualifies for it.

**The promotion dates have passed but it is still showing in the list.**
If Status is still Active and the Valid to date is in the past, the rule will not fire (the evaluator checks the date window). You can set it to Inactive to keep the list tidy.

**Do promotions apply to quotations?**
Not automatically. You can manually evaluate promotions against a quotation's lines if needed, then adjust the quoted prices before sending.

**Will past invoices change if I edit a promotion rule?**
No. Posted invoices are not affected by later changes to promotion rules. Only new evaluations use the updated rule.
