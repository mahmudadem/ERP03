# Status: PLACEHOLDER

This module is a **scaffold**, not an implemented feature.

**What exists:**
- `pages/HrHomePage.tsx` — placeholder landing page with i18n key `modulePlaceholders.hr.title`
- `pages/EmployeesListPage.tsx` — empty placeholder

**Why it exists:** The module key `hr` is registered in Super Admin entitlements (`frontend/src/modules/super-admin/pages/CompanyEntitlementsPage.tsx`) and `SystemOverviewPage.tsx`, so the placeholder keeps those screens working until the real module is built.

**No backend.** There is no `hr` backend in `backend/src/modules/`.

**Planned for:** Phase 2 (post-MVP). Real implementation will include employee directory, payroll, leave management, contracts.

**Do not** add real business logic here without first creating the backend module and removing this STATUS.md.
