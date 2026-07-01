# Deployment Diagnostics

## Purpose

The deployment diagnostics page gives Super Admin users a production-safe view of the currently running frontend, backend, database, authentication, and Firebase state.

This is an operations feature. It does not participate in accounting workflows, posting, inventory valuation, tenant transaction data, or document lifecycle logic.

## Backend Contract

Endpoint:

```text
GET /api/v1/super-admin/deployment-diagnostics
```

Security:

- Uses the existing `/super-admin/*` route stack.
- Requires `authMiddleware`.
- Requires `assertSuperAdmin`.
- Returns no secrets, tokens, service-account JSON, API keys, raw database URLs, or raw environment dumps.

The controller lives at:

```text
backend/src/api/controllers/super-admin/DeploymentDiagnosticsController.ts
```

It performs lightweight live checks:

- Firebase Auth user lookup for the authenticated Super Admin.
- Database check based on `DB_TYPE`:
  - `SQL`: Prisma `SELECT 1`.
  - `FIRESTORE`: Firestore root collection lookup through Admin SDK.
- Firebase Admin SDK initialization check.

## Frontend

Route:

```text
/super-admin/deployment-diagnostics
```

The page lives at:

```text
frontend/src/modules/super-admin/pages/DeploymentDiagnosticsPage.tsx
```

The page also shows frontend-safe runtime/build metadata:

- Current browser host.
- API base URL.
- Frontend Firebase project/auth domain.
- Vite build mode.
- Build time, branch, and commit when available.
- Vercel metadata when available during build.

Build metadata is injected by `frontend/vite.config.ts` as `__BUILD_INFO__`.

## Safety Notes

This page is intentionally diagnostic-only:

- No writes.
- No tenant/company financial data.
- No config mutation.
- No hidden database switching.
- No secrets exposed.

If a future field might reveal infrastructure credentials or customer data, keep it out of this page or show only a boolean such as `configured`.
