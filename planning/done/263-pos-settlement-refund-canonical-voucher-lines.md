# Task 263 — Fix `Receipt requires depositToAccountId` (INFRA_999) on POS settlement/refund posting

**Status:** ✅ Complete
**Date completed:** 2026-06-23
**Branch:** `main`
**Time spent:** ~0.7h
**Linked plan:** _(none — hotfix discovered during owner QA, third in the POS posting chain after [261](./261-pos-direct-sale-referencetype-validation.md) and [262](./262-pos-posting-firestore-read-before-write.md))_
**Linked architecture doc:** [`docs/architecture/pos.md`](../../docs/architecture/pos.md) §3
**Linked user guide:** [`docs/user-guide/pos/selling.md`](../../docs/user-guide/pos/selling.md) _(removes a crash; no new feature surface)_

---

## Definition of Done — Checklist

- [x] Code merged _(on `main`)_
- [x] `docs/architecture/pos.md` updated — settlement/refund canonical-line contract documented in §3
- [x] User guide — existing selling guide covers POS sales/returns; this fix removes a crash
- [x] This completion report links the docs above
- [x] `planning/JOURNAL.md` appended
- [x] `planning/ACTIVE.md` updated

---

## 1. Technical Developer View

### What Was Built

Third blocker in the POS posting chain surfaced during owner QA (each prior fix advanced posting to the next gap). After inventory + the revenue/COGS ledger legs posted, the **settlement** leg failed with **"Receipt requires depositToAccountId (Deposit To account)" (INFRA_999)**.

`PostPosSaleUseCase` posts the settlement as a `RECEIPT` voucher via `recordFinancialEvent` with pre-built `{ accountId, side, baseAmount, docAmount }` lines. `ReceiptVoucherStrategy` has two modes: a **canonical** mode that posts caller-supplied JV-style lines verbatim, and a **payload** mode that builds the lines from `depositToAccountId` + `receiveFromAccountId` sources. Its canonical detector only accepts a line when it has `amount > 0` (`ReceiptVoucherStrategy.ts:90-95`). The POS lines carried `baseAmount`/`docAmount` but **not** `amount`, so canonical detection failed, the strategy fell into payload mode, and threw because POS supplies no `depositToAccountId`.

The POS revenue/COGS legs use the `SALES_INVOICE` strategy (reads `baseAmount` directly), which is why only the settlement leg broke. The POS **refund** leg in `PostPosReturnUseCase` (a `PAYMENT` voucher) had the identical latent bug via `PaymentVoucherStrategy`'s matching canonical detector.

Fix: add `amount` to the settlement and refund canonical lines (they already carried `baseAmount`/`docAmount`; for the base-currency POS, `amount === baseAmount === docAmount`). This is the documented canonical-line contract (`side/accountId/amount`); POS simply wasn't honoring it. No shared accounting strategy was changed.

### Files Changed

**Backend**
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts` — settlement (`RECEIPT`) voucher lines now include `amount`.
- `backend/src/application/pos/use-cases/PostPosReturnUseCase.ts` — refund (`PAYMENT`) voucher lines now include `amount`.

**Tests**
- `backend/src/tests/domain/accounting/PosCanonicalVoucherLines.test.ts` (NEW) — runs the **real** `ReceiptVoucherStrategy` / `PaymentVoucherStrategy` against the POS line shape: accepts the new shape (with `amount`) and posts balanced lines; a regression case proves the old shape (no `amount`) still throws `depositToAccountId`. The POS unit tests mock the accounting bridge, so this is the only place that exercises the real strategy contract.

**Docs**
- `docs/architecture/pos.md` §3, `planning/done/263-*.md` (this), `planning/JOURNAL.md`, `planning/ACTIVE.md`.

### Architecture / Behavior

- **No accounting math change.** Same accounts, sides, and amounts; the settlement/refund vouchers post the exact lines POS already built. Only the canonical-line *contract field* (`amount`) was added so the strategy posts them verbatim instead of erroring.
- Verified the shift over/short voucher (`PosShiftUseCases`, `JOURNAL_ENTRY`) already includes `amount` — not affected. POS RECEIPT/PAYMENT postings are exactly the two fixed here.

### Verification

- [x] `cd backend && npx tsc --noEmit` clean
- [x] `cd backend && npm run build` (tsc) clean — recompiled to `lib/` so the emulator serves the fix
- [x] New guard suite + POS sale/return: 3 suites / 22 tests green
- [x] Broad sweep: `pos` + `domain/accounting` + `application/accounting` = 52 suites / 348 tests green
- [x] Manual golden path: complete a POS sale with tender — posts through settlement without the INFRA_999 dialog

### Known Issues / Follow-ups

- The canonical detectors in `ReceiptVoucherStrategy` / `PaymentVoucherStrategy` require `amount` while the rest of the system's programmatic line shape leans on `baseAmount`/`docAmount`. A future cleanup could make those two "compatibility mode" detectors fall back to `docAmount`/`baseAmount` so any standard line shape is accepted — deliberately left out of this hotfix to avoid touching shared accounting strategies.

---

## 2. End-User View

### What's New

The final blocking error when taking payment at the POS till ("Receipt requires depositToAccountId") is fixed. A POS sale now completes end-to-end — stock, revenue, cost, and the customer's payment — and POS refunds post too.

### How to Use It

1. Ring up items, take payment, and complete the sale at the POS terminal.
2. The receipt posts with no error dialog.
3. Refunds on a POS return post the same way.

### Where to Find It

- Menu: POS → Terminal
- No setting to change — the fix is automatic.

### Limitations

- None. Accounts and amounts are unchanged; only the crash is removed.

---

*This report follows the format defined in `AGENTS.md` → Definition of Done.*
