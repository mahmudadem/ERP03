# Sales Returns (Credit Note vs Refund)

This guide explains how to create and post Sales Returns, including when to use **Credit Note** vs **Refund**, how to apply **restocking fees**, and how to classify the return reason.

## Return Types

You can create three return contexts:

1. **After Invoice (`AFTER_INVOICE`)**
   Use this when the customer was already invoiced.
2. **Before Invoice (`BEFORE_INVOICE`)**
   Use this when goods were delivered but not invoiced yet.
3. **Direct (`DIRECT`)**
   Standalone return not linked to a posted invoice or delivery note.

## Settlement Mode

When creating a return that has invoice-value impact (`AFTER_INVOICE` or `DIRECT`), choose:

1. **Credit Note**
   Customer gets credit on account (reduces receivable balance).
2. **Refund**
   System posts a refund settlement entry using configured Sales payment settlement accounts.

For `BEFORE_INVOICE` returns, settlement mode and restocking fee should generally remain neutral because no invoice value is being reversed.

## Reason Classification

Every return has:

1. **Reason Code** (structured category):
   - `DEFECTIVE`
   - `WRONG_ITEM`
   - `CHANGED_MIND`
   - `OTHER`
2. **Reason** (free-text explanation)

Use both fields together for accurate reporting and auditability.

## Restocking Fee

If needed, apply a restocking fee:

1. Set **Restocking Fee Type**:
   - `AMOUNT`
   - `PERCENT`
2. Enter **Restocking Fee Value**.

Rules:

1. Fee must be non-negative.
2. Percent fee cannot exceed 100.
3. Fee cannot exceed return grand total.
4. `BEFORE_INVOICE` returns should not use restocking fees.

The system calculates:

1. `restockingFeeAmount`
2. `netSettlementAmount` = return total - restocking fee

## Posting Outcome Summary

1. **After Invoice + Credit Note**
   Reverses return value and reduces the linked invoice outstanding by net settlement.
2. **After Invoice + Refund**
   Reverses return value and posts refund settlement; linked invoice outstanding is not auto-reduced by this step.
3. **Before Invoice**
   Reverses stock/COGS side only (no revenue/AR reversal because invoice does not exist).

## Quick Steps

1. Go to `Sales -> Returns -> New Return`.
2. Choose return context (`After Invoice`, `Before Invoice`, or `Direct Return`).
3. Select source document/customer as required.
4. Enter return date, reason code, reason text.
5. Choose settlement mode and optional restocking fee (when applicable).
6. Create draft and review.
7. Click **Post Return**.
8. Use **GL Impact** and **History** to review accounting and audit trail.
