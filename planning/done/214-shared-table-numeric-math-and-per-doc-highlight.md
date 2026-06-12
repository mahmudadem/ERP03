# 214 — Shared line-table: numeric math input, no-negatives, per-document highlight

**Date:** 2026-06-12
**Branch:** `feat/overpayment-credit-balance`
**Type:** UX / behavior (frontend) — shared `ClassicLineItemsTable` (used by SI/PI/SO/DN/Quote/GRN/PR)

## Owner requests

1. **No negative numbers and no characters** in the table's numeric inputs.
2. **Allow arithmetic** in numeric inputs — `5+5` → 10, `5*5` → 25, `100-5` → 95, etc.
3. **Row highlight is document-specific, not shared across all documents** of a type.

## What changed (all in `frontend/src/components/shared/ClassicLineItemsTable.tsx`)

### Numeric inputs (1 + 2) — the shared `NumericCell` (covers `number` cells and back-solve cells)
- **Character filtering on input:** `onChange` strips anything outside `[0-9 . + - * / ( ) space]`, so letters/symbols can never be typed (`abc9` → `9`).
- **Arithmetic on commit (blur/Enter):** new `evaluateNumericExpression()` — a small **shunting-yard** parser (no `eval`/`Function`) supporting `+ - * /` and parentheses with correct precedence and decimals. Binary-float noise is trimmed (`0.1+0.2` → `0.3`).
- **No negatives:** the evaluated result is clamped with `Math.max(0, …)` (a lone `-5` → `0`). Subtraction still works because the clamp applies to the final result, not the operator (`100-5` → `95`).
- **Invalid/incomplete input reverts** to the previous value (`5++`, `1000/0` → keep prior), so a typo doesn't zero the cell.
- Enter already advances focus (table nav) → triggers blur → evaluates; no separate Enter handler needed.

### Row highlight (3)
- `highlightedRows` is now **in-memory component state only** — the `localStorage` read on init and the persist `useEffect` were removed (and the unused `highlightStorageKey`).
- **Why:** highlights were persisted by row **index** under a shared `tableId` (e.g. `sales.invoice.lines`), so highlighting row 2 in one invoice made row 2 look highlighted in **every** invoice of that type. In-memory state scopes the highlight to the open document and resets on navigation — "document-specific, not all."
- **Row colors are unchanged** — that swatch feature is a deliberate per-table persisted preference (Task 201) and was not part of this request. (Semantic split: highlight = transient per-document marker; row color = persisted table styling.)

## Verification

- Frontend `tsc --noEmit`: ✅ · `npm run build`: ✅
- Evaluator unit-checked standalone: `5+5`=10, `5*5`=25, `100-5`=95, `(2+3)*4`=20, `0.1+0.2`=0.3, `-5`→clamp 0, `10/4`=2.5, `5++`/`1000/0`→revert, `2*3+4`=10 (precedence).
- **Live browser** (Sales Invoice line table): `5+5` → shows `5+5` while typing, commits **`10.00`**; `abc9` → **`9`** (letters stripped); `-5` → **blank/0** (clamped).

## Notes

- Frontend-only (React component) — live via HMR, no backend rebuild.
- A stale `…lines.highlights` localStorage key from before this change is now simply ignored (never read); harmless orphan data.
- Applies to every document that uses the shared table (SI/PI/SO/DN/Quote/GRN/PR).
