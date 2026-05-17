# Feature 03: Document Sequences

## Overview
A concurrency-safe, prefix-based auto-numbering system for all ERP documents (POs, Invoices, Delivery Notes, Vouchers). Unifies and generalizes the existing `VoucherSequence` logic.

## Entities

### `DocumentSequence`
```typescript
{
  id: string; // Doc Type (e.g., 'PURCHASE_ORDER', 'SALES_INVOICE')
  companyId: string;
  prefix: string; // e.g., 'PO-'
  includeYear: boolean; // if true -> 'PO-2026-'
  currentNumber: number; // e.g., 145
  paddingChars: number; // e.g., 5 -> '00145'
  fiscalYear?: number; // Tracks when to reset
}
```

## Firestore Paths
- `companies/{companyId}/shared/Data/document_sequences`

## Services
- `DocumentSequenceService`
  - `generateNextNumber(companyId: string, documentType: string, date: Date): Promise<string>`
  - Uses Firestore `increment(1)` field value update to guarantee uniqueness under concurrency.
  - Handles fiscal year detection and reset logic automatically based on the passed date.

## API Routes
- `GET /api/shared/sequences`
- `PUT /api/shared/sequences/:type` (Update prefix/padding, block manual number change)

## Frontend Pages
- **Settings → Document Sequences:** Manage prefixes and padding for all modules.

## Architecture Note

> [!IMPORTANT]
> **Phase 1 (This Module):** Build `DocumentSequenceService` for NEW modules only (POs, Invoices, DNs, GRNs, Quotations, SOs). The existing `IVoucherSequenceRepository` continues to serve the Accounting module unchanged.
>
> **Phase 2 (Future Refactor):** Migrate `IVoucherSequenceRepository` to use `DocumentSequenceService` as its backing implementation. This avoids breaking existing voucher numbering while unifying the system.

The agent MUST NOT modify `IVoucherSequenceRepository`, `CreateVoucherUseCase`, or any existing accounting sequence logic as part of this feature.

## Verification
- [ ] Concurrent requests for the same sequence type yield unique, sequential numbers.
- [ ] If `includeYear` is true, switching from Dec 31 to Jan 1 resets the `currentNumber` to 1.
- [ ] Existing voucher numbering in accounting module continues to work unchanged.
