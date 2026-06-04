# Task 166 — Compact Layout Mode

**Goal:** Add a `layoutMode: 'legacy' | 'compact'` user preference that visually re-skins the existing AppShell, Sidebar, and TopBar. **ZERO new shell/sidebar/topbar components.** Same code, different CSS classes/tokens.

**Time estimate:** ~4.5h  
**Branch:** `feat/init-wizard-forms-selection` (or current working branch)

---

## Critical Rules

1. **NO new shell components.** Do NOT create `CompactShell.tsx`, `CompactSidebar.tsx`, or `CompactTopBar.tsx`. All changes go into the existing files.
2. **100% feature parity.** Every feature in legacy must work identically in compact. Every sidebar item, every topbar widget, every flyout, every pin/dock, every search, every company settings link, every MDI window.
3. **Dark mode mandatory.** Compact layout must look correct in both light and dark themes.
4. **Follow existing patterns.** The codebase already has `isTailwindPlayTheme` and `isAccordionMode` conditional branches — use the same pattern for `isCompact`.

---

## Phase 1 — Layout Mode Preference (~0.5h)

### 1.1 Type Definition

**File:** `frontend/src/context/UserPreferencesContext.tsx`

Add alongside existing types (line 13-15):
```ts
export type LayoutMode = 'legacy' | 'compact';
```

### 1.2 Context State

**File:** `frontend/src/context/UserPreferencesContext.tsx`

Follow the exact pattern of `sidebarMode` (which is also a string union preference):

- Add `layoutMode: LayoutMode` to `UserPreferencesContextType` interface
- Add `setLayoutMode: (mode: LayoutMode) => void` to interface
- Add `toggleLayoutMode: () => void` to interface
- Add state: `const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => (localStorage.getItem('erp_layout_mode') as LayoutMode) || 'legacy');`
- Add localStorage persistence effect (follow `sidebarMode` pattern at line 136-138)
- Add to `savePreferences()` payload (line 169)
- Load from server prefs (line 97-103 area — add `if (prefs.layoutMode) setLayoutModeState(prefs.layoutMode);`)
- Add setter: `const setLayoutMode = (mode: LayoutMode) => setLayoutModeState(mode);`
- Add toggle: `const toggleLayoutMode = () => setLayoutModeState(prev => prev === 'legacy' ? 'compact' : 'legacy');`
- Add to Provider value object
- **ALSO** add to the fallback context (`useUserPreferencesContext` function starting at line 246) — follow exact pattern of other fallback prefs

### 1.3 Convenience Hook

**File (NEW):** `frontend/src/hooks/useLayoutMode.ts`

```ts
import { useUserPreferences } from './useUserPreferences';

export const useLayoutMode = () => {
  const { layoutMode, setLayoutMode, toggleLayoutMode } = useUserPreferences();
  return {
    layoutMode,
    isCompact: layoutMode === 'compact',
    isLegacy: layoutMode === 'legacy',
    setLayoutMode,
    toggleLayoutMode,
  };
};
```

NOTE: `useUserPreferences` is the re-export hook — check `frontend/src/hooks/useUserPreferences.ts` for its location and ensure `layoutMode`, `setLayoutMode`, `toggleLayoutMode` are re-exported.

---

## Phase 2 — CSS Tokens + Compact Theme (~0.5h)

### 2.1 Compact Layout CSS

**File (NEW):** `frontend/src/layout/compact-layout.css`

Scoped via `[data-layout="compact"]` attribute on the root shell div:

```css
/* ============================================
   Compact Layout Mode — Ambient CSS Overrides
   ============================================
   Applied via data-layout="compact" on the AppShell root div.
   These override CSS variables and target common UI patterns
   so pages look "compact" without any per-page code changes.
   ============================================ */

/* --- Content Area --- */
[data-layout="compact"] .compact-content-area {
  max-width: 80rem; /* max-w-7xl */
  margin-left: auto;
  margin-right: auto;
  padding: 1.25rem;
}

/* --- Light mode surfaces --- */
[data-layout="compact"] {
  --compact-content-bg: #FAFAFB;
  --compact-sidebar-bg: #FAFAFB;
  --compact-topbar-bg: rgba(250, 250, 251, 0.85);
  --compact-card-border: #E2E8F0;
  --compact-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  --compact-separator-color: #E2E8F0;
  --compact-active-bg: rgba(59, 130, 246, 0.08);
  --compact-active-border: #3B82F6;
  --compact-active-text: #2563EB;
}

/* --- Dark mode surfaces --- */
[data-layout="compact"].dark,
.dark [data-layout="compact"] {
  --compact-content-bg: #0F172A;
  --compact-sidebar-bg: #0F172A;
  --compact-topbar-bg: rgba(15, 23, 42, 0.85);
  --compact-card-border: #334155;
  --compact-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  --compact-separator-color: #334155;
  --compact-active-bg: rgba(59, 130, 246, 0.15);
  --compact-active-border: #60A5FA;
  --compact-active-text: #93C5FD;
}

/* --- Sidebar active item override --- */
[data-layout="compact"] .sidebar-item-active {
  background-color: var(--compact-active-bg) !important;
  border-left: 2px solid var(--compact-active-border);
  color: var(--compact-active-text) !important;
}
[data-layout="compact"][dir="rtl"] .sidebar-item-active {
  border-left: none;
  border-right: 2px solid var(--compact-active-border);
}

/* --- Section separators in sidebar --- */
[data-layout="compact"] .compact-section-separator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  margin-top: 0.25rem;
  font-size: 0.625rem; /* 10px */
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  user-select: none;
}
[data-layout="compact"] .compact-section-separator::before,
[data-layout="compact"] .compact-section-separator::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--compact-separator-color);
}

/* --- Ambient card styling --- */
[data-layout="compact"] .rounded-lg,
[data-layout="compact"] .rounded-xl {
  border-color: var(--compact-card-border);
}

/* --- Table density --- */
[data-layout="compact"] table tbody td {
  padding-top: 0.375rem;
  padding-bottom: 0.375rem;
  font-size: 0.8125rem;
}
```

### 2.2 Import the CSS

**File:** `frontend/src/main.tsx` (or wherever global CSS is imported)

Add: `import './layout/compact-layout.css';`

---

## Phase 3 — Shell, Sidebar, TopBar Conditional Styling (~2.5h)

### 3.1 AppShell.tsx

**File:** `frontend/src/layout/AppShell.tsx`

Changes:
1. Import `useLayoutMode` (or read `layoutMode` from `useUserPreferences`)
2. Add `data-layout` attribute to root div:
   ```tsx
   <div
     className={clsx(
       "h-screen flex flex-col ... font-sans overflow-hidden",
       isCompact && "bg-[var(--compact-content-bg)]"
     )}
     data-layout={isCompact ? 'compact' : 'legacy'}
   >
   ```
3. Content area — add `compact-content-area` class:
   ```tsx
   <main className={clsx(
     "flex-1 relative overflow-hidden ...",
     isCompact && "bg-[var(--compact-content-bg)]"
   )}>
     <div className={clsx(
       "h-full overflow-y-auto custom-scroll ...",
       isCompact && "compact-content-area"
     )}>
       <Outlet />
     </div>
   </main>
   ```
4. Pass `isCompact` to `<Sidebar>` and `<TopBar>` as props (or let them read from `useLayoutMode()` internally — your choice, both work)

### 3.2 Sidebar.tsx

**File:** `frontend/src/layout/Sidebar.tsx`

Changes:
1. Read layout mode: `const { isCompact } = useLayoutMode();` (or receive as prop)
2. Surface color override — when `isCompact`, override the sidebar background:
   ```tsx
   <aside
     className={clsx(
       "fixed flex flex-col print:hidden transition-all duration-300 ease-out",
       isCompact
         ? "bg-[var(--compact-sidebar-bg)] border-[var(--compact-card-border)]"
         : "bg-[var(--app-sidebar-surface)] border-[var(--color-border)]",
       asideClasses
     )}
   >
   ```
3. Pass `isCompact` to `<SidebarSection>` and `<SidebarItem>`:
   ```tsx
   <SidebarSection
     key={key}
     title={key}
     items={(data as any).items}
     isOpen={isOpen}
     onNavigate={onNavigate}
     iconName={(data as any).icon}
     path={(data as any).path}
     isCompact={isCompact}  // ← ADD
   />
   ```
   Same for `<SidebarItem>` in the accordion branch and in the footer.
4. **DO NOT** remove or change: pin/dock toggle, search input, company settings footer, flyout/accordion branching. These stay exactly as they are.

### 3.3 SidebarSection.tsx

**File:** `frontend/src/components/navigation/SidebarSection.tsx`

Changes:
1. Add `isCompact?: boolean` to props interface
2. When `isCompact`, add section separators before known sub-groups. Detect groups by checking if child items have `children` arrays with known patterns like "Reports", "Tools", "Settings":
   ```tsx
   {isCompact && isKnownSectionBreak(item.label) && (
     <div className="compact-section-separator">{item.label}</div>
   )}
   ```
   Where `isKnownSectionBreak` checks for labels that map to Reports/Tools/Settings sections.
3. Active item styling — when `isCompact`, add `sidebar-item-active` class to the active link (the CSS file handles the rest).
4. **DO NOT** change expand/collapse logic, navigation behavior, icon rendering, badge rendering.

### 3.4 SidebarItem.tsx

**File:** `frontend/src/components/navigation/SidebarItem.tsx`

Changes:
1. Add `isCompact?: boolean` to props interface
2. Active item styling — same `sidebar-item-active` class when active and `isCompact`
3. **DO NOT** change flyout Portal logic, hover behavior, click handlers, positioning.

### 3.5 TopBar.tsx

**File:** `frontend/src/layout/TopBar.tsx`

Changes:
1. Read layout mode: `const { isCompact } = useLayoutMode();`
2. Surface styling:
   ```tsx
   <header
     className={clsx(
       "h-12 flex items-center justify-between px-3 sticky top-0 z-40 shrink-0 print:hidden",
       isCompact
         ? "bg-[var(--compact-topbar-bg)] backdrop-blur-md border-b border-[var(--compact-card-border)]"
         : isTailwindPlayTheme
           ? "bg-[var(--app-topbar-surface)] backdrop-blur-md border-b-0"
           : "bg-[var(--app-topbar-surface)] backdrop-blur-md border-b border-[var(--color-border)] shadow-sm",
     )}
   >
   ```
3. **DO NOT** change: widget rendering, drag-to-reorder, widget style selector, hamburger menu, theme toggle, notification bell, user avatar menu, widget manager dropdown. All stay exactly as they are.

---

## Phase 4 — Appearance Settings + i18n (~1h)

### 4.1 Appearance Settings Page

**File:** Find the appearance settings page (likely `frontend/src/pages/settings/AppearanceSettingsPage.tsx` or similar — search for "appearance")

Add a "Layout" section with two selectable cards:
- **Standard** — current legacy layout (show a mini visual: dark sidebar, full-width content)
- **Compact** — compact layout (show a mini visual: light sidebar, centered content, thinner cards)

Wire to `setLayoutMode()` from `useLayoutMode()`.

### 4.2 i18n

**Files:** `frontend/src/i18n/locales/en.json`, `ar.json`, `tr.json`

Add keys:
```json
{
  "appearance": {
    "layoutMode": "Layout",
    "layoutStandard": "Standard",
    "layoutStandardDesc": "Full-width layout with customizable sidebar",
    "layoutCompact": "Compact",
    "layoutCompactDesc": "Centered content with lighter, denser interface"
  }
}
```

Arabic:
```json
{
  "appearance": {
    "layoutMode": "التخطيط",
    "layoutStandard": "قياسي",
    "layoutStandardDesc": "تخطيط بعرض كامل مع شريط جانبي قابل للتخصيص",
    "layoutCompact": "مدمج",
    "layoutCompactDesc": "محتوى في المنتصف مع واجهة أخف وأكثر كثافة"
  }
}
```

Turkish:
```json
{
  "appearance": {
    "layoutMode": "Düzen",
    "layoutStandard": "Standart",
    "layoutStandardDesc": "Özelleştirilebilir kenar çubuğu ile tam genişlik düzeni",
    "layoutCompact": "Kompakt",
    "layoutCompactDesc": "Daha hafif, daha yoğun arayüz ile ortalanmış içerik"
  }
}
```

---

## Acceptance Criteria (must ALL pass)

### Automated
- [ ] `npm --prefix frontend run typecheck` — 0 errors
- [ ] `npm --prefix frontend run build` — passes (includes `check:reports`, `check:no-confirm`)

### Manual — Compact Mode
- [ ] Toggle to Compact in Appearance Settings → shell changes instantly (no page reload)
- [ ] Toggle back to Standard → shell reverts instantly
- [ ] Sidebar: flyout/submenus mode works in Compact
- [ ] Sidebar: classic/accordion mode works in Compact
- [ ] Sidebar: pin/dock toggle works in Compact
- [ ] Sidebar: search (Ctrl+G) works in Compact
- [ ] Sidebar: company settings footer visible and functional in Compact
- [ ] Sidebar: RBAC filtering works (disabled modules don't show)
- [ ] Sidebar: dynamic forms injection works (voucher forms appear)
- [ ] TopBar: all widgets visible and functional in Compact
- [ ] TopBar: drag-to-reorder works in Compact
- [ ] TopBar: all 9 widget styles work in Compact
- [ ] TopBar: widget show/hide works in Compact
- [ ] TopBar: dark mode toggle works in Compact
- [ ] TopBar: notification bell works in Compact
- [ ] TopBar: user avatar menu works in Compact (profile, appearance, switch company, logout)
- [ ] MDI windows mode (Win/Web toggle) works in Compact
- [ ] Dark mode: Compact looks correct in dark theme
- [ ] RTL: switch to Arabic → Compact mirrors correctly
- [ ] Mobile: sidebar collapses on small viewport in Compact
- [ ] Reports: any report page renders correctly inside Compact shell
- [ ] Sales Invoice: create/edit form renders correctly inside Compact shell
- [ ] Content area is centered with max-width in Compact mode
- [ ] Preference persists across page reload (localStorage)

### Red Lines
- [ ] NO new shell components (`CompactShell`, `CompactSidebar`, `CompactTopBar` must NOT exist)
- [ ] NO feature works in one layout but not the other
- [ ] NO code duplication between layouts

---

## Files Modified (complete list)

| File | Action |
|------|--------|
| `frontend/src/context/UserPreferencesContext.tsx` | MODIFY — add layoutMode state |
| `frontend/src/hooks/useUserPreferences.ts` | MODIFY — re-export layoutMode |
| `frontend/src/hooks/useLayoutMode.ts` | NEW — convenience hook |
| `frontend/src/layout/compact-layout.css` | NEW — scoped CSS overrides |
| `frontend/src/main.tsx` | MODIFY — import compact-layout.css |
| `frontend/src/layout/AppShell.tsx` | MODIFY — data-layout attr + conditional classes |
| `frontend/src/layout/Sidebar.tsx` | MODIFY — isCompact surface + pass to children |
| `frontend/src/layout/TopBar.tsx` | MODIFY — isCompact surface styling |
| `frontend/src/components/navigation/SidebarSection.tsx` | MODIFY — isCompact prop + separators + active style |
| `frontend/src/components/navigation/SidebarItem.tsx` | MODIFY — isCompact prop + active style |
| `frontend/src/pages/settings/AppearanceSettingsPage.tsx` | MODIFY — layout selector |
| `frontend/src/i18n/locales/en.json` | MODIFY — add appearance.layout* keys |
| `frontend/src/i18n/locales/ar.json` | MODIFY — add appearance.layout* keys |
| `frontend/src/i18n/locales/tr.json` | MODIFY — add appearance.layout* keys |

## Reference Files (read but don't modify)

| File | Why |
|------|-----|
| `frontend/src/theme/userAppearance.ts` | Understand existing theme/appearance system |
| `frontend/src/pages/dev/apex-ledger/` | Visual reference for Compact styling (kept as dev reference) |
| `frontend/src/hooks/useSidebarConfig.ts` | Understand sidebar data flow (not modified) |
| `frontend/src/config/moduleMenuMap.ts` | Understand menu structure (not modified) |
