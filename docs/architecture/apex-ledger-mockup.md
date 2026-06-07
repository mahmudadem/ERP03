# Apex Ledger Mockup Integration Architecture

This document describes the technical architecture and file structure of the **Apex Ledger Mockup Preview Page**, which provides an interactive environment integrated directly with the live ERP database and backend API layer under the dev routes.

## Purpose & Layout Isolation Strategy
The preview dashboard serves as a high-density, Syrian-localized alternative cockpit preview.

To integrate it seamlessly without disturbing production flows:
1. **Isolated Route Layout**: Bound to `/dev/apex-ledger` in `routes.config.ts`.
2. **AppShell Navigation Bypass**: Modified [AppShell.tsx](file:///d:/DEV2026/ERP03/frontend/src/layout/AppShell.tsx) to detect the pathname `/dev/apex-ledger` and bypass rendering the main application navigation header, sidebar, and floating AI assistant. This renders the mockup's built-in header, sidebar, and workspace in a clean full-viewport canvas without "app-inside-an-app" visual nesting.
3. **TanStack React Query Integration**: Connected the mockup's local state loops in [ApexLedgerDashboard.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx) to standard backend queries (`useQuery`) and mutations (`useMutation`) using React Query hooks.

## File Map
All code lives inside the `frontend/src/pages/dev/apex-ledger/` namespace:

- [ApexLedgerDashboard.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/ApexLedgerDashboard.tsx)
  - Main container page. Orchestrates queries, mutation bindings, and active sub-view rendering.
- [types.ts](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/types.ts)
  - Type structures used by the mockup layout, expanded to support metadata fields (`exchangeRate`, `notes`) from the backend APIs.
- [utils/dummyData.ts](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/utils/dummyData.ts)
  - Mockup seed records utilized only as fallbacks when live API lists return empty.
- [components/Sidebar.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/Sidebar.tsx)
  - High-density sidebar layout.
- [components/DashboardHome.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/DashboardHome.tsx)
  - Bento metric grids and SVG line plots.
- [components/COASection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/COASection.tsx)
  - Hierarchy chart of accounts list and balance sheets.
- [components/VoucherListSection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/VoucherListSection.tsx)
  - Voucher Register page replica, featuring metrics overview, search and filters, and full transaction listing in high-density layout.
- [components/SalesSection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/SalesSection.tsx)
  - Lists Sales Orders and Sales Invoices.
- [components/SalesPage2.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/SalesPage2.tsx)
  - High-density voucher editor with tax calculations and inline menu operations.
- [components/PurchasesSection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/PurchasesSection.tsx)
  - Purchase invoices list.
- [components/InventorySection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/InventorySection.tsx)
  - Items list.
- [components/AIAssistantSection.tsx](file:///d:/DEV2026/ERP03/frontend/src/pages/dev/apex-ledger/components/AIAssistantSection.tsx)
  - CFO conversational advisor powered by `aiAssistantApi.sendMessage`.

## API Integration Detail

### 1. Chart of Accounts (COA) & Vouchers
- **COA Queries**: Fetches live accounts using `accountingApi.getAccounts`.
- **COA Mutations**: Creating an account in the mockup calls `accountingApi.createAccount` which registers it in the backend database.
- **Voucher Queries**: Fetches live vouchers using `accountingApi.listVouchers` under a React Query cache cycle, supporting server pagination, searching, type filtering, and date range locks.
- **Voucher Actions**: Connects directly to `useVoucherActions` workflow hook (approve, reject, post, reverse, cancel) and the live `VoucherEntryModal` editing wizard.
- **Voucher Delete**: Integrates with `accountingApi.deleteVoucher` to remove draft records.

### 2. Customers & Vendors
- **Queries**: Lists customers via `sharedApi.listParties({ role: 'CUSTOMER' })` and vendors via `sharedApi.listParties({ role: 'VENDOR' })`.

### 3. Inventory Items
- **Queries**: Lists stock items via `inventoryApi.listItems()`.
- **Mutations**: Saving a new product invokes `inventoryApi.createItem`.

### 4. Sales Orders & Invoices
- **Queries**: Lists orders via `salesApi.listSOs()` and invoices via `salesApi.listSIs()`.
- **Mutations**: Creating or modifying orders/invoices maps to `salesApi.createSO`, `salesApi.createSI`, `salesApi.updateSI`, and `salesApi.deleteSI`.

### 5. Purchase Bills
- **Queries**: Lists bills via `purchasesApi.listPIs()`.
- **Mutations**: Saving bills maps to `purchasesApi.createPI`.

### 6. CFO AI Advisor
- **Queries**: Sends user messages to the server using `aiAssistantApi.sendMessage`.
- **Context Tracking**: Retains the active `conversationId` returned from the API to maintain chat history, and dynamically displays the active model name (e.g., `gemini-3.5-flash` or custom models) returned in the response metadata.
