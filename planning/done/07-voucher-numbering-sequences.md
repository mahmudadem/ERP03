# 07 - Voucher Numbering Sequences

- Added voucher sequence model, repository interface, and Firestore implementation with atomic transaction increments and custom formats.
- Integrated sequence generation into CreateVoucherUseCase (prefix + optional annual reset via settings; falls back if disabled).
- Added voucher sequence use cases, controller, and routes (`/tenant/accounting/voucher-sequences`, set next).
- Settings UI: new “Voucher Numbering” tab to view sequences and set next number; API client functions added.
- Tests: VoucherSequence formatting/increment unit test; existing CostCenter test rerun and passing.
