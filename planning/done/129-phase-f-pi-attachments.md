# 129 - Phase F PI Attachments

Date: 2026-05-28  
Branch: `codex/phase-f-pi-attachments`  
Scope: Purchases module, Phase F parity

## Summary

Purchase Invoices now support tenant-scoped attachments for vendor bill scans and supporting evidence. Users can queue files while entering a new PI, then the files upload automatically after the PI is saved and receives its document ID. The implementation mirrors the Sales Invoice attachment model while preserving the accounting boundary: attachments are evidence only and never affect posting amounts, AP, tax, inventory valuation, or payment status.

## Technical Developer View

### What changed

- Added `PurchaseInvoiceAttachment` metadata to the Purchase Invoice domain model.
- Added attachment metadata to Purchase Invoice DTO/API contracts.
- Added tenant-scoped Purchase Invoice attachment controller:
  - list
  - upload
  - signed download link
  - remove
- Added Purchase attachment routes under `/tenant/purchase/invoices/:id/attachments`.
- Extended Prisma schema/repository mapping with `attachments Json?`.
- Added frontend Purchases API methods for attachment operations.
- Added an Attachments panel to `PurchaseInvoiceDetailPage` for both new and saved PIs.
- Added client-side pending attachment queue for unsaved PIs; queued files upload after Save Draft or Save & Post creates the PI.
- Added `ConfirmDialog` before removal and visible success/error feedback for upload/remove/open failures.
- Updated Purchases architecture and user docs.

### Files changed

- `backend/src/domain/purchases/entities/PurchaseInvoice.ts`
- `backend/src/api/dtos/PurchaseDTOs.ts`
- `backend/src/api/controllers/purchases/PurchaseInvoiceAttachmentController.ts`
- `backend/src/api/routes/purchases.routes.ts`
- `backend/src/infrastructure/prisma/repositories/purchases/PrismaPurchaseInvoiceRepository.ts`
- `backend/prisma/schema.prisma`
- `frontend/src/api/purchasesApi.ts`
- `frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/purchases.md`
- `docs/user-guide/purchases/README.md`
- `docs/user-guide/purchases/purchase-invoice-attachments.md`

### Accounting and controls impact

- Vendor bill evidence can now stay attached to the PI document.
- Files are scoped by authenticated company context and stored under the tenant path.
- Signed links are generated server-side and short-lived.
- Removing an attachment requires confirmation.
- Attachment metadata is separate from posting inputs, so no ledger or inventory behavior changes.

## End-User View

Users can attach supporting files such as vendor bill scans, delivery evidence, or spreadsheets while entering a new Purchase Invoice or after opening a saved invoice. For a new PI, the files are queued locally and uploaded automatically when the PI is saved. The file list appears on the invoice page with Open and Remove actions. This helps accountants and managers review bill evidence without changing any financial figures.

## Verification

- `npm --prefix backend run build` passed.
- `npm --prefix frontend run typecheck` passed.

## Manual QA Script

Pre-req: logged in as a user with Purchases access.

1. Open `Purchases -> Invoices -> New`.
2. Fill the minimum required PI fields.
3. Upload a small PDF before saving.
4. Expected: the file appears as queued in the Attachments section.
5. Click `Save Draft` or `Save & Post`.
6. Expected: the PI saves, queued files upload automatically, and the saved invoice shows the uploaded attachment.
7. Open `Purchases -> Invoices` and open a saved Purchase Invoice.
8. Upload another small PDF.
9. Confirm the file appears in the Attachments section.
10. Click `Open`.
11. Confirm the file opens in a new tab from a signed link.
12. Upload valid PNG/JPG/DOCX/XLSX files until the invoice has 5 attachments.
13. Try a 6th file.
14. Expected: upload is rejected.
15. Try a file larger than 10 MB.
16. Expected: upload is rejected.
17. Try a disallowed file such as `.zip`.
18. Expected: upload is rejected.
19. Click `Remove` on one attachment.
20. Confirm the dialog.
21. Reload the invoice.
22. Expected: removed attachment stays removed.

## Follow-ups

- Continue Phase F parity with Vendor Groups, Purchase Price Lists, then RFQ.
