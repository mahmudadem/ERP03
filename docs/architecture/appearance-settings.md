# Appearance Settings & Theme Engine Architecture

This document describes the design and implementation of the ERP03 Appearance Lab and the underlying client-side theme engine.

## Overview

ERP03 supports client-side, dynamic UI personalization. Users can choose from predefined color presets, auto-generate harmonic light and dark themes from a single base color, customize border rounding, spacing/density, and font families.

All styling tokens are injected into the DOM as CSS custom variables at runtime, which are then consumed by Tailwind utility classes.

## Files

- `frontend/src/theme/userAppearance.ts` — Contains preset configurations, type interfaces, LocalStorage management, and the `applyUserAppearanceToDocument` engine.
- `frontend/src/styles/theme.css` — Core theme variables mapping, utilities (glass, gradient text), and default scrollbar styles.
- `frontend/src/modules/settings/pages/AppearanceSettingsPage.tsx` — The frontend controller ("Appearance Lab") exposing the theme customizer, Magic Generator, and JSON export.

## Theme Token Structure

A theme is represented by the `UserAppearanceSettings` interface:

```typescript
export interface UserAppearancePalette {
  bgPrimary: string;    // Surfaces, cards, panels
  bgSecondary: string;  // Page backgrounds, sidebar surface (secondary)
  bgTertiary: string;   // Muted headers, inputs, disabled state background
  textPrimary: string;  // Primary text color
  textSecondary: string;// Subheadings, labels
  textMuted: string;    // Placeholder, low-priority captions
  border: string;       // Border color
}

export interface UserAppearanceSettings {
  id: string;
  name: string;
  primary: string;      // Primary brand/action color
  accent: string;       // Secondary highlight color
  success: string;
  warning: string;
  danger: string;
  light: UserAppearancePalette;
  dark: UserAppearancePalette;
  radius: number;       // Base border radius in pixels (e.g. 6px, 12px)
  density: 'compact' | 'comfortable' | 'spacious';
  sidebarSurface: 'default' | 'contrast' | 'secondary';
  shadowIntensity: 'flat' | 'subtle' | 'pronounced' | 'glass';
  fontFamily: 'system' | 'inter' | 'roboto' | 'outfit' | 'mono' | 'cairo';
}
```

## Key Mechanisms

### 1. Dynamic CSS Custom Properties Injection
When a user updates their theme preference (or at app startup), `applyUserAppearanceToDocument()` converts the structured settings object into specific CSS variables and updates the HTML document root:

```typescript
const vars: Record<string, string> = {
  '--color-bg-primary': palette.bgPrimary,
  '--color-bg-secondary': palette.bgSecondary,
  '--color-border': palette.border,
  '--color-primary': settings.primary,
  ...
};
Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
```

### 2. Sidebar Surface Modes
The `sidebarSurface` attribute controls where the sidebar gets its background and text colors:
* `'default'`: The sidebar surface color matches the theme's `bgPrimary` (usually white in light mode).
* `'secondary'`: The sidebar surface color matches `bgSecondary` (page background). This is used in themes like **Tailwind Play** to distinguish the navigation tree from main content panels.
* `'contrast'`: The sidebar surface matches the brand's primary color, forcing white text and high-contrast styling.

### 3. Dynamic Tailwind Color Interpolation (color-mix)
Tailwind utilities (e.g. `bg-primary-50`, `text-primary-700`) are compiled at build time. To keep these dynamic across different custom primary colors without rebuilding Tailwind CSS, `userAppearanceStyleTag` maps them at runtime using CSS `color-mix()` relative to the active theme's primary color:

```css
.bg-primary-50 {
  background-color: color-mix(in srgb, var(--color-primary) 8%, transparent) !important;
}
.bg-primary-100 {
  background-color: color-mix(in srgb, var(--color-primary) 15%, transparent) !important;
}
.text-primary-700 {
  color: color-mix(in srgb, var(--color-primary) 85%, black) !important;
}
```

This guarantees active navigation states, badge backdrops, and highlights dynamically adapt to the exact hue of the selected preset.

### 4. Coordinated Border Radius & Densities
Corner roundings automatically cascade. For example:
* `--radius-lg` matches the theme's base `radius` (e.g. `6px` or `12px`).
* `--radius-md` resolves to `Math.max(4, settings.radius - 4)px`.
* `--radius-sm` resolves to `Math.max(2, settings.radius - 6)px`.

Components (sidebar link lists, topbar widgets, buttons) use custom rounding variables (e.g., `rounded-[var(--radius-md)]`) to synchronize their borders dynamically.

### 5. Top-level Direct Sidebar Links
To support direct links like **Home** at the top of the sidebar section list:
* `SidebarSection.tsx` accepts an optional `path` property.
* If `path` is defined, the section renders a `NavLink` directly to that route instead of an accordion button, allowing it to navigate instantly when clicked.
* Active state classes are automatically applied via `NavLink` matching rules.

### 6. Accordion Child Item Icon Policy
To prevent sidebar visual clutter and match standard modern design grids:
* Inline child sidebar links (when `isChild` is true and `isFlyout` is false) omit their icons and display only clean indented text.
* Popover submenus (flyouts) continue rendering icons to maintain usability in compact modes.

### 7. Sidebar Search & Filter Engine
To facilitate rapid navigation, the sidebar includes a dynamic search input:
* **Keyboard Shortcut:** Pressing `Ctrl + G` anywhere on the page focuses the search input.
* **Client-Side Filtering:** As the user types, the sidebar's `filteredSections` selector filters top-level sections, menus, and sub-items in real-time. If a child matches, the parent section is automatically kept open and only matching children are shown.
* **Typing UI:** The input is styled font-mono for the `tailwind-play` theme, matching design specs.

### 8. Borderless TopBar Customization
To match design layouts where the canvas blends into a single flat background:
* When the `tailwind-play` theme is active, `TopBar.tsx` suppresses the bottom border (`border-b-0`) and shadow (`shadow-none`).
* The widgets grid, notification icon, profile switcher, and layout actions remain fully active in the same location but sit on a flat background without separating lines.

### 9. Tailwind Play Sandbox Dev Page
A dedicated page is registered at `/dev/tailwind-play-demo` in `routes.config.ts` to test layout parity:
* **URL Path:** `/dev/tailwind-play-demo`
* **Features:** A dynamic table mapping `ITEM CODE`, `ITEM NAME`, `WAREHOUSE`, and `AVAILABLE QTY` columns with right-aligned numeric data.
* **Interactive Seeding:** The "Actions" dropdown includes a "Seed Demo Data" function that checks for warehouses, creates `ITEM-001` (Raw Steel Sheets), and records an opening stock of `1,200` units to mirror the exact screenshot configuration under active database connections.

### 10. Glossy 3D Fluent Icons Mapping (Icon Parity)
To match the exact glossy 3D icons from the Tailwind Play design:
* A static `FLUENT_3D_ICON_MAP` dictionary maps Lucide key names (e.g. `Home`, `Package`, `HandCoins`) to raw GitHub URLs from Microsoft's official [microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji) repository.
* When the active appearance theme is `tailwind-play`, the rendering engines inside both `SidebarItem.tsx` and `SidebarSection.tsx` intercept standard icons and display these high-quality pre-rendered 3D PNG images (sized `w-7 h-7` when collapsed and `w-4 h-4` when expanded) using `<img>` tags.
* This delivers identical high-fidelity 3D aesthetics across all operating systems and browsers, bypassing default, flat 2D OS emoji font rendering (like standard Segoe UI Emoji on Windows).
* **Border & Shadow styling:** In collapsed mode (`!isOpen`), active icons under the `tailwind-play` theme render inside a white card with a border (`bg-white border border-slate-200 shadow-sm`) that stands out on the slate-50 background, while inactive icons render on `bg-[var(--color-bg-tertiary)]` (slate-100) and animate to the active card style on hover.

### 11. Compact Layout Mode (Zero-Duplication App Shell)
To provide a high-density, premium interface inspired by the Apex Ledger layout without introducing codebase duplication or component drift, the system integrates a global `layoutMode: 'legacy' | 'compact'` user preference:
* **Context & Persistence:** `layoutMode` is managed via `UserPreferencesContext.tsx` and the `useLayoutMode` helper hook. It is persisted locally in `localStorage` under `erp_layout_mode` and serialized dynamically within the JSON settings of the backend DB.
* **Ambient CSS Injection:** When compact layout mode is active, the AppShell adds a `data-layout="compact"` attribute to the document root and injects `.compact-content-area` styles.
* **CSS Custom Variables Scoping:** Scoped overrides defined in `compact-layout.css` override backgrounds (`#FAFAFB` in light mode, `#0F172A` in dark mode), tighten margins/paddings, and enforce a clean card border/shadow design.
* **Component Adaptation:**
  * **AppShell & TopBar:** The AppShell constrains content max-width to `80rem` and centers it, while the TopBar uses clean backgrounds and a border.
  * **Sidebar navigation:** The sidebar background shifts to match the page, and section headings display styled divider lines (`.compact-section-separator`). Active sidebar links use a clean left-border indicator instead of background overlays, preventing design conflicts.


