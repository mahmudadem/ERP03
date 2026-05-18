# Opening Stock Documents

## 1. Final Supported Behavior

- Opening Stock is implemented as an `Opening Stock Document`, not as a purchase, GRN, or purchase invoice.
- Unlimited Opening Stock Documents are supported.
- Only active stock-tracked inventory items are eligible for selection.
- Each document requires a warehouse and one or more lines with quantity greater than zero.
- Posting creates inventory `IN` movement(s) with Opening reference semantics for the selected stock items.
- Documents support `DRAFT` and `POSTED` states.

## 2. Accounting vs Inventory-Only Rules

- When the Accounting module is disabled, Opening Stock Documents are inventory-only and create no accounting entry.
- When the Accounting module is enabled, each document can be posted either as:
  - `Inventory only`
  - `Inventory + Accounting`
- If `Inventory + Accounting` is selected:
  - required accounts are validated before posting
  - debit goes to Inventory Asset
  - credit goes to the selected Opening Balance / Clearing account
  - the accounting entry is created through the existing voucher posting engine
- If `Inventory only` is selected while Accounting is enabled:
  - posting is still allowed
  - the user is warned clearly that stock changes will occur without accounting impact
  - no voucher, journal, or ledger effect is created

## 3. Posted Document Immutability Rule

- `DRAFT` documents are editable and deletable.
- `POSTED` documents are non-editable and non-deletable.
- Corrections to posted Opening Stock must not happen by direct edit.
- Corrections should be handled through reversal, cancellation workflow when implemented, or inventory adjustment / accounting correction according to the business case.

## 4. Known Limitations

- There is no dedicated document-level reversal or cancellation workflow yet.
- Inventory-only posting while Accounting is enabled is controlled by warning/confirmation, not by a separate RBAC permission.
- Voucher classification currently uses `OPENING_BALANCE` with inventory source metadata, so reporting separation depends on source metadata/reference, not on a dedicated voucher type.
- Duplicate detection is warning-only in the UI and is currently based on same warehouse, same document date, and overlapping items.

## 5. Future Enhancements

- Add a document-level reversal / cancellation workflow for posted Opening Stock Documents.
- Add dedicated RBAC for inventory-only posting when Accounting is enabled.
- Add a dedicated inventory opening voucher type if later reporting requires stricter type-level separation from other opening balances.
