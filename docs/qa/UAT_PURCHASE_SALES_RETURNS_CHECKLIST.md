# UAT Checklist - Purchase/Sales Posting and Returns

## Scope
- Purchase Invoice posting
- Purchase Return posting (AFTER_INVOICE and BEFORE_INVOICE)
- Sales Invoice posting
- Sales Return posting (AFTER_INVOICE and BEFORE_INVOICE)
- Accounting/stock atomicity behavior

## UAT Info
- Environment:
- Company:
- Tester:
- Test Date:
- Build/Branch:

## Required Setup (before execution)
| Key | Value |
|---|---|
| Base currency | `SYP` |
| Enabled currencies | `SYP`, `USD`, `EUR` |
| Inventory accounting method | `PERPETUAL` |
| Purchases setting | `requirePOForStockItems = true` |
| Sales setting | `requireSOForStockItems = true` |
| Global FX account | `exchangeGainLossAccountId` configured |
| Vendor | `vendor1` with AP account |
| Customer | `customer1` with AR account |
| Stock item | Inventory + COGS + Revenue accounts configured |
| Service item | Expense/Revenue accounts configured |

### Suggested FX rates
- `2026-04-05`: USD -> SYP = `795`
- `2026-04-06`: USD -> SYP = `810`

## Test Cases
| ID | Scenario | Steps | Expected Result | Status (Pass/Fail) | Notes |
|---|---|---|---|---|---|
| PI-01 | Purchase Invoice voucher type | Create and post PI for stock item | Voucher type is `PURCHASE_INVOICE`; voucher + ledger created |  |  |
| PI-02 | Controlled purchase qty guard | PO received qty = 5, post PI qty = 6 | Blocked with received-qty error; no voucher/ledger/stock side-effects |  |  |
| PR-01 | Purchase Return AFTER_INVOICE (same rate) | Return from posted PI with same FX rate | Voucher type `PURCHASE_RETURN`; stock `RETURN_OUT`; voucher balanced |  |  |
| PR-02 | Purchase Return AFTER_INVOICE (FX diff critical) | Original PI at 795, return 1 x 100 USD at 810 | AP line base = 81,000 SYP; FX diff line exists; voucher balanced |  |  |
| PR-03 | Purchase Return BEFORE_INVOICE | Return from posted GRN | Stock `RETURN_OUT`; no accounting voucher; PO received reduced |  |  |
| PR-04 | Return > invoiced guard | AFTER_INVOICE return qty > invoiced qty | Blocked; no voucher; no stock movement persisted |  |  |
| PR-05 | Return > received guard | BEFORE_INVOICE return qty > received qty | Blocked; no voucher; no stock movement persisted |  |  |
| PR-06 | FX account missing rollback | Remove exchange gain/loss account then post FX-diff return | Posting fails atomically; return stays DRAFT; no voucher/ledger/stock persistence |  |  |
| SI-01 | Sales Invoice voucher type(s) | Post SI for stock item | Revenue voucher type `SALES_INVOICE`; COGS voucher created in perpetual |  |  |
| SI-02 | Controlled sales qty guard | SO delivered qty = 5, post SI qty = 6 | Blocked with delivered-qty error; no accounting side-effects |  |  |
| SR-01 | Sales Return AFTER_INVOICE | Return from posted SI | Revenue reversal voucher type `SALES_RETURN`; COGS reversal (perpetual); stock `RETURN_IN` |  |  |
| SR-02 | Sales Return BEFORE_INVOICE | Return from posted DN | No revenue voucher; stock `RETURN_IN`; SO delivered reduced |  |  |

## Evidence Checklist (per case)
- Source document screenshot
- Voucher header + lines screenshot (if voucher expected)
- Account statement screenshot (AP/AR cases)
- Stock movement screenshot (stock-impact cases)
- Error screenshot (negative tests)

## Critical Acceptance Rules
1. No posting outside accounting module.
2. Voucher types must match business document type.
3. Vouchers must be balanced in all successful postings.
4. Any failed posting must not leave partial stock/accounting effects.

## UAT Summary
- Total Cases:
- Passed:
- Failed:
- Blocked:
- Major Defects:
- Recommendation: `Go` / `No-Go`

## Sign-off
- QA Lead:
- Finance Owner:
- Product Owner:
- Date:

