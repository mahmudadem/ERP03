# 250i — Numbering Engine Completion Report

**Date:** 2026-06-21  
**Status:** Complete, pending commit  
**Actual time:** ~1.6h

## Technical Developer View

Added `NumberingEngine` under System Core and wired DI so `diContainer.numberingEngine` is a real allocator over the existing atomic `IVoucherSequenceRepository`. The storage key is now scoped by document type and company/branch/terminal scope, while the displayed number uses the module prefix and requested counter width.

Repointed POS receipt allocation, Accounting voucher creation, Sales document numbers (SO/DN/SI/SR/QT including recurring invoices), Purchase document numbers (PO/GRN/PI/PR), and RV/PV settlement voucher numbers to prefer `INumberingEngine`. Existing module settings counters are used as lazy seed values and mirrored forward after allocation to preserve settings-screen continuity.

The Firestore and Prisma sequence repositories now honor arbitrary `{COUNTER:n}` formats, which preserves existing voucher widths and supports 5-digit document numbers and 6-digit POS receipts through one engine.

Files changed include:

- `backend/src/application/system-core/contracts/INumberingEngine.ts`
- `backend/src/application/system-core/numbering/NumberingEngine.ts`
- `backend/src/infrastructure/di/bindRepositories.ts`
- `backend/src/infrastructure/firestore/repositories/accounting/FirestoreVoucherSequenceRepository.ts`
- `backend/src/infrastructure/prisma/repositories/accounting/PrismaVoucherSequenceRepository.ts`
- POS, Sales, Purchases, Accounting create/post/settlement use cases and controllers that allocate numbers.
- `backend/src/tests/application/system-core/NumberingEngine.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/system-core.md`

## End-User View

Document and receipt numbering now comes from one shared engine. Accounting vouchers, Sales documents, Purchase documents, and POS receipts keep their familiar prefixes and number widths, but the system can now separate sequences by company, branch, or terminal where needed.

For users, existing numbers should continue from the configured next sequence instead of resetting. POS receipts still show the configured receipt prefix, and Sales/Purchase settings remain understandable because their next-number fields are mirrored forward during this transition.

## Verification

- Focused numbering/POS/boundary tests passed: 3 suites / 23 tests.
- Sales/Purchase numbering regressions passed: 3 suites / 12 tests.
- `npm --prefix backend run typecheck` passed.
- `npm --prefix backend run build` passed.
- Full backend suite passed: 183 passed / 2 skipped suites; 1,595 passed / 18 skipped tests.

## Known Follow-Ups

The physical repository name remains `VoucherSequenceRepository` for this phase. It is now used as generalized sequence storage behind `NumberingEngine`; a later low-risk rename can align the repository name with the broader role once Phase 3 is audited.
