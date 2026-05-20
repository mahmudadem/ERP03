# Realized FX Gain / Loss on Settlement

**Last updated:** 2026-05-19
**Status:** Sales side wired in PR5 (`PostSalesInvoiceWithSettlementUseCase`). Purchases parallel path (`PurchaseReturnUseCases` already does FX; `PaymentSyncUseCases` follow-up) and frontend client wiring are deferred.

---

## Why this exists

When an invoice is denominated in a foreign currency, the value of the AR/AP balance changes as the exchange rate changes. If a EUR 1,000 invoice is booked at rate 10 (= EUR 1,000 / 10,000 base), and the customer later pays when the rate is 11, the company receives 11,000 base for an AR booked at 10,000 base — a **realized FX gain of 1,000 base**. The reverse is a realized FX loss.

Without explicit FX posting:
- Multi-currency AR/AP balances drift from reality
- P&L is wrong (gains hidden, losses hidden)
- Year-end revaluation impossible

PR5 adds the missing journal line.

## Trigger

The FX line is emitted on a settlement voucher when the settlement's exchange rate **differs from the invoice's exchange rate**. The caller signals this by populating `settlement.exchangeRate` (and `settlement.amountDoc` to disambiguate from amountBase) in the `SettlementRow` input.

If `settlement.exchangeRate` is absent OR equal to `invoice.exchangeRate`, the legacy two-line voucher is produced (no FX line). This keeps all existing single-currency flows untouched.

## Journal logic

Sales receipt (customer pays AR):

```
Dr  Cash / Bank        ← settlementAmountBase  (= amountDoc × paymentRate)
    Cr  Accounts Receivable    arAmountBase      (= amountDoc × invoiceRate)
    Cr  FX Gain                fxDiff            ← only if paymentRate > invoiceRate

Dr  Cash / Bank        ← settlementAmountBase
Dr  FX Loss            ← -fxDiff                 ← only if paymentRate < invoiceRate
    Cr  Accounts Receivable    arAmountBase
```

`fxDiff = settlementAmountBase - arAmountBase`. Positive = gain. Negative = loss (sign convention applies; the use case adds an absolute-value Dr line for the loss case).

The FX line carries `baseCurrency` as its document currency with exchangeRate=1, so it always lives in base. There is no documented amount on the FX line (`docAmount = 0`).

## Account resolution

The FX account is read from `SalesSettings.exchangeGainLossAccountId` (newly added in PR5 to mirror `PurchaseSettings.exchangeGainLossAccountId`). If unset when a settlement rate differs from invoice rate, posting throws `AccountMappingError` with `accountRole: 'fxGain'` or `'fxLoss'`. The error message points the user at the right setting.

The combined gain/loss account is sufficient for SMB books. Larger orgs may split it into two accounts (a Revenue-class "Realized FX Gain" and an Expense-class "Realized FX Loss") — that refinement is V2.

## What the caller must send

To trigger FX:

```ts
{
  settlementAccountId: 'cash-acct',
  amountBase: 11000,           // cash actually received (in base)
  amountDoc: 1000,              // 1,000 EUR being settled
  exchangeRate: 11,             // payment-date rate
  paymentMethod: 'BANK_TRANSFER',
  paymentDate: '2026-06-15',
  reference: 'WT-2026-06-15-789'
}
```

If `amountDoc` and `exchangeRate` are omitted, the system assumes payment was at invoice rate.

## What is wired today

| Path | FX support |
|---|---|
| `PostSalesInvoiceWithSettlementUseCase` (CASH_FULL / MULTI) | ✅ Implemented in PR5 |
| `RecordSalesInvoicePaymentUseCase` (separate payment recording) | ⏳ Same code shape; follow-up |
| `PurchaseReturnUseCases` (AR/AP reversals on returns) | ✅ Pre-existing (had its own FX handling) |
| Purchases `PaymentSyncUseCases` (vendor payments) | ⏳ Same pattern as sales; follow-up |
| Period-end unrealized FX revaluation | ❌ Deferred to V2 |
| Frontend client passing `exchangeRate` + `amountDoc` | ⏳ Backend supports it; frontend needs to send it |

## Tests

[`backend/src/tests/application/sales/FxGainLossSettlement.test.ts`](../../backend/src/tests/application/sales/FxGainLossSettlement.test.ts) — new in PR5. Covers:

1. Payment at invoice rate → 2-line voucher (no FX line; legacy path)
2. Payment at higher rate (gain) → 3-line voucher; Cr FX Gain
3. Payment at lower rate (loss) → 3-line voucher; Dr FX Loss
4. FX present but `exchangeGainLossAccountId` unset → `AccountMappingError`

## Frontend impact

The Sales Invoice payment dialog should expose two new fields when the invoice currency differs from the company base currency:
- **Payment exchange rate** (with a "use invoice rate" toggle)
- **Amount in invoice currency** (auto-fills from base × rate)

Until those are added, payments will continue posting at the invoice rate (no FX). This is incorrect for true FX scenarios but not destructive — it just understates realized P&L. The frontend follow-up should ship before the first multi-currency customer.

## See also

- [`docs/architecture/accounting.md`](./accounting.md) — base currency & ledger handling
- [`docs/architecture/posting-log.md`](./posting-log.md) — PostingLog records the warning for any FX-bearing settlement
