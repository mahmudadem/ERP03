# Goal Description
Create a reusable **Report Container** (`ReportContainer.tsx`) to standardize report layouts (Header, Body, Footer) across the application. Implement a new **Ledger Report** (`LedgerReport.tsx`) using this container to view account entries.

## Feature Requirements
- **Initiator Concept**: Reports start with a parameter form (Account, Date, Currency, etc.). Once submitted, the report view is displayed.
- **Unified Layout**:
  - **Header**: Actions (Print, Export, Refresh, Filter/Edit Params).
  - **Body**: Data Grid / Table.
  - **Footer**: Totals / Summary.
- **Reference Image**: Shows a dense grid with multiple columns (Date, Voucher No, Description, Debit, Credit, Balance) and a sticky footer.

## Proposed Changes
### Frontend Components
#### [NEW] [ReportContainer.tsx](file:///d:/DEV2026/ERP03/frontend/src/components/reports/ReportContainer.tsx)
- **Props**:
  - `title`: string
  - `actions`: ReactNode (Print, Export buttons)
  - `filters`: ReactNode (Current filter summary or quick controls)
  - `footer`: ReactNode (Totals sticky bar)
  - `children`: ReactNode (The report content - table/grid)
  - `loading`: boolean
  - `onRefresh`: () => void
  - `onEditParameters`: () => void (To reopen initiator)

#### [NEW] [LedgerReport.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/accounting/reports/LedgerReport.tsx)
- **State**: `isGenerated` (boolean), `params` (Account, Date, Currency).
- **View 1: Initiator Form**
  - Select Account (Async Select).
  - Select Date Range (From/To).
  - Select Currency.
  - Button: "View Report".
- **View 2: Report View (uses ReportContainer)**
  - Fetches data based on params.
  - Displays Ledger Table.
  - Header shows actual Start/End Date and Selected Account.
  - Footer shows Totals.

### Navigation
#### [MODIFY] [useSidebarConfig.ts](file:///d:/DEV2026/ERP03/frontend/src/hooks/useSidebarConfig.ts)
- Add "Ledger Report" item to the "Accounting" section.

## Verification
- **Manual Test Plan**: `1-TODO/done/manual-tests/29-ledger-report.md`.
