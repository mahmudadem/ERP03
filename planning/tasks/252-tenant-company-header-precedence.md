# Task 252 — `x-company-id` header is ignored on tenant module routes (company-switch bug)

> **Status:** Not started. Found during the 2026-06-22 live QA of the FUP-3 merge.
> **Severity:** Medium (functional). **NOT a data leak** — verified below.
> **Why it needs its own task:** the root cause is in security-critical auth/tenant middleware and was not statically determinable; it needs runtime instrumentation. Do not blind-patch.

## Symptom (reproduced live on the emulator)

User `qwe@qwe.com` (member of SYCO, TEST CO LLD, asd syria; active company = `asd syria` = `cmp_mpqs3ny8_sat8rj`):

| Request | `x-company-id` header | Result |
|---|---|---|
| `GET /api/v1/tenant/sales/invoices` | `cmp_mpopc1f1_9vlfhe` (other own company) | 200 — returns **asd syria** invoices (header ignored) |
| `GET /api/v1/tenant/sales/invoices` | `cmp_BOGUS_NOPE` (non-existent) | 200 — returns **asd syria** invoices (header ignored, no membership check) |
| `GET /api/v1/tenant/sales/invoices` | *(none)* | 200 — returns **asd syria** invoices |
| `GET /api/v1/auth/me/permissions` | `cmp_BOGUS_NOPE` | **403 `COMPANY_ACCESS_DENIED`** (header honored + membership enforced) |

So `authMiddleware` enforces the header for `/auth/*` but the tenant module routes resolve to the user's stored `activeCompanyId` regardless of the header.

## Not a leak (important)

Every observed response returned only the user's **own active company** data. A foreign/bogus company never yielded another tenant's data — the strict path denies, and the lenient path falls back to the caller's own active company. So this is a **company-switching / precedence correctness bug**, not cross-tenant exposure. It still matters: the frontend's multi-company switcher (which sends `x-company-id`) would silently show the active company instead of the selected one.

## Root-cause analysis so far (inconclusive — needs runtime data)

- `authMiddleware` (`src/api/middlewares/authMiddleware.ts`) sets `activeCompanyId = headerCompanyId || userStoredActiveCompany`, then for a header with no membership and a non-admin user it returns `forbidden` (line ~68). That branch fired for `/auth/me/permissions` but NOT for `/tenant/sales/invoices` with the same header — which should be impossible if both run the same middleware with the same `headerCompanyId`.
- `impersonationMiddleware` is a no-op without `x-impersonation-token` (not the cause).
- Firestore repos ARE properly company-scoped (`companies/{companyId}/sales/Data/sales_invoices/{id}`), so the lenient result is the *active* company's data, consistent with "header ignored," not "unscoped read."

The contradiction (same middleware, different header treatment per route) means `headerCompanyId` is likely being read/seen differently on the two paths, OR `tenantContextMiddleware` re-resolves company context from the stored active company. **Next diagnostic step:** add temporary logging in `authMiddleware` and `tenantContextMiddleware` printing `req.headers['x-company-id']`, resolved `activeCompanyId`, and the membership-check result, then hit both routes and compare. Fix only after the divergence is explained.

## Acceptance criteria

- [ ] Root cause explained with runtime evidence (not a guess).
- [ ] `x-company-id` header, when the user has membership, is honored consistently across ALL authenticated routes (tenant + auth + platform).
- [ ] A header for a company the user is NOT a member of is rejected consistently (403) on all routes.
- [ ] Regression tests for tenant-context resolution covering: valid header (honored), foreign header (403), no header (falls back to active company).
- [ ] No behavior change to the document-scoping repos (already correct).
