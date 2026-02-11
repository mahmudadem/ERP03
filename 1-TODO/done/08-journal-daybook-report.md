# 08 - Journal / Day Book Report

- Journal use case rewritten to group vouchers with full lines (date/type filters) using voucher + account repositories.
- Journal API returns voucher blocks with totals instead of GL entries.
- Frontend Journal page added with date/type filters, voucher blocks, totals, print-friendly layout, and voucher links; route wired.
- API client includes `getJournal`.
- Tests: Journal use case unit test; voucher sequence test rerun (passes).
