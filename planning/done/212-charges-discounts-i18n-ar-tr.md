# 212 — Charges & Discounts i18n (Arabic + Turkish)

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** i18n / polish (frontend) — completes reports 209 (SI) and 210 (PI)

## Problem

The SI and PI allocation-grid charges/discounts UI (reports 209, 210) shipped with inline
`t(key, 'English fallback')` calls, so it rendered English even in Arabic/Turkish. Additionally,
`sales.invoiceDetail.charges` existed in `common.json` as a **leaf string** (`"Charges / Additions"`)
while the new code treats `charges` as a **namespace** — functional via fallback, but fragile. (That
old leaf string was confirmed **unreferenced** anywhere in the code before converting it.)

## What was done

Added the full set of charge/discount/allocation keys to **en / ar / tr** `common.json` under
`sales.invoiceDetail.charges`, `sales.invoiceDetail.allocation`, `purchases.invoiceDetail.charges`,
and `purchases.invoiceDetail.allocation` — ~26 keys per module, per language. Done via a one-off
deterministic Node merge script (then deleted) to guarantee valid JSON and avoid hand-edit errors.

Covered: type tags (Charge/Discount), Add/Edit Charge/Discount buttons, edit/remove, column headers
(Type/Description/GL Account/Amount), modal labels + placeholders + the debit/credit hint, empty-state
title/description, default-account labels, and the allocation-grid titles. Purchases strings use
expense-account language and flip the hint ("Charge debits this account; discount credits it").

## Verification

- JSON validated programmatically for all 3 languages (keys resolve, e.g. ar `إضافة رسم`, tr `Ücret Ekle`).
- Frontend production build: ✅ (locale bundling clean).
- No code/posting changes — UI strings only.

## Notes

- Translations cover standard accounting/UI terms; longer hint sentences are informational.
- The old unreferenced `"Charges / Additions"` leaf was replaced by the namespace (safe — no references).
