# POS Shortcuts And Control Buttons

## What This Feature Does

POS shortcuts let you place common products on the cashier screen as buttons. You can group products, for example Drinks, Snacks, or Services.

Control buttons let you choose which POS actions appear on the terminal, such as Hold Sale, Recall Sale, Print Receipt, Reprint, Cash Payment, Card Payment, Return/Refund, and End Shift.

## Who Can Configure It

Users with POS settings permission can configure product shortcuts from:

`POS -> Shortcuts`

Cashiers use the configured buttons from the POS terminal.

## Product Shortcut Layouts

1. Open `POS -> Shortcuts`.
2. Create or select a terminal layout.
3. Click `Use on terminal` so the selected layout becomes the active default layout.
4. Add groups such as Drinks, Food, or Services.
5. Select a group, or select Root buttons.
6. Search items and tick multiple items.
7. Click `Add selected` to create item buttons in the selected group.

Use Edit on a group or item button to rename it, change sort order, activate it, or disable it. On the terminal, group buttons open their child buttons. Item buttons add the linked item to the cart.

## Control Button Layouts

1. Open `POS -> Settings`.
2. Select the `Layouts` tab.
3. Create a control button layout.
4. Select the layout.
5. Choose a command, zone, label, and sort order.
6. Save the control button.

The terminal shows active visible buttons in the configured zone. Product shortcuts are configured from `POS -> Shortcuts`; control buttons remain part of POS layout settings.

## Print And Reprint

`Print Receipt` prepares the most recent completed receipt for printing.

`Reprint` prepares a duplicate copy and keeps the normal reprint controls. If reprints require manager approval in your POS policy, the backend enforces that before returning the reprint payload.

Receipt layout comes from the shared print-layout designer. If no saved POS receipt template exists yet, ERP03 uses the built-in default layout.

## Important Controls

Some buttons require permission. For example, Reprint, Return/Refund, Open Cash Drawer, and End Shift are protected actions. If the cashier does not have the required permission, the action is rejected.

This feature does not change sale posting, tax, inventory costing, settlement accounts, or accounting vouchers.
