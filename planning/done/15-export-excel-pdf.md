# 15 — Export to Excel/PDF (Completed)

## Scope
Added reusable export utilities and wired Excel/PDF export to key accounting reports.

## What was built
- **Frontend utils**: `exportUtils.ts` with Excel (exceljs + file-saver) and PDF (html2canvas + jsPDF) helpers.
- **Dependencies**: Added `exceljs` and `file-saver`.
- **Reports updated**:
  - Trial Balance: Excel/PDF buttons; PDF captures table via element id.
  - General Ledger: Excel export of filtered rows; PDF capture.
  - Profit & Loss: Replaced CSV with Excel export; PDF capture; report wrapped for export.
  - Balance Sheet: Excel export of sections; PDF capture.
  - Account Statement: Excel/PDF export; capture table section.
  - Journal: Excel export (flattened lines) and PDF capture.

## Usage
- On each report page, use “Export Excel” to download an `.xlsx`; use “Export PDF” for a formatted PDF snapshot.
- Excel files include headers, numeric formatting (2 decimals), and basic metadata (title/subtitle where applicable).

## Notes & limitations
- PDF uses DOM snapshot; very long reports may paginate via jsPDF/HTML2Canvas scaling; no server-side PDF.
- Voucher print view not yet upgraded (still uses browser print); can be extended with the same utils later.

## Verification
- Manual: Triggered Excel/PDF on updated pages after loading data; files download with expected columns/values.
- Automated: Not added (UI/export behavior exercised manually).
