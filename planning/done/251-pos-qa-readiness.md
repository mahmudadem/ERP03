# Task 251 — POS QA Readiness and Settlement Routing Fix

**Date:** 2026-06-22
**Branch:** `codex/pos-qa-readiness`
**Status:** in progress locally; slices 1-15 green
**Actual time:** ~15.8h so far

## Technical Developer View

This slice compared the POS implementation against the POS golden-path requirements and closed two concrete gaps:

- Payment Methods report now aggregates persisted `PosPayment` rows instead of returning placeholder zeros.
- POS sale and return settlement routing now uses the active register:
  - CASH uses `PosRegister.cashDrawerAccountId`.
  - CARD/BANK_TRANSFER/CUSTOM use `PosRegister.settlementAccountIds[method]`.
  - Missing non-cash register settlement account blocks the sale before receipt/document posting.
- POS settings payment methods now represent behavior rules only; legacy account ids are still validated if an older client sends them, but they are not required for enabled methods.
- Promotions are now hard-disabled by default; promotion tests use an explicit test hook only.
- POS stock movement references now use POS-specific document identity (`POS_DIRECT_SALE`, `POS_RETURN`) instead of Sales document labels.
- POS terminal line removal now voids lines with cashier, timestamp, and reason instead of hard-deleting them. Voided lines are persisted on receipt audit, excluded from posting totals/stock/ledger, and filtered out of returnable quantity.
- POS policy now has manager-override action hooks for `VOID_LINE`, `PRICE_OVERRIDE`, `DISCOUNT_OVERRIDE`, `TAX_OVERRIDE`, `RETURN`, and `REPRINT`. Sale and return use cases enforce the hooks where the current payload supports the action.
- POS registers now persist `defaultPriceListId`, `allowedCashierUserIds`, and `hardwareProfileId`. Allowed cashiers are enforced on shift open; the price-list and hardware fields are stored placeholders for their later integration slices.
- POS shifts now persist expected, counted, and variance totals by payment method. Fully balanced shifts are marked `RECONCILED`. Cash variance still posts over/short GL; non-cash variance is stored for settlement follow-up and does not auto-post.
- POS cashier role policies now support sale-line limits for maximum discount percent/amount and whether manual price/tax overrides are allowed. Sale completion blocks over-limit lines unless the line carries an approved manager override id.
- POS receipt line snapshots now preserve discount type/value, price override flag, tax override flag, and manager override id for audit review.
- POS override audit report API (`/tenant/pos/reports/override-audit`) returns rows for voided lines, manual discounts, price overrides, and tax overrides.
- POS returns now subtract prior POS returns before validating remaining returnable quantity.
- Posted receipt void now creates a POS return for all remaining active receipt quantities and marks the receipt `VOIDED` inside the same transaction after the return is persisted.
- POS exchange now creates one linked POS return and one linked replacement POS sale with the same `exchangeId`, and reports net due/refund for the cashier.
- POS hold/recall now stores suspended carts as `PosHeldCart` records with `HELD`, `RECALLED`, and `CANCELLED` status. Holding a cart does not reserve stock, consume receipt numbers, create payments, or post accounting; recall restores the cart for later payment.
- POS Override Audit now has a dedicated ReportContainer page under POS Reports.
- POS Returns now has a cashier-facing **Exchange** mode that collects returned receipt lines, replacement POS item lines, replacement payment method/reference, and posts through the existing exchange API.
- POS sale posting now blocks inactive items, POS-disabled/POS-blocked item metadata, and manual/promotion discounts on non-discountable POS items before stock or ledger writes.
- POS Top Selling Items report now ranks completed receipt lines by item, excluding voided lines.
- POS receipt reprint now checks `REPRINT` manager-override policy, writes a `POS_RECEIPT` record-change audit row, and exposes `/tenant/pos/reports/reprint-audit`.
- POS Cancelled Receipts report now lists only POS receipts already marked `VOIDED` after the reversal/return flow.
- POS manager approval capture now has a cashier-facing UI and backend endpoint. `/tenant/pos/manager-overrides` creates an audited `mgr_override_*` id; the terminal can attach it to voided lines and sale-line overrides, and the return/exchange page attaches it to POS returns/exchanges. Exchange forwards the same id to both return and replacement sale legs.
- POS QA/docs were updated to check POS policy, register-level settlement accounts, and real payment report totals.

Files changed:

- `backend/src/application/pos/use-cases/CompletePosSaleUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosReturnUseCase.ts`
- `backend/src/application/pos/use-cases/CompletePosExchangeUseCase.ts`
- `backend/src/application/pos/use-cases/PosManagerOverrideUseCases.ts`
- `backend/src/application/pos/use-cases/PosRegisterUseCases.ts`
- `backend/src/application/pos/use-cases/PosHeldCartUseCases.ts`
- `backend/src/application/pos/use-cases/PosShiftUseCases.ts`
- `backend/src/application/pos/use-cases/PostPosSaleUseCase.ts`
- `backend/prisma/schema.prisma`
- `backend/src/application/pos/use-cases/PosReportingUseCases.ts`
- `backend/src/application/pos/use-cases/PosSettingsUseCases.ts`
- `backend/src/application/system-core/commercial/CommercialCore.ts`
- `backend/src/application/system-core/PolicyEngine.ts`
- `backend/src/api/controllers/pos/PosController.ts`
- `backend/src/api/routes/pos.routes.ts`
- `backend/src/domain/inventory/entities/StockMovement.ts`
- `backend/src/domain/pos/entities/PosReceipt.ts`
- `backend/src/domain/pos/entities/PosReturn.ts`
- `backend/src/domain/pos/entities/PosRegister.ts`
- `backend/src/domain/pos/entities/PosHeldCart.ts`
- `backend/src/domain/pos/entities/PosShift.ts`
- `backend/src/domain/pos/entities/POSPolicy.ts`
- `frontend/src/api/posApi.ts`
- `frontend/src/modules/pos/components/ManagerOverrideCapture.tsx`
- `frontend/src/modules/pos/pages/PosTerminalPage.tsx`
- `frontend/src/modules/pos/pages/PosReturnPage.tsx`
- `frontend/src/modules/pos/pages/PosOverrideAuditReportPage.tsx`
- `frontend/src/modules/pos/pages/PosTopSellingItemsReportPage.tsx`
- `frontend/src/modules/pos/pages/PosReprintAuditReportPage.tsx`
- `frontend/src/modules/pos/pages/PosCancelledReceiptsReportPage.tsx`
- `backend/src/tests/application/pos/CompletePosSale.test.ts`
- `backend/src/tests/application/pos/CompletePosReturn.test.ts`
- `backend/src/tests/application/pos/PosShiftUseCases.test.ts`
- `backend/src/tests/application/pos/PostPosSale.test.ts`
- `backend/src/tests/application/pos/PostPosReturn.test.ts`
- `backend/src/tests/application/pos/PosReporting.test.ts`
- `backend/src/tests/application/pos/ReprintPosReceiptUseCase.test.ts`
- `backend/src/tests/application/pos/PosManagerOverrideUseCases.test.ts`
- `backend/src/tests/application/pos/PosHeldCartUseCases.test.ts`
- `backend/src/tests/application/pos/PosSettingsUseCases.test.ts`
- `backend/src/tests/architecture/SystemCoreBoundaries.test.ts`
- `docs/architecture/pos.md`
- `docs/user-guide/pos/setup.md`
- `docs/user-guide/pos/selling.md`
- `docs/user-guide/pos/returns.md`
- `docs/user-guide/pos/reports.md`
- `planning/qa/golden-paths/06-pos.md`
- `planning/qa/pos-owner-test-guide.md`
- `planning/tasks/251-pos-qa-readiness-and-requirements-gap-plan.md`

## End-User View

POS now behaves closer to a real retail till setup. Each register has its own cash drawer and card/bank settlement accounts, so money from `POS-01` does not accidentally post to `POS-02` or a company-level placeholder account. The Payment Methods report now shows actual CASH/CARD/BANK/CUSTOM totals from completed receipts, with CASH reduced by change given.

Cashiers now void entered cart lines instead of deleting them. A voided line stays visible on the receipt audit trail with the reason and user, but it does not affect the sale total, stock, ledger, tax, cash, or returnable quantity.

POS can now enforce and capture manager approval for sensitive cashier actions by role policy. Cashiers can open a **Capture approval** dialog, select the approving manager, enter a reason, and attach the generated approval id to line voids, restricted sale-line overrides, returns, or exchanges. The approval is recorded in the audit trail. This is not yet a manager PIN/password challenge; it is an auditable approval capture for pilot control.

Cashier role policies can now also define hard limits for line discounts and whether manual price or tax edits are allowed. If a cashier exceeds those limits without a manager override id, the backend blocks the sale before any receipt, stock movement, ledger entry, or payment row is created. Managers can review exceptions through the override audit report.

Posted receipt cancellation now behaves like a real POS financial reversal. The system creates a POS return for the remaining active quantities, reverses stock/settlement through the existing return path, and then marks the original receipt voided. Prior returns reduce the remaining quantity, so the same unit cannot be refunded twice.

Exchange now uses the same safe return and sale paths. The returned item comes back through POS return, the replacement item goes out through POS sale, and both records share an exchange id. The response shows whether the customer owes extra or should receive a net refund.

Cashiers can now hold and recall sales. Holding saves the active cart on the server and clears the terminal for the next customer. Recalling restores the held cart. Cancelling a held sale removes it from the active held list. None of those actions posts inventory, payment, receipt, or ledger activity until the cashier completes payment.

Managers now have a POS **Override Audit** report page for voided lines, manual discounts, price overrides, and tax overrides. This uses the same report shell as the other POS reports.

Cashiers can now process exchanges from **POS → Returns** by switching to **Exchange**, selecting returned receipt quantities, adding replacement POS items, and posting the linked return plus replacement sale. The screen shows the return value, replacement value, and net due/refund before posting.

POS now blocks unsafe item sale attempts at the backend posting boundary. Inactive items cannot be sold. Items can also be marked in metadata as disabled for POS, blocked for POS, or non-discountable; those rules are enforced before stock, receipt, payment, or ledger activity is created.

Managers now have a **Top Selling Items** report under POS Reports. It shows completed POS receipt lines ranked by quantity sold and gross sales, excluding voided lines.

Managers now have a **Reprint Audit** report under POS Reports. Receipt reprints are recorded with the cashier and manager override id when supplied. If the cashier role requires reprint approval, the backend blocks the reprint until a manager override id is provided.

Managers now have a **Cancelled Receipts** report under POS Reports. It lists posted POS receipts marked `VOIDED` after the proper return/reversal flow. It does not cancel receipts by itself.

Registers now carry the missing P0 setup fields: default price list id, allowed cashiers, and hardware profile id. If a register has allowed cashiers selected, other users cannot open a shift on that register.

Shift close now supports per-method reconciliation. Cashiers count CASH, CARD, BANK_TRANSFER, and CUSTOM separately. If every method balances, the shift becomes `RECONCILED`. If cash differs, the normal cash over/short voucher is posted. If non-cash differs, the difference is saved for review but does not post automatically.

Promotions remain off for production POS. The system will not silently apply flash sales, BXGY, coupons, or free-gift rules until the missing stacking/cap/conflict/return model is implemented.

For testing, use `planning/qa/pos-owner-test-guide.md` first, then run the full `planning/qa/golden-paths/06-pos.md`.

## Tests

- `npm test -- --runInBand src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/CompletePosReturn.test.ts src/tests/application/pos/PosSettingsUseCases.test.ts src/tests/application/pos/PosReporting.test.ts` — passed, 4 suites / 31 tests.
- `npm test -- --runInBand src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/CompletePosReturn.test.ts` — passed, 2 suites / 21 tests after void-line slice.
- `npm test -- --runInBand src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/CompletePosReturn.test.ts` — passed, 3 suites / 28 tests after manager-override slice.
- `npm test -- --runInBand src/tests/application/pos/PosShiftUseCases.test.ts` — passed, 1 suite / 11 tests after register-defaults slice.
- `npm test -- --runInBand src/tests/application/pos/PosShiftUseCases.test.ts` — passed, 1 suite / 12 tests after shift-reconciliation slice.
- `npm test -- --runInBand src/tests/application/pos/CompletePosSale.test.ts src/tests/application/pos/PolicyEnginePosPolicy.test.ts src/tests/application/pos/PosReporting.test.ts` — passed, 3 suites / 29 tests after price/discount/tax policy slice.
- `npm test -- --runInBand src/tests/application/pos/CompletePosReturn.test.ts` — passed, 1 suite / 10 tests after posted-receipt void slice.
- `npm test -- --runInBand src/tests/application/pos/CompletePosExchange.test.ts` — passed, 1 suite / 3 tests after exchange slice.
- `npm test -- --runInBand src/tests/application/pos/PosHeldCartUseCases.test.ts` — passed, 1 suite / 5 tests after hold/recall slice.
- `npm test -- --runInBand src/tests/application/pos` — passed, 10 suites / 71 tests.
- `npm test -- --runInBand src/tests/architecture/SystemCoreBoundaries.test.ts` — passed, 13 tests.
- `npm run typecheck` from `backend/` — passed.
- `npm run build` from `backend/` — passed.
- `npm --prefix frontend run typecheck` — passed after repairing the local `frontend/node_modules` install.
- `npm --prefix frontend run build` — passed.
- `npm --prefix frontend run check:reports` — passed after Override Audit page wiring.
- `npm --prefix frontend run typecheck` — passed after cashier-facing exchange UI slice.
- `npm test -- --runInBand src/tests/application/pos/CompletePosExchange.test.ts` — passed, 1 suite / 3 tests after cashier-facing exchange UI slice.
- `npm --prefix frontend run build` — passed after cashier-facing exchange UI slice.
- `npm test -- --runInBand src/tests/application/pos/PosManagerOverrideUseCases.test.ts src/tests/application/pos/CompletePosExchange.test.ts` — passed, 2 suites / 6 tests after manager approval capture UI slice.
- `npm run typecheck` from `backend/` — passed after manager approval capture UI slice.
- `npm --prefix frontend run typecheck` — passed after manager approval capture UI slice.
- `npm run build` from `backend/` — passed after manager approval capture UI slice.
- `npm --prefix frontend run check:reports` — passed with 34 report routes after manager approval capture UI slice.
- `npm --prefix frontend run build` — passed after manager approval capture UI slice; existing bundle-size/Browserslist/baseline-data warnings remain.
- `npm test -- --runInBand src/tests/application/pos/PostPosSale.test.ts` — passed, 1 suite / 10 tests after item selling-policy guard slice.
- `npm run typecheck` from `backend/` — passed after item selling-policy guard slice.
- `npm run build` from `backend/` — passed after item selling-policy guard slice.
- `npm test -- --runInBand src/tests/application/pos/PosReporting.test.ts` — passed, 1 suite / 7 tests after Top Selling Items report slice.
- `npm --prefix frontend run check:reports` — passed with 32 report routes after Top Selling Items report slice.
- `npm --prefix frontend run typecheck` — passed after Top Selling Items report slice.
- `npm run typecheck` from `backend/` — passed after Top Selling Items report slice.
- `npm run build` from `backend/` — passed after Top Selling Items report slice.
- `npm --prefix frontend run build` — passed after Top Selling Items report slice.
- `npm test -- --runInBand src/tests/application/pos/ReprintPosReceiptUseCase.test.ts src/tests/application/pos/PosReporting.test.ts` — passed, 2 suites / 10 tests after Reprint Audit backend slice.
- `npm run typecheck` from `backend/` — passed after Reprint Audit backend slice.
- `npm run build` from `backend/` — passed after Reprint Audit backend slice.
- `npm --prefix frontend run check:reports` — passed with 33 report routes after Reprint Audit report page.
- `npm --prefix frontend run typecheck` — passed after Reprint Audit report page.
- `npm --prefix frontend run build` — passed after Reprint Audit report page.
- `npm test -- --runInBand src/tests/application/pos/PosReporting.test.ts` — passed, 1 suite / 9 tests after Cancelled Receipts backend slice.
- `npm run typecheck` from `backend/` — passed after Cancelled Receipts backend slice.
- `npm run build` from `backend/` — passed after Cancelled Receipts backend slice.
- `npm --prefix frontend run check:reports` — passed with 34 report routes after Cancelled Receipts report page.
- `npm --prefix frontend run typecheck` — passed after Cancelled Receipts report page.
- `npm --prefix frontend run build` — passed after Cancelled Receipts report page.

## Known Follow-Ups

- Promotions remain production-gated until the stacking/cap model is implemented.
- Cashier-facing manager approval capture is now available for terminal voids, sale-line overrides, returns, and exchanges. A future hardening slice should add manager PIN/password authentication.
- Default price-list and hardware-profile fields are persisted but not consumed by pricing/device integrations yet.
- POS item enabled/blocked/discountable flags are currently metadata-enforced; a first-class item-master UI for these flags is still a follow-up.
- Expiry/batch-aware item guards are still a follow-up because current item master does not model POS batch expiry at sale-line level.
- SQL deployments need a Prisma migration for the new POS shift reconciliation and held-cart fields before using them in SQL mode.
- Held carts do not reserve stock in V1; stock availability is rechecked when the recalled sale is completed.
- Accounting voucher enum still uses existing Sales Invoice / Sales Return voucher types for GL classification while POS metadata and stock refs preserve POS identity. Adding separate POS voucher types needs an accounting-policy review.
- Branch is still free text on POS registers; a first-class Branch entity is a later product decision.
- Owner still needs to run the POS golden path in the browser/API on a fresh tenant.
