# Manual Test — 14: Voucher Attachments

## Feature Overview

**What it is:** Voucher Attachments allow users to attach source documents (invoices, receipts, contracts, bank statements) to vouchers. Essential for audit trail completeness — auditors must verify that each entry has supporting documentation.

**How it works:**
- Files are uploaded via drag-and-drop or file picker on the voucher form
- Stored in Firebase Storage under `companies/{companyId}/vouchers/{voucherId}/attachments/`
- Metadata (path, name, size, type) is saved in the voucher record
- Supports preview for images and PDFs, download for all file types

---

## Prerequisites

- [ ] Company with accounting initialized
- [ ] At least one voucher (DRAFT or POSTED) to attach files to
- [ ] Test files ready: a small PDF, a JPG/PNG image, an XLSX file
- [ ] Files under 10MB each

---

## Test Cases

### TC-14.1 — Upload a Single Attachment

**Steps:**
1. Open a voucher in edit mode (or create a new one)
2. Look for the attachment area (drag-and-drop zone or upload button)
3. Upload a **PDF** file

**Expected:**
- [ ] File uploads with a **progress indicator**
- [ ] After upload, file appears in the attachment list with:
  - Filename
  - File size
  - File type icon/badge
- [ ] File persists after saving the voucher

---

### TC-14.2 — Upload Multiple Attachments

**Steps:**
1. Upload 3-5 different files to the same voucher (mix of PDF, JPG, XLSX)

**Expected:**
- [ ] All files upload successfully
- [ ] All appear in the attachment list
- [ ] Each shows its correct type and size
- [ ] Total count is visible (e.g., "3 attachments")

---

### TC-14.3 — Maximum Files Limit

**Steps:**
1. Try to upload more than **5 files** to a single voucher

**Expected:**
- [ ] Upload is blocked after the 5th file
- [ ] Error message: "Maximum 5 attachments per voucher"

---

### TC-14.4 — Maximum File Size

**Steps:**
1. Try to upload a file **larger than 10MB**

**Expected:**
- [ ] Upload is rejected
- [ ] Error message about file size limit

---

### TC-14.5 — Supported File Types

**Steps:**
1. Upload each supported type: PDF, JPG, PNG, XLSX, DOCX
2. Try uploading an unsupported type (e.g., .exe, .zip)

**Expected:**
- [ ] Supported types upload successfully
- [ ] Unsupported types are rejected with a clear message

---

### TC-14.6 — Image Preview

**Steps:**
1. Upload a JPG or PNG image
2. Click on it to preview

**Expected:**
- [ ] Image opens in a **lightbox/modal**
- [ ] Image is viewable at full resolution
- [ ] Close/dismiss the preview

---

### TC-14.7 — PDF Preview (If Implemented)

**Steps:**
1. Upload a PDF
2. Click on it to preview

**Expected:**
- [ ] PDF opens in a viewer (modal or inline)
- [ ] Pages are navigable

**Note:** Per completion report, inline preview may not be implemented — check if PDF opens in a new tab as fallback.

---

### TC-14.8 — Download Attachment

**Steps:**
1. Click the download button on an attachment

**Expected:**
- [ ] The original file downloads
- [ ] The filename matches the uploaded file
- [ ] File contents are intact (not corrupted)

---

### TC-14.9 — Delete Attachment (Editable Voucher)

**Steps:**
1. Open a voucher in DRAFT status
2. Delete one of its attachments

**Expected:**
- [ ] Attachment is removed from the list
- [ ] Confirmation prompt before deletion
- [ ] The file is removed from storage

---

### TC-14.10 — Cannot Delete Attachment on Posted Voucher

**Steps:**
1. Open a POSTED (non-editable) voucher with attachments
2. Try to delete an attachment

**Expected:**
- [ ] Delete button is **hidden** or **disabled**
- [ ] Attachments are read-only on posted vouchers

---

### TC-14.11 — Attachments Persist After Reload

**Steps:**
1. Upload attachments to a voucher and save
2. Navigate away and return to the voucher

**Expected:**
- [ ] All attachments are still listed
- [ ] They can still be previewed and downloaded

---

### TC-14.12 — Security — Cross-Company Access

**Steps:**
1. If possible, try to access an attachment URL from a different company context

**Expected:**
- [ ] Access is denied
- [ ] Attachments are secured by company context

---

## Test Results

| Test ID | Status | Notes |
|---------|--------|-------|
| TC-14.1 | ⬜ | |
| TC-14.2 | ⬜ | |
| TC-14.3 | ⬜ | |
| TC-14.4 | ⬜ | |
| TC-14.5 | ⬜ | |
| TC-14.6 | ⬜ | |
| TC-14.7 | ⬜ | |
| TC-14.8 | ⬜ | |
| TC-14.9 | ⬜ | |
| TC-14.10 | ⬜ | |
| TC-14.11 | ⬜ | |
| TC-14.12 | ⬜ | |
