# Task 272 - POS Terminal barcode capture, focus reset, and add feedback

**Date:** 2026-06-27  
**Status:** Implemented on `codex/pos-barcode-scanner-audio`  
**Estimate:** 1-2h  
**Actual:** ~1.1h

## Owner request

When a cashier scans a barcode, POS should add the item to the cart directly even if the search box is not focused. After a barcode scan or manual product selection, focus should return to search so the next item can be entered immediately. Successful barcode adds and manual adds should have distinct lightweight sounds.

## Recommended approach

Use a terminal-level scanner detector in `PosTerminalPage`:

- Treat fast keyboard bursts completed by Enter or Tab as scanner input.
- Disable scanner capture while payment, line edit, void, manager approval, held-cart, or shortcuts dialogs are open.
- Resolve scanned values through the existing POS product search endpoint.
- Prefer exact item `barcode` or `code` matches.
- Add through the same `onAddToCart` path used by manual product selection and shortcuts.

## Architecture and accounting assessment

This is a cashier-entry UX/control fix. It does not change POS sale posting, receipt persistence, tax calculation, stock movement, payment settlement, COGS, voucher posting, approval policy, or tenant boundaries.

The important architecture constraint is that barcode lookup must not bypass the shared item/catalog and pricing path. The existing POS product search uses `IItemRepository.searchItems(...)` and resolves price through Commercial Core before falling back to item `salePrice`; this task keeps that path.

## Acceptance criteria

- Barcode scans from outside the search box add the matching item to the cart.
- Barcode scans from the search box do not behave as normal search Enter.
- Search-result click/manual Enter adds the item, clears search, and refocuses search.
- Barcode add and manual add play different short success tones.
- Scanner capture is blocked while operational dialogs are open.
- No backend posting/accounting behavior changes.

## Verification

- POS locale JSON parsed for English, Arabic, and Turkish.
- `npm --prefix frontend run typecheck` passed.
- `npm --prefix frontend run build` passed, including report, no-confirm, SoD, typecheck, and Vite build gates.
