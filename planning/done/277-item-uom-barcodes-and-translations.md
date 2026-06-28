# Task 277 — Item UOM barcodes and multilingual UOM names

**Status:** Complete locally  
**Branch:** `codex/items-uom-barcodes`  
**Estimated / actual:** 8–12h / ~2.5h

## Technical developer view

- Added extensible UOM translation maps with initial `en`, `ar`, and `tr` UI.
- Added structured item-UOM barcode assignments plus Firestore/PostgreSQL search
  fields and company-scoped uniqueness checks.
- POS barcode search now identifies the scanned UOM, resolves its Commercial
  Core price, and separates cart lines by item and UOM.
- Used UOM conversions are immutable across edit, delete, and correction APIs.
- Fixed the pre-existing `SelectPlanInput` contract regression that prevented
  backend builds and SQL-mode user creation.
- PostgreSQL requires `prisma db push` before using the new fields.

## End-user view

Users can retain general item barcodes and add different barcodes for pieces,
packs, boxes, or other configured units. Scanning one of these barcodes in POS
selects the correct unit and its price. UOM names can be maintained in English,
Arabic, and Turkish. Used conversion factors cannot be rewritten.

## Verification

- Item, POS pricing, UOM conversion, translation, and System Core boundary
  tests: 45/45 passed.
- Backend build: passed.
- Frontend typecheck: passed.
- Frontend production build and report/action guards: passed.
- `graphify update .`: unavailable because the CLI is not installed.
- Final boundary/build verification recorded in `planning/JOURNAL.md`.
