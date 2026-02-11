# 14 — Voucher Attachments (Completed)

## Scope
Enabled uploading, listing, downloading, and deleting voucher attachments stored in Firebase Storage, surfaced in the voucher editor UI.

## What was built
- **Backend**: AttachmentController with endpoints:
  - `GET /accounting/vouchers/:id/attachments`
  - `POST /accounting/vouchers/:id/attachments` (multipart upload, 10MB limit, 5/file cap, allowed types: pdf/jpg/png/xlsx/docx)
  - `GET /accounting/vouchers/:id/attachments/:aid` (signed download)
  - `DELETE /accounting/vouchers/:id/attachments/:aid`
  Storage path: `companies/{companyId}/vouchers/{voucherId}/attachments/...`; references stored in voucher metadata. Multer added for uploads.
- **Repo wiring**: Firestore and DI unchanged; attachments use Storage directly.
- **Frontend**: Voucher editor now shows an Attachments panel (for existing vouchers) with upload button, list, download link, and delete (if editable).
- **API client**: attachmentsApi helper for list/upload/delete.

## Notes & assumptions
- Delete/Upload guarded by voucher edit permission; download/list by view.
- No global scheduler needed; upload is manual per voucher.
- Preview is not inline; download opens the file. (Future: add lightbox/PDF preview.)

## Verification
- Manual: upload <=10MB pdf/jpg/png/docx/xlsx to a draft voucher, see it listed, download via link, delete and confirm it disappears; cap enforced at 5 files.
- Automated: not added (storage interaction is side-effectful); endpoints exercised via manual checks.
