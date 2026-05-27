# 119 — Phase D.6 Invoice Attachments

Date: 2026-05-23  
Branch: `feat/phase-a-sales-master-data`  
Scope: Sales module (D.6)

## Summary

Phase D.6 is implemented for **Sales Invoices** with tenant-scoped file storage, per-invoice attachment metadata, and full UI operations (upload/list/open/remove).

## Technical Developer View

### What changed

- Added Sales invoice attachment backend controller:
  - `backend/src/api/controllers/sales/SalesInvoiceAttachmentController.ts`
- Added Sales attachment routes:
  - `backend/src/api/routes/sales.routes.ts`
- Extended Sales invoice domain model:
  - `backend/src/domain/sales/entities/SalesInvoice.ts`
- Extended Sales DTO mapping:
  - `backend/src/api/dtos/SalesDTOs.ts`
- Extended frontend Sales API client:
  - `frontend/src/api/salesApi.ts`
- Added Sales invoice detail attachments UI:
  - `frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx`
- Added i18n keys for attachment UX:
  - `frontend/src/locales/en/common.json`
  - `frontend/src/locales/ar/common.json`
  - `frontend/src/locales/tr/common.json`
- Updated architecture/user docs:
  - `docs/architecture/sales.md`
  - `docs/user-guide/sales/README.md`
  - `docs/user-guide/sales/invoice-attachments.md`

### Attachment policy and control model

- Max files per invoice: `5`
- Max file size: `10 MB`
- Allowed MIME types:
  - `application/pdf`
  - `image/jpeg`
  - `image/png`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Storage path (tenant scoped):
  - `companies/{companyId}/sales/invoices/{invoiceId}/attachments/...`
- Download/open uses short-lived signed URL generated server-side (`15m`).

### Accounting and architecture rationale

- Attachments are treated as document evidence and do **not** alter posting or voucher values.
- Metadata is stored on the sales invoice record to keep audit context near the financial document.
- Tenant boundary is preserved by deriving `companyId` from authenticated user context and scoping both repository lookup and storage path.

## End-User View

You can now attach supporting files directly to a Sales Invoice:

1. Open a Sales Invoice.
2. Use the **Attachments** section to upload a file.
3. View uploaded files in the same section.
4. Open any file with **Open**.
5. Remove a file with **Remove**.

This helps keep invoice evidence (customer PO, signed proof, supporting sheets) linked to the exact invoice without changing accounting amounts.

## Verification

- `npm --prefix backend run build` ✅
- `npm --prefix frontend run typecheck` ✅

## Acceptance Criteria

- Sales Invoice supports upload/list/open/remove attachment operations ✅
- Tenant-scoped storage path and data isolation applied ✅
- Attachment validation limits enforced (count/size/type) ✅
- Technical architecture doc updated ✅
- End-user guide added ✅

## Known Follow-ups

- Current D.6 implementation is invoice-first. The same pattern can be extended to Sales Order / Delivery Note / Sales Return if business requires attachment parity across all sales documents.

---

## Manual QA Script — Operator View (run sequentially)

**Pre-req:** Backend + frontend dev servers running. Logged in as admin. At least one Sales Invoice exists. Have these test files locally:
- a small PDF (e.g. 200 KB)
- a JPG image
- an oversize file > 10 MB
- a disallowed type (e.g. `.zip` or `.txt`)

### Test 1 — Upload a PDF attachment
1. Open **Sales → Invoices** and open any invoice.
2. Scroll to the **Attachments** section.
3. Click **Upload** and pick the test PDF.
- **Expected:** file appears in the list with name, size, and **Open** / **Remove** buttons.

### Test 2 — Open the attachment
1. In the Attachments list, click **Open** on the PDF just uploaded.
- **Expected:** the PDF opens in a new browser tab (signed URL works).

### Test 3 — Upload more files up to the limit
1. Upload 4 more files (PDF or JPG mix) so the invoice has 5 attachments.
2. Try to upload a 6th file.
- **Expected:** upload of the 6th file is blocked with a clear message ("Maximum 5 files" or similar).

### Test 4 — File size limit
1. Try to upload the > 10 MB file.
- **Expected:** upload rejected with a size-limit message; file does not appear in the list.

### Test 5 — Disallowed file type
1. Try to upload the `.zip` (or `.txt`) file.
- **Expected:** upload rejected with a file-type message.

### Test 6 — Remove an attachment
1. In the Attachments list, click **Remove** on any file.
2. Confirm.
3. Reload the page.
- **Expected:** the file disappears from the list and stays gone after reload.

### Results

| # | Test | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Upload PDF | | |
| 2 | Open attachment | | |
| 3 | Max 5 files enforced | | |
| 4 | Size limit enforced | | |
| 5 | Disallowed type rejected | | |
| 6 | Remove attachment | | |

