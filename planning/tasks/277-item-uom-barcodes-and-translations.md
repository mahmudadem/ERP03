# Task 277 — Item UOM barcodes and multilingual UOM names

**Status:** In progress  
**Owner:** Codex  
**Estimate:** 8–12 hours  
**Started:** 2026-06-29

## Goal

Extend the always-on Catalog/Items Core so an item can retain optional general
barcodes and also define one or more barcodes for each supported item UOM.
Scanning a UOM barcode must resolve the item and UOM deterministically. UOM
display names must support English, Arabic, and Turkish through an extensible
language-code map.

## Fixed business rules

- General item barcodes remain optional.
- General and UOM-specific barcodes are unique within a company.
- UOM codes are stable identifiers and are not translated.
- UOM names use language keys (`en`, `ar`, `tr`) with default-name fallback.
- A used conversion factor cannot be edited or deleted. Historical corrections
  require a separate, dated, auditable workflow and must not rewrite history.

## Subtasks

1. UOM translation model, persistence parity, API, UI, and tests — 2–3h.
2. Item-UOM barcode model, persistence parity, uniqueness, and tests — 2–3h.
3. Item Master and POS scan resolution, translations, and tests — 2–3h.
4. Conversion-factor hard lock, documentation, graph update, and full
   verification — 2–3h.

## Acceptance criteria

- Existing item primary and secondary barcodes continue to work.
- An item can assign multiple barcodes to a supported UOM.
- A barcode cannot be reused by another item or UOM in the same company.
- POS scanning a UOM barcode adds the correct item using that UOM.
- UOM screens/selectors display `en`, `ar`, or `tr` names for the active locale.
- Posted use prevents conversion factor modification and deletion at the API.
- Firestore and PostgreSQL persistence remain behaviorally aligned.

