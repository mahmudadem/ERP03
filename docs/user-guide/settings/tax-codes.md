# Tax Codes

Tax codes define how the system calculates tax on sales and purchase documents.

## Create A Tax Code

1. Open **Settings -> Tax Codes**.
2. Click **New Tax Code**.
3. Enter the code, name, rate, type, scope, tax accounts, and status.
4. Enter **Rate %** as a normal percentage. For example, type `10` for 10%.
5. Choose **Price Basis**:
   - **Exclusive**: tax is added on top of the price.
   - **Inclusive**: the entered price already includes tax.
6. Choose **Purchase Tax Treatment**:
   - **Recoverable**: purchase tax is posted separately to the purchase tax account.
   - **Non-recoverable**: purchase tax is included in item or expense cost.
7. Save the tax code.

## Edit A Tax Code

Use **Edit** from the list. The list shows the current rate, scope, price basis, status, and whether the code is locked.

If a tax code has already been used in a posted document, accounting-critical fields are locked. You can still change the display name or active status, but you cannot change the tax rate, price basis, purchase tax treatment, tax type, scope, or tax accounts.

If the tax treatment needs to change after use, create a new tax code instead of changing the old one.

## Purchase Tax Treatment

Use **Recoverable** when the purchase tax is claimable from the tax authority. The bill posts tax separately and inventory or expense cost stays net of tax.

Use **Non-recoverable** when the tax is part of what the item or expense really costs you. The bill posts no separate purchase tax line; the tax amount is included in inventory or expense cost.

Price Basis and Purchase Tax Treatment are separate:

- **Exclusive + Recoverable:** price 1200 with 10% tax creates AP 1320, cost 1200, tax 120.
- **Exclusive + Non-recoverable:** price 1200 with 10% tax creates AP 1320, cost 1320, no separate tax.
- **Inclusive + Recoverable:** price 1200 with 10% tax creates AP 1200, cost 1090.91, tax 109.09.
- **Inclusive + Non-recoverable:** price 1200 with 10% tax creates AP 1200, cost 1200, no separate tax.
