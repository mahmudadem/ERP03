# Task 43: Voucher Data Contract Mismatch

## Description
There is an inconsistency (data contract mismatch) between the frontend forms (Voucher Types / Forms) and what the backend expects when saving or cloning a voucher. 

Specifically, in the **Sales Invoice**, the frontend table is providing a field called `quantity`, but the backend expects `invoicedQuantity`.

This mismatch causes failures when saving or cloning vouchers because the backend and frontend are not speaking the same language for the payload.

## Suspected Root Cause
- The dynamic `Voucher Form` (or `Voucher Type`) configuration in the frontend generates a `quantity` field for line items.
- The backend domain models or validation schemas strictly require `invoicedQuantity` for sales invoice line items.
- When a voucher is cloned or saved, this discrepancy results in a missing or invalid field.

## Required Action (Contract Definition)
We need to establish a strict **Data Contract** between the frontend and backend for all semantic voucher types (Sales Invoices, Purchase Invoices, etc.).

1. **Audit Line Item Fields:** Review `frontend` forms configuration (specifically the line items grid) and `backend` DTOs/Validation rules for Vouchers.
2. **Normalize Field Names:** Ensure that fields like `quantity` vs `invoicedQuantity` are standardized. If the backend needs `invoicedQuantity`, the frontend configuration (or mapping layer) must output `invoicedQuantity`.
3. **Mapping Layer (Optional):** If the frontend Form Designer uses a generic `quantity` field across all modules, implement a mapping layer before the payload is sent to the backend, or standardize the backend to accept a generic `quantity` based on context.
4. **Testing:** Clone and save a Sales Invoice to confirm the mismatch is resolved.
