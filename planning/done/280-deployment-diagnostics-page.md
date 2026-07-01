# 280 — Deployment Diagnostics Page

## Summary

Added a Super Admin-only deployment diagnostics page so production can be evaluated from inside the app without exposing secrets.

## Files Changed

- `backend/src/api/controllers/super-admin/DeploymentDiagnosticsController.ts`
- `backend/src/api/routes/super-admin.routes.ts`
- `frontend/src/modules/super-admin/pages/DeploymentDiagnosticsPage.tsx`
- `frontend/src/api/superAdmin/index.ts`
- `frontend/src/router/routes.config.ts`
- `frontend/src/hooks/useSidebarConfig.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/vite.config.ts`
- `frontend/src/locales/en/common.json`
- `frontend/src/locales/ar/common.json`
- `frontend/src/locales/tr/common.json`
- `docs/architecture/deployment-diagnostics.md`
- `docs/user-guide/deployment-diagnostics.md`

## Technical Developer View

The backend adds `GET /super-admin/deployment-diagnostics` under the existing Super Admin route guard. The endpoint runs lightweight live checks for Firebase Auth, the configured database backend (`DB_TYPE=SQL` uses Prisma `SELECT 1`; otherwise Firestore Admin SDK), and Firebase Admin SDK initialization.

The frontend adds `/super-admin/deployment-diagnostics` in the existing Super Admin shell. It displays safe backend diagnostics plus frontend runtime/build metadata. Vite injects `__BUILD_INFO__` so the page can show build time, branch, commit, and Vercel build metadata when available.

Security rule: no secrets, tokens, raw env dump, service-account data, or database connection strings are returned.

## End-User View

Super Admin can now open `Super Admin -> System -> Deployment Diagnostics` after a deploy and see whether the frontend, backend, database, Firebase, and authentication checks are healthy.

The page is read-only. It helps decide whether production is running the expected deployment.

## Accounting / ERP Impact

None. This is operational visibility only. It does not change posting, vouchers, ledger balances, inventory valuation, taxes, AR/AP, approvals, audit trail, permissions, or tenant transaction data.

## Verification

- Backend build: `npm run build` in `backend/` — passed.
- Frontend typecheck: `npm run typecheck` in `frontend/` — passed.
- Locale JSON parse for EN/AR/TR common files — passed.
- Frontend production build: `npm run build` in `frontend/` — passed.
- Production backend deploy: `firebase deploy --only functions --project erp-03` — passed.
- Production frontend deploy: `npx vercel@latest --prod --yes` — passed.
- Live checks after deploy:
  - `https://erp-03.vercel.app` — `200`.
  - `https://us-central1-erp-03.cloudfunctions.net/api/api/v1/health` — `ok`.
  - `https://us-central1-erp-03.cloudfunctions.net/api/api/v1/super-admin/deployment-diagnostics` without auth — `401`, proving the route is live and protected.

## Known Follow-Up

Owner must verify the page while logged in as Super Admin. This production deploy was made from the
local branch before commit; commit/merge is still needed so production is backed by git history.

## Time

Estimate: 1.5-2.5h.
Actual so far: ~1.8h.
