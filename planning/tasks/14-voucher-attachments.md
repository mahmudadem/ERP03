# 14 — Voucher Attachments

> **Priority:** P3 (Lower)
> **Estimated Effort:** 2 days
> **Dependencies:** None

---

## Business Context

Professional accounting requires attaching **source documents** to vouchers for audit trail completeness. Examples:
- Invoice PDF attached to a payment voucher
- Receipt image attached to an expense entry
- Contract scan attached to a journal entry
- Bank statement screenshot for verification

Without attachments, auditors have no way to verify that voucher entries correspond to real transactions.

---

## Current State

- ✅ Firebase Storage is configured (`storage.rules` exists)
- ✅ Voucher entity has a `metadata` field (could store references)
- ❌ No attachment upload/download in voucher entry UI
- ❌ No attachment storage logic in backend
- ❌ No attachment viewing/preview in voucher detail

---

## Requirements

### Functional
1. **Upload attachments** — Drag-and-drop or button upload on voucher entry form
2. **File types**: PDF, JPG, PNG, XLSX, DOCX
3. **Max size**: 10MB per file, 5 files per voucher
4. **Preview** — Inline preview for images and PDFs
5. **Download** — Download original file
6. **Delete** — Remove attachment (only if voucher is in Draft/editable state)
7. **Persist** — Store in Firebase Storage, reference in voucher metadata

### Non-Functional
- Use Firebase Storage for file storage
- Store file references (path, name, size, type) in voucher metadata
- Secure: only company members can access attachments

---

## Implementation Plan

### Step 1: Backend — Attachment Endpoints
```
POST   /accounting/vouchers/:id/attachments     — Upload (multipart/form-data)
GET    /accounting/vouchers/:id/attachments      — List attachments
GET    /accounting/vouchers/:id/attachments/:aid — Download
DELETE /accounting/vouchers/:id/attachments/:aid — Delete
```

Storage path: `companies/{companyId}/vouchers/{voucherId}/attachments/{filename}`

### Step 2: Frontend — Attachment Component
- Drag-and-drop zone below voucher lines
- File list with thumbnails, name, size, delete button
- Upload progress indicator
- Image preview in lightbox
- PDF preview in modal
- Integrate into both VoucherWindow and VoucherEntryModal

### Step 3: Voucher Print View
- Show attachment count on printed voucher
- Optionally include image attachments in print

---

## Acceptance Criteria

- [ ] Upload 1-5 files to a voucher via drag-and-drop
- [ ] View uploaded files with thumbnails
- [ ] Preview images and PDFs inline
- [ ] Download original files
- [ ] Delete attachments (only on editable vouchers)
- [ ] Attachments persist across save/reload
- [ ] Storage secured by company context
