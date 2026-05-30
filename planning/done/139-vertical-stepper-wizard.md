# 139 — Document Wizard Vertical Stepper Layout

**Date:** 2026-05-30
**Agent:** Antigravity (Gemini 3.5 Pro)
**Branch:** `feat/init-wizard-forms-selection`
**Status:** ✅ Implemented & Verified

---

## 1. Technical View (Future Developers)

### Context & Design
The user requested converting the Document Designer wizard step indicator layout from a horizontal step bar at the top of the screen to a vertical stepper panel on the left side of the screen.

### Implementation Details
* **[DocumentDesigner.tsx](file:///d:/DEV2026/ERP03/frontend/src/modules/tools/forms-designer/components/DocumentDesigner.tsx):**
  * Restructured the main container from a full-height column layout (`flex flex-col h-full`) to a horizontal layout container (`flex h-full overflow-hidden`).
  * Created a left-hand sidebar (`w-56 bg-white border-r border-gray-200`) containing a persistent vertical steps view.
  * Extracted the horizontal step bar map rendering into this sidebar as a vertical list.
  * Added a custom vertical connector line styled with absolute positioning (`absolute top-7 w-0.5 bottom-0 -z-0`), connecting step circles sequentially. The connector line inherits a green background (`bg-green-500`) when the source step is completed, and gray (`bg-gray-200`) otherwise.
  * Moved the top header bar, warning banner, main scrollable content area (`renderContent()`), and the action footer bar into a scroll-isolated right-side column flexbox (`flex-1 flex flex-col min-w-0 h-full overflow-hidden`).

---

## 2. End-User View (User Guide)

### What Was Changed

* **Left-Side Step Guide:** 
  * The wizard steps (Template, Basic Info, Rules, Fields, Actions, Visual Editor, Review) are now displayed in a vertical stepper sidebar on the left side of the screen, instead of a horizontal bar at the top.
  * This keeps step status (Active, Completed, Upcoming) persistently visible on the left side while making the form setup options on the right side feel cleaner and more spaced out.

---

## Verification
* **TypeScript compilation (`npm run typecheck:web`):** Passed cleanly (Exit 0).
* **Production Bundle build (`npm run build:web`):** Compiled successfully (Exit 0).
