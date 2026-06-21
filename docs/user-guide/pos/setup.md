# POS — Setup Guide

POS = Point of Sale. This guide covers **Phase 0** (settings + registers). Shifts, selling, and returns are added in later phases.

## Before you start

POS lives behind the `pos` module entitlement. The bundle the company was created with must include `pos` (otherwise the sidebar entry won't appear and the API will return 403 behind `companyModuleGuard('pos')`).

## Open POS settings

1. Sign in and pick the company.
2. From the sidebar, click **POS → Settings** (path `/pos/settings`).
3. The page opens on the **General** tab.

## General

- **Require an open shift to sell** — on (default). The cashier screen blocks sales when no shift is open on the register.
- **Allow POS direct sales** — off (default). When you turn it on, the backend creates a form-scoped governance rule that allows the `direct` persona for `formType 'pos_sale'`. This is the **only** supported way to enable POS direct sales — we never silently change the company's `workflowMode` or convert personas. A confirmation dialog appears so this stays an explicit decision.
- **Walk-in customer** — pick the company-level party used when no named customer is attached to a receipt.
- **Receipt number prefix** — default `R`. The receipt number is `{prefix}-{6-digit seq}`, e.g. `R-000001`.
- **Cash rounding** — stored now, applied later. V1 only honors `none`.

Click **Save**. You should see a success toast.

## Payment methods

Each row is one POS-side payment code mapped to a settlement account:

| Code | Allows change? | Requires reference? | Typical use |
|---|---|---|---|
| `CASH` | yes | no | Walk-in cash |
| `CARD` | no | yes (last 4, approval) | Card terminal |
| `BANK_TRANSFER` | no | yes (bank ref) | Bank-app transfers |
| `CUSTOM` | no | optional | Loyalty, voucher, etc. |

- **Settlement account** is the GL account that the receipt voucher Dr-side uses for that tender.
- Saving with an enabled method whose settlement account is blank is rejected by the backend with a readable error.

## Cash over / short

When a cashier closes a shift, they enter the counted cash. The system computes:
```
expected_cash = opening_float + cash_sales − cash_refunds + pay_ins − pay_outs − drops
over_short = counted_cash − expected_cash
```

- **Cash over account** — credit account when `over_short > 0`.
- **Cash short account** — debit account when `over_short < 0`.

If the variance is non-zero and the appropriate account is missing, shift close is blocked with a readable error. (Phase 1 enforces this.)

## Registers

**POS → Registers** (`/pos/registers`).

- Click **New Register**.
- Fill in: code, name, branch (free text — there is no first-class Branch entity yet), warehouse, cash-drawer account.
- Save. The register appears in the list.
- Toggle a register to **INACTIVE** when you take it out of service. Already-open shifts on it remain open; new shifts cannot be opened.
- Edit an existing register to change its name, warehouse, branch, or cash-drawer account.

A register is required before cashiers can open shifts (Phase 1).

## Troubleshooting

- **Settings save fails with "Account not found for cashOverAccountId"** — you typed an account id that doesn't exist in the Chart of Accounts. Pick from the dropdown or leave it blank until you create the account.
- **Toggle "Allow POS direct sales" does nothing visible in the POS UI yet** — the rule is created server-side; the cashier screen that consumes it ships in Phase 2. You can verify via `GET /tenant/sales/settings` (look for `governanceRules` containing `formType:'pos_sale'`).
- **Sidebar doesn't show POS entries** — your company bundle doesn't include the POS module. Contact your platform admin.
