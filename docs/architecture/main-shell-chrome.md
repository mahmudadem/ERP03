# Main Shell Chrome

## Scope

The main shell is the production tenant shell. Apex remains historical candidate-shell work and is not the current cutover target.

## 2026-06-13 Font and Sidebar Pivot

The owner stopped Apex tenant-shell cutover work and kept one visual requirement: the production main shell should borrow the Apex accordion-sidebar look without adopting Apex shell behavior.

Implementation boundaries:

- `frontend/src/layout/AppShell.tsx` remains the production shell.
- `frontend/src/layout/Sidebar.tsx` still reads `useSidebarConfig()` and preserves existing route, permission, workflow, tenant, and module filtering behavior.
- `frontend/src/components/navigation/SidebarSection.tsx` and `frontend/src/components/navigation/SidebarItem.tsx` apply the Apex-inspired row, child rail, and active-state styling only when `sidebarMode !== 'submenus'`.
- Flyout/submenus mode keeps its existing interaction model and styling path.
- `frontend/src/styles/globals.css` defines `--font-mono` as JetBrains Mono and applies it to main-shell mono, code, tabular numeric, and number-input surfaces.
- `frontend/src/theme/userAppearance.ts` keeps the user appearance font variables aligned so the mono preset also resolves to JetBrains Mono.

## Accounting and Security Boundary

This is a presentation-only chrome change. It does not change posting logic, ledger writes, approvals, period locks, taxes, AR/AP, inventory valuation, report calculations, tenant scoping, RBAC, or sidebar source-of-truth behavior.
