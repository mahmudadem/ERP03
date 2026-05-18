# Status: PLACEHOLDER

This module is a **scaffold**, not an implemented feature.

**What exists:**
- `pages/CrmHomePage.tsx` — placeholder UI with stat cards (all `value="0"`) and a visible "Module Under Development" banner

**Why it exists:** The module key `crm` is registered in Super Admin entitlements, so the placeholder keeps those screens working until the real module is built.

**No backend.** There is no `crm` backend in `backend/src/modules/`.

**Planned for:** Phase 2 (post-MVP). Real implementation will include leads, contacts, opportunities, activity tracking, email integration.

**Do not** add real business logic here without first creating the backend module and removing this STATUS.md.
