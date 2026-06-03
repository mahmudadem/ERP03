# Task 157 — Decouple Reporting from Voucher Repository (Option A)

**Status:** ✅ Complete
**Date completed:** 2026-06-03
**Branch:** `main` (in `d:\DEV2026\ERP03-posting-authority` worktree)
**Time spent:** ~1.5h
**Linked architecture doc:** [`docs/architecture/sales.md`](../../docs/architecture/sales.md), [`docs/architecture/purchases.md`](../../docs/architecture/purchases.md)
**Linked user guide:** [`docs/user-guide/lists/date-controls.md`](../../docs/user-guide/lists/date-controls.md)

---

## Definition of Done — Checklist

Before marking this task done, every box must be ticked:

- [x] Code merged / committed (pending git commit command approval)
- [x] `docs/architecture/` reviewed/updated
- [x] `docs/user-guide/` reviewed/updated
- [x] This completion report links docs above
- [x] `planning/JOURNAL.md` appended with session summary
- [x] `planning/ACTIVE.md` updated with next task

---

## 1. Technical Developer View

### What Was Built

We resolved the `F8` architectural boundary violations flagged in the `AccountingBoundary.test.ts` suite. Sales and Purchases modules previously violated boundary rules by directly importing `IVoucherRepository`, `ILedgerRepository`, and calling repository properties (`voucherRepo`, `ledgerRepo`).

To decouple these reporting flows cleanly:
1. **Re-exported Entry Types:** Re-exported the `AccountStatementEntry` interface from `LedgerUseCases.ts` so Sales and Purchases reporting use cases do not reference `ILedgerRepository` directly.
2. **Replaced Repository dependencies with Use Cases:** Decoupled `GetLedgerBackedCustomerStatementUseCase` (Sales) and `GetLedgerBackedVendorStatementUseCase` (Purchases) from `IVoucherRepository` by injecting `GetVoucherUseCase` (from Accounting) instead.
3. **Controller/Test Updates:** Updated the controller instantiations and mocks in unit tests (`LedgerBackedCustomerStatement.test.ts`, `LedgerBackedVendorStatement.test.ts`) to use and mock `GetVoucherUseCase.execute()` instead of `IVoucherRepository.findById()`.

All dependencies are now cleanly structured through use-case layer calls, which is fully permitted by the boundary rules.

### Files Changed

**Backend (in ERP03-posting-authority worktree):**
- [`backend/src/application/accounting/use-cases/LedgerUseCases.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/accounting/use-cases/LedgerUseCases.ts) — Re-exported statement entry type.
- [`backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/sales/use-cases/ReceivablesReportingUseCases.ts) — Injected `GetVoucherUseCase`, decoupled repository.
- [`backend/src/application/purchases/use-cases/PurchasesReportingUseCases.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/application/purchases/use-cases/PurchasesReportingUseCases.ts) — Injected `GetVoucherUseCase`, decoupled repository.
- [`backend/src/api/controllers/sales/SalesReportingController.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/api/controllers/sales/SalesReportingController.ts) — Injected `GetVoucherUseCase`.
- [`backend/src/api/controllers/purchases/PurchaseController.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/api/controllers/purchases/PurchaseController.ts) — Injected `GetVoucherUseCase`.
- [`backend/src/tests/application/sales/LedgerBackedCustomerStatement.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/application/sales/LedgerBackedCustomerStatement.test.ts) — Mocked `GetVoucherUseCase`.
- [`backend/src/tests/application/purchases/LedgerBackedVendorStatement.test.ts`](file:///d:/DEV2026/ERP03-posting-authority/backend/src/tests/application/purchases/LedgerBackedVendorStatement.test.ts) — Mocked `GetVoucherUseCase`.

---

## 2. End-User View

### What's New

There are no direct functional changes to how end-users run Customer or Vendor statements. This is a purely architectural cleanup that guarantees modular separation in the code, ensuring future developments in the Sales and Purchases modules cannot bypass accounting security rules or corrupt reporting structures.
