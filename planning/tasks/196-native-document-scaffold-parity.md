# 196 — Native Document Scaffold Parity

**Status:** Completed 2026-06-09
**Owner:** Codex
**Started:** 2026-06-09
**Estimate:** 8-12 hours total, split into safe slices

## Goal

Make Sales Invoice and Purchase Invoice the visual and interaction standard for native operational documents. The remaining Sales/Purchases document detail pages and related operational list pages should use the same shared anatomy, with only document-specific fields, columns, actions, and accounting-safe data changing.

## Scope

- Shared SI/PI-style detail scaffold primitives.
- Shared line item table component for native document lines.
- Consistent right rail ordering across document pages:
  1. Info / Source
  2. Document or posting readiness/status
  3. Settlement/payment where applicable
  4. Totals
- Detail-page migration for Sales Order, Delivery Note, Sales Return, Purchase Order, Goods Receipt, and Purchase Return.
- Related list-page parity for document lists, including weaker legacy pages such as Goods Receipts and Purchase Returns.

## Accounting Boundary

This is a UI/data-entry consistency task only. It must not change posting, tax calculation, inventory valuation, settlement payloads, approval behavior, period-lock behavior, AP/AR balances, or ledger writes.

## Acceptance Criteria

- All transactional Sales/Purchases native detail pages use the shared document scaffold or an explicitly documented reason if a page remains outside it.
- All line-item sections use the shared table shell; document pages only supply different columns.
- Shared selectors remain mandatory for entity references; no raw text ID inputs are introduced.
- Rail order is consistent across pages.
- Related operational lists use `OperationalListLayout` and `DataTable` with inline filters, quick status pills where applicable, centered cells, and row actions.
- Frontend typecheck and production build pass.
- Architecture docs, user guide notes, QA queue, ACTIVE, and JOURNAL are updated.

## Slices

1. Shared component contract and first migrations: SO + DN.
2. Sales Return + Purchase Order detail anatomy.
3. Goods Receipt + Purchase Return detail/list parity.
4. Quotation/list audit and docs/QA closeout.
