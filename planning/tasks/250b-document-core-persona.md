# 250b — Phase 1: Document Core + `POS_DIRECT_SALE` persona

**Parent:** [250 epic](./250-system-core-transformation-epic.md) · **Phase:** 1 · **Blocking:** 🔴 POS-blocking (do first in Phase 1)
**Depends on:** [250a](./250a-seams-and-interfaces.md) · **Agent:** erp-backend-builder · **Estimate:** 2–3 days
**Status:** ⬜ Not started

## Objective

Make the **document persona a first-class source of truth** that includes `POS_DIRECT_SALE`, and **stop POS from masquerading as a `sales_invoice`**. The persona must survive end-to-end: entity → posting → ledger → reporting.

## Current state (proven)

- Persona enum is only `'direct' | 'linked' | 'service'` ([DocumentPolicyResolver.ts:137-216](../../backend/src/application/common/services/DocumentPolicyResolver.ts:137)).
- POS collapses its sale into a Sales Invoice: `voucherType:'sales_invoice'`, `persona:'direct'`, `formType:'pos_sale'` ([CompletePosSaleUseCase.ts:201-208](../../backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:201)); the comment admits it is a conversion "to avoid rejection."
- The conversion is currently **asserted** by a test: `expect(input.voucherType).toBe('sales_invoice')` ([CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201)).

## Target contract

Extend `IDocumentCore` (from 250a) with the canonical document-type/persona enum:

```
type DocumentPersona =
  | 'SALES_DIRECT_INVOICE'
  | 'SALES_LINKED_INVOICE'
  | 'POS_DIRECT_SALE'
  | 'SERVICE';   // map existing 'service'
```

- Provide a **back-compat mapping** for the legacy `'direct'|'linked'|'service'` strings (read-side tolerant) so existing data/tests don't break, but the **write side** uses the new enum.
- The voucher/ledger layer must **accept the POS persona natively** (carry it through `VoucherEntity.metadata` / source fields and into posting-log + reporting), instead of forcing `voucherType:'sales_invoice'`.

## Scope — files

**Edit:**
- `backend/src/application/common/services/DocumentPolicyResolver.ts` — add persona enum + mapping helpers (keep legacy signatures working via overloads/adapters).
- `backend/src/application/system-core/contracts/IDocumentCore.ts` — expose the enum + `createIdentity`.
- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts:201-217` — stop setting `voucherType:'sales_invoice'` as a disguise; tag the document/voucher with persona `POS_DIRECT_SALE`. (The actual **posting path** change is 250d — here, ensure the persona is *carried*, not flattened.)
- Voucher metadata / source plumbing where `formType:'pos_sale'` is read, so persona is queryable downstream (posting-log, reports).

**Tests:**
- **Invert** [CompletePosSale.test.ts:201](../../backend/src/tests/application/pos/CompletePosSale.test.ts:201): assert the sale persists/posts as `POS_DIRECT_SALE` and is **not** a plain `sales_invoice`. *(This is audit test **T1**.)*
- Add a reporting/ledger read test proving persona reaches the read layer.

## Out of scope (handled elsewhere)

- POS authorization / SalesSettings decoupling → [250c](./250c-policy-engine-pos-decoupling.md).
- POS posting entry point (not constructing `CreateSalesInvoiceUseCase`) → [250d](./250d-pos-posting-entry-point.md).

## Implementation steps

1. Add the persona enum + bidirectional legacy mapping to `IDocumentCore` and `DocumentPolicyResolver`.
2. Thread persona through the voucher/source metadata so it is persisted and readable.
3. In `CompletePosSaleUseCase`, set persona `POS_DIRECT_SALE`; remove the "must be `sales_invoice`" disguise comment and behavior (coordinate the actual accept-natively change with 250d — if 250d lands together, do them as one sequenced pair).
4. Invert T1 and add the persona-reaches-ledger test.
5. Update the reporting read path so POS sales are identifiable by persona (not by `formType` tag alone).

## Acceptance criteria

- [ ] `POS_DIRECT_SALE` exists as a typed persona and is written by POS.
- [ ] No code path rewrites `POS_DIRECT_SALE` → `sales_invoice`.
- [ ] T1 passes in its inverted form; persona-reaches-ledger test passes.
- [ ] Legacy `'direct'|'linked'|'service'` reads still resolve (back-compat test).
- [ ] typecheck + build clean; full suite green (except intended T1 inversion).

## Definition of Done

- [ ] Commit: `feat(system-core): document core persona incl POS_DIRECT_SALE [250b]`
- [ ] `planning/done/250b-document-core-persona.md` report.
- [ ] `docs/architecture/system-core.md` persona section drafted (or stubbed for the epic-end consolidation).

## CTO audit gate

Reject if persona is still flattened anywhere on the POS path, if `formType:'pos_sale'` remains the only POS marker, or if T1 was deleted rather than inverted.
