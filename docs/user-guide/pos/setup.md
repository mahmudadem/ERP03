# POS — Setup Guide

POS = Point of Sale. This guide covers the settings and register setup needed before cashiers can open shifts, sell, and process returns.

## Before you start

POS lives behind the `pos` module entitlement. The bundle the company was created with must include `pos` (otherwise the sidebar entry won't appear and the API will return 403 behind `companyModuleGuard('pos')`).

## Open POS settings

1. Sign in and pick the company.
2. From the sidebar, click **POS → Settings** (path `/pos/settings`).
3. The page opens on the **General** tab.

## General

- **Require an open shift to sell** — on (default). The cashier screen blocks sales when no shift is open on the register.
- **Allow POS direct sales** — off (default). When you turn it on, POS policy allows the terminal to post POS direct sales through the shared inventory and accounting engines. This is the only supported way to enable POS direct sales.
- **Walk-in customer** — pick the company-level party used when no named customer is attached to a receipt.
- **Receipt number prefix** — default `R`. The receipt number is `{prefix}-{6-digit seq}`, e.g. `R-000001`.
- **Cash rounding** — choose `none`, nearest `0.05`, or nearest `1`. When enabled, the terminal rounds the payable cash total and posts the difference to the configured cash over/short account.
- **Negative stock at the till** — `Block` (default) or `Allow`. **Block** stops the terminal from selling more of an item than is on hand in the register's warehouse, even if your company allows negative stock elsewhere (e.g. for back-office invoices). The cashier is stopped before tendering, with a message naming the item and warehouse. **Allow** defers to the company-level inventory setting instead. Because the till hands goods over physically, Block is the recommended default; switch to Allow only if you deliberately sell ahead of stock receipts at the counter.

Click **Save**. You should see a success toast.

## Payment methods

Each row is one POS-side payment code and behavior rule:

| Code | Allows change? | Requires reference? | Typical use |
|---|---|---|---|
| `CASH` | yes | no | Walk-in cash |
| `CARD` | no | yes (last 4, approval) | Card terminal |
| `BANK_TRANSFER` | no | yes (bank ref) | Bank-app transfers |
| `CUSTOM` | no | optional | Loyalty, voucher, etc. |

- Enable only the methods this company accepts at the till.
- Set **Requires reference** for methods like card and bank transfer where the cashier must type an authorization or bank reference.
- Money routing is configured on each register, not here. CASH uses the register's cash-drawer account; CARD, BANK_TRANSFER, and CUSTOM use that register's settlement accounts.

## Cash over / short

When a cashier closes a shift, they enter the counted cash. The system computes:
```
expected_cash = opening_float + cash_sales − cash_refunds + pay_ins − pay_outs − drops
over_short = counted_cash − expected_cash
```

- **Cash over account** — credit account when `over_short > 0`.
- **Cash short account** — debit account when `over_short < 0`.

If the variance is non-zero and the appropriate account is missing, shift close is blocked with a readable error. (Phase 1 enforces this.)

The same accounts are also used for POS cash rounding at sale time: rounding up uses **Cash over**, and rounding down uses **Cash short**. If cash rounding is enabled and the required account is missing, the sale is blocked before posting.

## Registers

**POS → Registers** (`/pos/registers`).

- Click **New Register**.
- Fill in: code, name, branch (free text — there is no first-class Branch entity yet), warehouse, cash-drawer account.
- Optionally set a default price list id and hardware profile id. These are saved now for the next pricing-layout and hardware-device slices.
- Optionally select allowed cashiers. If no cashiers are selected, any cashier with POS access can open a shift on the register.
- Configure non-cash settlement accounts for CARD, BANK_TRANSFER, and CUSTOM if those methods are enabled at this register.
- Save. The register appears in the list.
- Toggle a register to **INACTIVE** when you take it out of service. Already-open shifts on it remain open; new shifts cannot be opened.
- Edit an existing register to change its name, warehouse, branch, or cash-drawer account.

A register is required before cashiers can open shifts (Phase 1).
If a register has allowed cashiers configured, other cashiers are blocked before the shift opens.

## Troubleshooting

- **Settings save fails with "Account not found for cashOverAccountId"** — you typed an account id that doesn't exist in the Chart of Accounts. Pick from the dropdown or leave it blank until you create the account.
- **Card or bank sale is blocked with "Configure ... settlement account on POS register ..."** — open **POS → Registers**, edit the active register, and set the missing non-cash settlement account.
- **Open shift is blocked with "Cashier is not allowed..."** — edit the register and add that user to the allowed cashiers list, or clear the list to allow all POS cashiers.
- **Sale is blocked after enabling cash rounding** — check that Cash over and Cash short accounts are configured in POS Settings.
- **Sale is blocked with "POS cannot sell … this would take stock below zero"** — the item doesn't have enough on hand in the register's warehouse and **Negative stock at the till** is set to `Block`. This is a **POS** setting and is independent of the company **Allow Negative Stock** inventory flag — turning that company flag on does **not** unblock the till. Receive or transfer stock into that warehouse, or (if you intend to sell ahead of receipts) change **Negative stock at the till** to `Allow` in POS Settings.
- **Sidebar doesn't show POS entries** — your company bundle doesn't include the POS module. Contact your platform admin.
