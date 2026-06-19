# Task 244 — Item card + UOM bug-fix cluster (unblocks 241 cross-UOM testing)

**Status:** Planned (owner manual-test 2026-06-19). **Bugs are PRE-EXISTING — NOT caused by Task 241** (verified: none of these files are in the 241 diff; 241's backend item changes are additive-only and the item list returns full data).
**Module:** Inventory (item master + UOM). **Blocks:** completing 241 cross-UOM / per-currency manual verification.
**Source:** owner manual-test [NOTE-08, 09, 10, 11, 14](../qa/241-manual-test-notes.md).

## Why these are grouped
All five are in the item-master / UOM area and together they block proving 241's per-(currency × UOM) price memory in the real app. None is a 241 regression — they exist independently on `main`.

## Bugs

### NOTE-08 (HIGH) — Item card opens EMPTY when clicking an existing item
- **Repro:** Inventory → Inventory Items → click an existing item ("RUAH CAY", code 001). Modal opens with the correct title but **all fields blank** (CODE/NAME/CATEGORY/…); the **list** shows full data, so the data exists and the API returns it.
- **Suspect:** `frontend/src/modules/inventory/components/ItemMasterCard.tsx` — the populate path (initial form state from the selected item, or a single-item fetch) isn't hydrating the form. Diagnose whether it uses list row data vs a fresh fetch, and why the form state stays empty.
- **Severity:** HIGH — can't view/edit existing items.

### NOTE-14 (HIGH) — Document line only offers the Base UOM; alternate (conversion) UOMs not selectable
- **Repro:** On a sales/purchase line, the item UOM picker shows only BOX + "Open item card to edit UOMs", even though a BOX→PCS conversion exists.
- **Suspect:** `frontend/src/components/shared/selectors/UomSelector.tsx` (`buildItemUomOptions(item, conversions)`, options only expand past base once `conversions` load — `loadItemUoms` only triggers when `options.length > 1`, a chicken-and-egg) + `frontend/src/modules/inventory/utils/uomOptions.ts`. Ensure defined conversions surface as selectable line UOMs reliably.
- **Severity:** HIGH — without this, 241 cross-UOM pricing can't be exercised at all.

### NOTE-10 — UOM conversions allow duplicate From→To pairs
- **Repro:** Item card → ITEM UOM CONVERSIONS → add `BOX→PCS` twice; both rows coexist with different factors.
- **Fix:** enforce uniqueness per `(From, To)` per item (edit existing instead of adding a duplicate); ambiguous factors break deterministic cross-UOM price/cost. Likely in `ItemMasterCard.tsx` conversions section + the backend item conversions write.

### NOTE-11 — UOM conversion Delete not working (should work when unused)
- **Repro:** Same section; trash/delete does nothing even when the row shows `Usage: 0` ("No posted movement uses this conversion yet").
- **Rule:** delete allowed when the conversion is unused (no posted movements). Fix the delete action (wire it; guard only on usage).

### NOTE-09 — Item UOM Conversions section shows in Web mode but NOT Windows mode
- **Repro:** The "ITEM UOM CONVERSIONS" section is visible in Web UI mode, absent in Windows mode.
- **Principle (owner):** the **same content must always render in both modes** — Web vs Windows changes only *how* things render, never *whether* a section appears. Fix the mode-conditional that hides the section; audit for other sections hidden the same way.

## Acceptance / QA
- Clicking an existing item opens the card **fully populated**; edits save and round-trip.
- Defining a BOX→PCS conversion makes **PCS selectable** on document lines; choosing it converts qty to base and (with 241) remembers price per UOM.
- Adding a duplicate `(From,To)` conversion is **blocked** (or updates the existing one).
- Deleting an **unused** conversion works; deleting a **used** one is refused with a clear message.
- The UOM Conversions section renders in **both** Web and Windows modes.
- After fixes, **resume the 241 cross-UOM + per-currency manual QA** (scenarios 8–10 in `planning/done/241-party-item-price-memory.md`).

## Definition of Done
Code merged · relevant `docs/architecture/inventory.md` / user-guide updates · `planning/done/244-*.md` report (QA script) · JOURNAL + ACTIVE updated.
