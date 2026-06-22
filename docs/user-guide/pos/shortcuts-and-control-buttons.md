# POS Shortcuts And Control Buttons

## What This Feature Does

POS shortcuts let you place common products on the cashier screen as buttons. You can group products, for example Drinks, Snacks, or Services.

Control buttons let you choose which POS actions appear on the terminal, such as Hold Sale, Recall Sale, Print Receipt, Reprint, Cash Payment, Card Payment, Return/Refund, and End Shift.

## Who Can Configure It

Users with POS settings permission can configure layouts from:

`POS -> Settings -> Layouts`

Cashiers use the configured buttons from the POS terminal.

## Product Shortcut Layouts

1. Open `POS -> Settings`.
2. Select the `Layouts` tab.
3. Create a product shortcut layout.
4. Select the layout.
5. Add a `GROUP` for a folder button, or an `ITEM` for a product button.
6. For item buttons, choose the item from the item selector and set the optional sort order.
7. Save the shortcut.

On the terminal, group buttons open their child buttons. Item buttons add the linked item to the cart.

## Control Button Layouts

1. Open `POS -> Settings`.
2. Select the `Layouts` tab.
3. Create a control button layout.
4. Select the layout.
5. Choose a command, zone, label, and sort order.
6. Save the control button.

The terminal shows active visible buttons in the configured zone.

## Print And Reprint

`Print Receipt` prepares the most recent completed receipt for printing.

`Reprint` prepares a duplicate copy and keeps the normal reprint controls. If reprints require manager approval in your POS policy, the backend enforces that before returning the reprint payload.

Receipt layout comes from the shared print-layout designer. If no saved POS receipt template exists yet, ERP03 uses the built-in default layout.

## Important Controls

Some buttons require permission. For example, Reprint, Return/Refund, Open Cash Drawer, and End Shift are protected actions. If the cashier does not have the required permission, the action is rejected.

This feature does not change sale posting, tax, inventory costing, settlement accounts, or accounting vouchers.
