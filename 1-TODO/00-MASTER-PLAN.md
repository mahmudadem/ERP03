# Accounting Module — Master Implementation Plan

> **Last Updated:** 2026-02-10
> **Audit Score:** 5/10 → Target 9/10

## Current State Summary

The accounting module has a **strong domain foundation** — entities, strategies, policies, RBAC, multi-currency, voucher lifecycle, and a form designer. What's missing is the **reporting layer**, **period management**, and **operational tools** that accountants use daily.

---

## Plan Index (by Priority)

### 🔴 P0 — Critical (Cannot operate without these)

| # | Feature | File | Est. Effort | Impact |
|---|---------|------|-------------|--------|
| 01 | Balance Sheet Report | [01-balance-sheet-report.md](./01-balance-sheet-report.md) | 2-3 days | ✅ Done |
| 02 | Account Statement (running balance) | [02-account-statement-report.md](./02-account-statement-report.md) | 2 days | Daily operational need |
| 03 | Fiscal Year / Period Management | [03-fiscal-year-management.md](./03-fiscal-year-management.md) | 3-5 days | Year-end closing |

### 🟡 P1 — High Priority

| # | Feature | File | Est. Effort | Impact |
|---|---------|------|-------------|--------|
| 04 | Cost Center (full implementation) | [04-cost-center-full.md](./04-cost-center-full.md) | 5-7 days | Management accounting |
| 05 | Dashboard with real data | [05-dashboard-real-data.md](./05-dashboard-real-data.md) | 2-3 days | First impression |
| 06 | Cash Flow Statement | [06-cash-flow-statement.md](./06-cash-flow-statement.md) | 3-4 days | 3rd financial statement |
| 07 | Voucher Numbering Sequences | [07-voucher-numbering-sequences.md](./07-voucher-numbering-sequences.md) | 2 days | Audit compliance |
| 08 | Journal / Day Book Report | [08-journal-daybook-report.md](./08-journal-daybook-report.md) | 2 days | Proper journal view |

### 🟢 P2 — Medium Priority

| # | Feature | File | Est. Effort | Impact |
|---|---------|------|-------------|--------|
| 09 | Bank Reconciliation | [09-bank-reconciliation.md](./09-bank-reconciliation.md) | 5-7 days | Operational verification |
| 10 | Budget Module | [10-budget-module.md](./10-budget-module.md) | 5-7 days | Planning & control |
| 11 | Aging Reports (AR/AP) | [11-aging-reports.md](./11-aging-reports.md) | 3 days | Credit management |
| 12 | Multi-Company Consolidation | [12-multi-company-consolidation.md](./12-multi-company-consolidation.md) | 5-7 days | Group reporting |

### ⚪ P3 — Lower Priority / Quality of Life

| # | Feature | File | Est. Effort | Impact |
|---|---------|------|-------------|--------|
| 13 | Recurring Vouchers | [13-recurring-vouchers.md](./13-recurring-vouchers.md) | 3 days | Efficiency |
| 14 | Voucher Attachments | [14-voucher-attachments.md](./14-voucher-attachments.md) | 2 days | Audit readiness |
| 15 | Export to Excel/PDF | [15-export-excel-pdf.md](./15-export-excel-pdf.md) | 3 days | Professional outputs |
| 16 | Localization / i18n | [16-localization-i18n.md](./16-localization-i18n.md) | Ongoing | Multi-market |
| 17 | Opening Balance Import UI | [17-opening-balance-import-ui.md](./17-opening-balance-import-ui.md) | 2 days | Onboarding |
| 18 | Balance Enforcement at Posting | [18-balance-enforcement-posting.md](./18-balance-enforcement-posting.md) | 1 day | Data integrity |

### 🔧 Existing TODO Migration

| # | Feature | File | Est. Effort | Origin |
|---|---------|------|-------------|--------|
| 19 | Settings Page UX Fix | [19-settings-page-ux.md](./19-settings-page-ux.md) | 2 days | TODO #1 |
| 20 | Web ↔ Windows UI Parity | [20-web-windows-ui-parity.md](./20-web-windows-ui-parity.md) | 2-3 days | TODO #2 |
| 21 | User & Role Management Testing | [21-user-role-management-testing.md](./21-user-role-management-testing.md) | 1-2 days | TODO #3 |
| 22 | Notifications System | [22-notifications-system.md](./22-notifications-system.md) | 3-5 days | TODO #4 |

### 🛡️ Security & Infrastructure (Final Audit Findings)

| # | Feature | File | Est. Effort | Impact |
|---|---------|------|-------------|--------|
| 23 | Firestore Security Rules | [23-firestore-security-rules.md](./23-firestore-security-rules.md) | 1-2 days | 🔴 Data is unprotected |
| 24 | Audit Trail / Activity Log | [24-audit-trail.md](./24-audit-trail.md) | 3-5 days | Accounting compliance |
| 25 | CI/CD Pipeline & Test Runner | [25-ci-cd-pipeline.md](./25-ci-cd-pipeline.md) | 2-3 days | Code quality assurance |
| 26 | Production Logging & Observability | [26-production-logging.md](./26-production-logging.md) | 2 days | Sensitive data leaking |
| 27 | API Security Hardening | [27-api-security-hardening.md](./27-api-security-hardening.md) | 1-2 days | No rate limiting/headers |

> 📄 **Full Audit Report:** [23-FINAL-AUDIT-REPORT.md](./23-FINAL-AUDIT-REPORT.md)

---

## Architectural Note: SQL Migration Readiness

This project uses **Firestore** today but must be **migration-ready for SQL** at any time. The codebase already follows the Repository Pattern:
- **Interfaces** in `backend/src/repository/interfaces/`
- **Firestore implementations** in `backend/src/infrastructure/firestore/repositories/`
- **DI container** in `backend/src/infrastructure/di/bindRepositories.ts` with `DB_TYPE` env var

All new plans respect this pattern:
- New entities use plain TypeScript interfaces (no Firestore-specific types)
- New repositories define interfaces first, then Firestore implementation
- Data models include both Firestore collection paths AND future SQL schemas
- Security rules (Plan 23) note SQL equivalent (Row-Level Security)
- Middleware plans (26, 27) are fully database-agnostic

---

## Agent Instructions

Each numbered file is a **self-contained work plan**. An agent given one file should be able to:

1. Understand WHY the feature is needed (business context)
2. Know WHAT files exist and need to change
3. Follow the step-by-step implementation plan
4. Verify the work using the provided test/verification plan

**Convention:** Each plan follows this structure:
- **Business Context** — Why this matters
- **Current State** — What exists today
- **Requirements** — What to build
- **Implementation Plan** — Step-by-step with file paths
- **Data Model** — Entities/schemas if applicable
- **API Endpoints** — Routes to add/modify
- **Frontend Pages** — Components to create
- **Verification Plan** — How to verify correctness
- **Dependencies** — Other plans that must be done first
- **Acceptance Criteria** — Definition of done

---

## Estimated Total Effort

| Priority | Items | Days |
|----------|-------|------|
| P0 (Critical) | 4 (01-03 + 23) | 8-12 |
| P1 (High) | 7 (04-08 + 24-25) | 19-26 |
| P2 (Medium) | 6 (09-12 + 26-27) | 21-28 |
| P3 (Lower) | 6 (13-18) | 11+ |
| TODO Migration | 4 (19-22) | 8-12 |
| **Total** | **27** | **~67-89 days** |

## Recommended Execution Order

1. **Plan 23** — Firestore Security (stop bleeding)
2. **Plans 01-03** — P0 reports + fiscal year
3. **Plan 25** — CI/CD (before more code is written)
4. **Plans 04-08** — P1 features
5. **Plan 24** — Audit Trail (before real users)
6. **Plans 26-27** — Logging + API security
7. **Everything else** — by business priority
