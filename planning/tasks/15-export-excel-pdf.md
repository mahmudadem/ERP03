# 15 — Export to Excel/PDF

> **Priority:** P3 (Lower)
> **Estimated Effort:** 3 days
> **Dependencies:** None (enhances all existing reports)

---

## Business Context

Accountants and auditors need to take data **out of the system** in professional formats:
- **Excel (XLSX)** — For analysis, audit working papers, data manipulation
- **PDF** — For formal reports, board presentations, regulatory submissions

Currently, only P&L has CSV export and reports have `window.print()`. Professional outputs require formatted Excel and styled PDF reports.

---

## Current State

- ✅ P&L has CSV export
- ✅ All reports have print via `window.print()`
- ❌ No XLSX export anywhere
- ❌ No proper PDF generation (print-to-PDF is browser-specific and unformatted)

---

## Requirements

### Functional
1. **Excel export** on: Trial Balance, General Ledger, P&L, Balance Sheet, Account Statement, Journal
2. **PDF export** on: All reports + individual voucher print view
3. Excel should include:
   - Proper column headers and formatting
   - Number formatting (commas, decimals)
   - Report header (company name, report name, date range)
   - Auto-width columns
4. PDF should include:
   - Company logo and header
   - Page numbers
   - Professional layout matching the screen view

### Non-Functional
- Excel: use `xlsx` or `exceljs` library (frontend-side generation for simplicity)
- PDF: use `@react-pdf/renderer` or `jspdf` for client-side, or `puppeteer` for server-side

---

## Implementation Plan

### Step 1: Install Dependencies
```bash
cd frontend && npm install xlsx file-saver
# or for richer formatting:
cd frontend && npm install exceljs file-saver
```

### Step 2: Create Export Utilities

**File:** `frontend/src/utils/exportUtils.ts` (NEW)

```typescript
export function exportToExcel(data: any[], columns: Column[], filename: string, options?: ExportOptions): void;
export function exportToPDF(elementId: string, filename: string): void;
```

### Step 3: Add Export Buttons to All Reports
- Trial Balance → "Export Excel" + "Export PDF" buttons
- General Ledger → same
- P&L → upgrade from CSV to Excel
- Balance Sheet → same
- Account Statement → same
- Journal → same
- Voucher Print View → "Download PDF" button

### Step 4: Excel Formatting
- Bold header row
- Number columns formatted as accounting (2 decimals)
- Report title in merged cells at top
- Date range in subtitle
- Auto-fit column widths

### Step 5: PDF Enhancement
- Use a consistent PDF template with company info
- Page headers/footers with page numbers
- Consistent fonts and spacing

---

## Acceptance Criteria

- [ ] Excel export works on all 6+ reports
- [ ] Excel files have proper formatting (headers, numbers, widths)
- [ ] PDF export generates clean professional documents
- [ ] Company name and report info included in exports
- [ ] Large reports handle well (no browser freeze on 1000+ rows)
