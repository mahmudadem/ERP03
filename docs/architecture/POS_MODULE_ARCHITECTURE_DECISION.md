# POS Module — Architecture Decision Record

**Status:** Proposed (awaiting owner approval — do not implement yet)
**Author:** Claude Code (CTO role)
**Date:** 2026-06-20
**Module namespace:** `pos`
**Related:** [sales.md](./sales.md), [inventory.md](./inventory.md), [accounting.md](./accounting.md), [reports.md](./reports.md), [accounting-policy-configuration.md](./accounting-policy-configuration.md)

---

## 0. TL;DR

> **Recommended POS architecture: Option C (Hybrid).**
> POS owns the operational layer (register, shift, cart, cash drawer, receipt, X/Z reports, returns UI). Every completed POS sale creates and posts an **official `direct`-persona Sales Invoice** through the existing `CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase` with a `CASH_FULL`/`MULTI` settlement. **No new posting, tax, COGS, or inventory logic is written.** POS returns reuse the existing `AFTER_INVOICE` Sales Return flow.
>
> **Do NOT add a new `workflowMode`.** `workflowMode` stays `SIMPLE`/`OPERATIONAL` as the source of truth. POS uses the existing **`direct` persona** and is gated by a governance rule, so the backend never silently converts direct↔linked.

A critical finding shaped this: **the Sales module already does everything a POS sale needs at the posting level** — direct cash invoices, split-payment settlement to mapped GL accounts, tax (inclusive/exclusive), discounts, COGS, inventory OUT, and uncosted-stock-out policy. Re-posting any of that inside POS would be pure duplication.

---

## 1. Current architecture findings

### 1.1 Layered Clean Architecture (SQL-migration-ready)
The backend is a strict layered architecture (`AGENTS.md` §Architecture Rules):

| Layer | Path | Responsibility |
|-------|------|----------------|
| Domain entities | `backend/src/domain/<module>/entities/` | Pure business objects, no infra |
| Repository interfaces | `backend/src/repository/interfaces/<module>/` | Persistence contracts |
| Use cases (application) | `backend/src/application/<module>/use-cases/` | Orchestration / business rules |
| Firestore impls | `backend/src/infrastructure/firestore/repositories/<module>/` | Persistence |
| DI binding | `backend/src/infrastructure/di/bindRepositories.ts` | Wires interfaces → impls into `diContainer` |
| Controllers (thin) | `backend/src/api/controllers/<module>/` | HTTP only, delegate to use cases |
| Routes | `backend/src/api/routes/<module>.routes.ts` | `authMiddleware` + `permissionsMiddleware(<perm>)` |
| DTOs | `backend/src/api/dtos/<module>DTOs.ts` | Entity↔wire mapping |

Red lines: never bypass DI, never put Firestore code in domain/application, controllers stay thin, register repos in `bindRepositories.ts`. A Prisma/Postgres path exists in parallel (`infrastructure/postgres`, Prisma models) — anything new must be expressible in both, i.e. no Firestore-isms in domain.

### 1.2 There is already a POS *stub* (must be replaced, not extended)
`frontend/src/modules/pos/STATUS.md` declares the module a **placeholder**. What exists today is naïve scaffolding that does **not** integrate with anything:

- `backend/src/domain/pos/entities/POSOrder.ts`, `POSShift.ts` — trivial classes (`total` passed in by caller, "Should be calculated in real app").
- `backend/src/application/pos/use-cases/PosUseCases.ts` — `OpenPOSShiftUseCase`, `ClosePOSShiftUseCase`, `CreatePOSOrderUseCase`. `CreatePOSOrderUseCase` just writes an order; **no inventory OUT, no GL voucher, no tax, no shift validation.**
- `backend/src/api/controllers/pos/PosController.ts`, `api/routes/pos.routes.ts` — two endpoints (`/shifts/open`, `/orders`) reading raw `req.body`.
- `repository/interfaces/pos/` (`IPosShiftRepository`, `IPosOrderRepository`) + `FirestorePOSRepositories.ts` + `POSMappers.ts`.
- `frontend/src/modules/pos/pages/PosHomePage.tsx` — placeholder page.
- Sidebar entry in `moduleMenuMap.ts` (`pos` → Terminal → `/pos`, `pos.terminal.access`).
- Permission catalog has exactly one POS permission: `pos.terminal.access`.

> **Decision:** treat the existing stub as throwaway. The V1 design supersedes `POSOrder`/`POSShift`/`PosUseCases`. The routes reference permissions (`pos.shift.open`, `pos.order.create`) that are **not even in `PermissionCatalog.ts`**, so the current routes are effectively dead. We will rename/replace cleanly rather than graft onto these.

### 1.3 Sales posting already covers the POS "money + stock" path — the decisive finding
`backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts` (~2,500 lines) already implements, for a `direct`-persona invoice:

- **Settlement at post time** (`PostSalesInvoiceUseCase`, `SettlementInput`): modes `DEFERRED | CASH_FULL | MULTI`.
  - `CASH_FULL` = exactly one settlement row equal to the outstanding → the classic cash sale.
  - `MULTI` = N settlement rows (each a `paymentMethod` + amount) → **split payment** (cash + card + bank).
  - Each row posts a receipt voucher **Dr settlement account / Cr AR** atomically in the same `transactionManager.runTransaction`.
- **Payment-method → GL account mapping** already exists: `SalesSettings.paymentMethodConfigs[]` = `{ method: 'CASH'|'BANK_TRANSFER'|'CHECK'|'CREDIT_CARD'|'OTHER', settlementAccountId, label, isEnabled }`, resolved by `resolvePaymentMethodAccount`.
- **Revenue + output tax voucher**, **COGS voucher**, **inventory OUT `StockMovement`** all generated inside the posting transaction, mode-aware via `DocumentPolicyResolver` (`INVOICE_DRIVEN`/`PERPETUAL`/`PERIODIC`).
- **Tax** (inclusive & exclusive), **line discounts**, **document-level charges/discounts**, **promotions** — all in `CreateSalesInvoiceUseCase` / `SalesInvoiceCalculationService`.
- **Uncosted stock-out** policy already modeled (`UnsettledCostError`, `costBasis: AVG|LAST_KNOWN|MISSING`, settled/unsettled qty split) — matches the brief's `allowUncostedStockOut` requirement.
- **Credit override, period lock, approval gating** all honored through the same `PostingGateway`.

**Net:** a POS cash sale = `CreateSalesInvoiceUseCase({ persona:'direct', source:'pos', settlement... })` then `PostSalesInvoiceUseCase(..., settlementInput)`. Zero new financial logic.

### 1.4 Returns already support receipt-based returns
`SalesReturnUseCases.ts`: `CreateSalesReturnUseCase` accepts `salesInvoiceId` → return context `AFTER_INVOICE`; `PostSalesReturnUseCase` reverses revenue/tax, restocks (inventory IN), and reverses COGS, mode-aware via `DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting`. Partial returns supported (per-line qty). This is exactly the POS receipt-return requirement.

---

## 2. Existing module conventions (what POS must copy)

- **One folder per module per layer**, mirrored names (`domain/pos`, `application/pos`, `repository/interfaces/pos`, `infrastructure/firestore/repositories/pos`, `api/controllers/pos`, `api/routes/pos.routes.ts`, `api/dtos/PosDTOs.ts`).
- **Use cases are classes** with constructor-injected repositories; one responsibility each; instantiated in the controller from `diContainer`.
- **Repositories**: interface in `repository/interfaces/pos/`, Firestore impl + mapper in `infrastructure/firestore`, registered in `bindRepositories.ts` and exposed on `diContainer`. Must also be implementable in Prisma (no Firestore types in the interface).
- **Transactions**: cross-aggregate writes go through `ITransactionManager.runTransaction` with the **reads-before-writes** rule (see the elaborate pre-fetch phases in `PostSalesInvoiceUseCase`). POS sale completion will *call into* the Sales use cases, which already wrap their own transaction.
- **Multi-tenancy**: every entity carries `companyId`; every read is `(companyId, id)`-scoped. Branch scoping exists via governance rules' `branchId`.
- **Audit**: `RecordChangeService` (`recordCreate`/etc.) writes change records; `PostingLog` records posting decisions. POS state-changes should record through the same service.

---

## 3. Existing UI conventions (what POS must copy)

- **Module layout:** `frontend/src/modules/<module>/pages/*.tsx`, API client in `frontend/src/api/<module>Api.ts`, sidebar entry in `frontend/src/config/moduleMenuMap.ts`, routes wired in the app router. UI is **UI-mode aware** (route mode vs "windows" mode via `WindowManagerContext`).
- **Mandatory shared components** (`AGENTS.md` §Shared UI):
  - Selectors: `ItemSelector`, `WarehouseSelector`, `PartySelector`, `PartyAccountSelector` (no raw text inputs for master-data IDs — data-integrity red line).
  - `DatePicker` (the only date picker — honors company date format/fiscal calendar).
  - `ConfirmDialog` / `useConfirm` — **mandatory** for every state-changing action (open shift, complete sale, void, close shift, post return). Tone: `danger`/`warning`/`info`.
  - Toast on **every** action result (`react-hot-toast`): success / info-noop / error. No silent actions.
- **i18n:** every user-facing string in `frontend/src/i18n/` (en/ar/tr), never hardcoded. RTL must work (Arabic).
- **Scaffolds:** document pages use `DocumentDetailScaffold` + `ClassicLineItemsTable` + `OperationalListLayout` (see `inventory-revaluation` and the sales pages). The POS *cashier* screen is the one justified deviation (a dedicated fast touch screen) but it still lives inside the ERP shell, navigation, permissions and i18n.

---

## 4. Report container / report page conventions

**Hard rule (`AGENTS.md` §Report Pages, enforced by `frontend/scripts/check-reports.mjs` at `npm run build`):**

1. Every report page **must** use `<ReportContainer>` (`frontend/src/components/reports/ReportContainer.tsx`).
2. Its route **must** appear in `moduleMenuMap.ts` under the module's **`Reports`** parent.

`ReportContainer` gives (for free): two-stage filter→results flow, toolbar (refresh/filter/column visibility/Excel/PDF/print), density toggle, pagination, i18n, and windows-mode routing. CI fails any report that violates either rule.

> **Decision:** all POS reports (X, Z, daily summary, payment-method, cashier, over/short, receipt history, unsettled-cost) are built as `ReportContainer` pages under a `pos` → `Reports` menu parent. No bespoke report pages.

---

## 5. Sales workflow analysis (the source-of-truth rule)

Two orthogonal axes — **do not conflate them**:

- **`workflowMode`** (`SalesSettings.workflowMode`): `SIMPLE` | `OPERATIONAL`. Decides which operational documents (SO/DN) are surfaced and the *base* persona policy.
- **`persona`** (per invoice): `direct` | `linked` | `service`. `direct` = standalone invoice that creates its own inventory OUT + GL. `linked` = invoice against SO/DN. `service` = no stock.

`DocumentPolicyResolver` resolves whether a persona is allowed via a precedence chain: **base mode default → company rule → branch rule → form rule** (`isSalesInvoicePersonaAllowed`). `CreateSalesInvoiceUseCase` enforces it and throws `PersonaNotAllowedError` if the resolved persona is blocked. It also rejects unknown voucher types (`Invalid voucher type for sales invoice`).

The owner principle — *"`voucherType.workflowMode` is the source of truth; settings must not silently transform a selected invoice type; backend rejects a disabled type; never silently convert direct↔linked"* — is already implemented exactly this way. **POS must obey it, not work around it.**

Base policy reality: in `OPERATIONAL` mode `direct` is **off by default** (`{direct:false, linked:true, service:true}`); in `SIMPLE` mode `direct` is on. So for POS to post a direct invoice in an OPERATIONAL company, the company must have a **governance rule allowing `direct`** (company- or form-scoped). This is the correct, explicit, auditable mechanism — and it means **enabling POS is a deliberate governance act, not a silent override.**

---

## 6. Option comparison

| Criterion | A — POS *is* Sales UI | B — POS posts independently | **C — Hybrid (recommended)** |
|---|---|---|---|
| Duplicates sales logic | No | **Yes (severe)** | No |
| Duplicates tax logic | No | **Yes** | No |
| Duplicates accounting logic | No | **Yes** | No |
| Duplicates inventory logic | No | **Yes** | No |
| Cashier speed | Poor (full SI form is heavy) | Best | **Good** (thin cashier screen, one server call to complete) |
| Receipt printing | Awkward (SI ≠ receipt) | Native | **Native** (POS owns receipt; SI is the legal doc) |
| Shift / X / Z / drawer | Not modeled | Native | **Native** (POS owns) |
| Returns | Reuse SR | Re-build | **Reuse SR (`AFTER_INVOICE`)** |
| Future offline | Hard | Possible but risky | **Cleanest** (POS receipt is the offline unit; SI posts on sync) |
| Auditability | OK | **Risk** (parallel ledger) | **Best** (one ledger via Sales; receipt↔SI link) |
| Reporting consistency | OK | **Risk** (POS sales invisible to Sales/AR reports) | **Best** (POS sales are real SIs) |
| Architectural debt | Low logic / poor UX | **High** | **Low** |

- **Option A** keeps books perfect but gives cashiers the wrong tool (no shift, no drawer, no receipt, slow form). Fails the "urgent user who wants to sell fast" goal.
- **Option B** is fast to demo but creates a **second, parallel sales/GL/inventory engine**. It silently diverges from Sales tax/discount/COGS/return rules and makes Accounting/Inventory/Sales reports wrong. This is exactly the architectural debt the brief warns against, and it violates the "integrate, don't duplicate" mandate.
- **Option C** puts the fast operational surface in POS and routes the financial truth through Sales. It is the only option that is simultaneously fast *and* non-duplicative *and* report-consistent.

---

## 7. Final recommendation

**Adopt Option C.**

1. **POS owns** an operational layer: `PosRegister`, `PosShift`, `PosReceipt` (+ line snapshots), `PosPayment`, `PosCashMovement`, `PosSettings`. These are operational/audit records and the print source — they do **not** post to the GL themselves.
2. **Completing a POS sale** calls the existing Sales use cases:
   - `CreateSalesInvoiceUseCase` with `persona:'direct'`, `source:'pos'`, `formType:'pos_sale'`, lines built from the cart.
   - `PostSalesInvoiceUseCase` with `settlementInput` = `CASH_FULL` (single tender) or `MULTI` (split), each row's `paymentMethod` mapped to a settlement account via `SalesSettings.paymentMethodConfigs`.
   - The returned `salesInvoice.id` / `invoiceNumber` is stored on the `PosReceipt` (link, not copy).
3. **Respect the source-of-truth rule (answer to "Important Existing Sales Decision"):**
   **Recommendation = option 3 — reuse the existing `direct` workflow; add only a POS marker (`source:'pos'`, `formType:'pos_sale'`), NOT a new `workflowMode`.**
   - Do **not** invent `POS_DIRECT_SALE` as a `workflowMode` (that axis stays SIMPLE/OPERATIONAL).
   - Enabling POS for a company **creates/requires a governance rule allowing the `direct` persona** (scope `form`, `formType:'pos_sale'`, or company scope). If the company has not allowed direct sales, POS completion is **rejected** with the existing `PersonaNotAllowedError` — no silent conversion. This is surfaced in the POS setup wizard as an explicit toggle ("Allow POS direct sales").
4. **POS returns** call `CreateSalesReturnUseCase` + `PostSalesReturnUseCase` with `salesInvoiceId` = the receipt's linked SI (`AFTER_INVOICE`), restock + GL reversal handled by existing logic. Partial returns supported natively.
5. **Cash drawer & over/short** are POS-owned: shift open posts opening float as a `PosCashMovement`; shift close computes expected (opening + cash sales − cash refunds − payouts) vs counted; the variance posts a small accounting voucher (over/short) through the **Accounting Engine** (`SubledgerVoucherPostingService` / `PostingGateway`) using POS-configured over/short accounts — reusing the engine, not re-implementing it.

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `direct` persona blocked in OPERATIONAL companies → POS can't post | POS setup wizard creates the governance rule explicitly and verifies it before enabling the register; clear error if missing. |
| Cashier speed if SI posting is heavy | Posting is one atomic server call already; cashier screen stays thin. Benchmark `CompletePosSale`; if needed, pre-warm master data via `GetPosBootstrap`. |
| Per-receipt SI volume (numbering, document count) | Reuse SI numbering; consider a dedicated `siNumberPrefix` view for POS via `formType`. Accept that 1 receipt = 1 SI (correct for auditability). No production data yet, so no migration cost. |
| Walk-in customer (no named party) | Require a default "Walk-in / Cash Customer" party created at POS setup; AR nets to zero immediately via CASH_FULL settlement. |
| Uncosted stock-out at the till | Honor existing `allowUncostedStockOut` policy: block or post-with-unsettled-cost per company setting; surface in the **Unsettled Cost report**. Never hide it. |
| Over/short account mapping missing | Block shift close with a readable error (same pattern as missing revaluation account in Task 223). |
| Existing POS stub causes confusion | Delete/replace the stub entities, use cases, routes, mappers; update `STATUS.md`. |
| Returns after shift close | Per brief: returns belong to the *current* open shift, not the closed one. Enforce in `CompletePosReturn`. |
| Offline (out of V1) | V1 is online-only; receipt entity is already the natural offline unit for a future phase — design IDs/serialization to allow it, but build nothing offline now. |

---

## 9. Required database entities (`domain/pos/entities`)

Validated against existing conventions. Replaces the current `POSOrder`/`POSShift` stub.

| Entity | Purpose / key fields |
|---|---|
| `PosRegister` | `id, companyId, name, code, branchId, warehouseId, cashDrawerAccountId, status(ACTIVE/INACTIVE)`. Links till → branch → warehouse → cash account. |
| `PosSettings` | company-scoped: default register behavior, require-shift flag, walk-in customer party id, over/short accounts, receipt template id, rounding rule, `allowUncostedStockOut` mirror (read from inventory), allowed payment methods. |
| `PosPaymentMethod` | `code(CASH/CARD/BANK_TRANSFER/CUSTOM), label, settlementAccountId, requiresReference, allowsChange, isEnabled`. **Maps to / reuses** `SalesSettings.paymentMethodConfigs`; POS adds till-specific flags (change allowed, reference required). |
| `PosShift` | `id, companyId, registerId, cashierUserId, status(OPEN/CLOSED/FORCE_CLOSED/CANCELLED), openedAt, openingFloat, closedAt, expectedCash, countedCash, overShortAmount, overShortVoucherId`. One OPEN shift per register. |
| `PosReceipt` | `id, companyId, shiftId, registerId, receiptNumber, status(COMPLETED/VOIDED), customerId, lines(snapshot), totals(subtotal/tax/discount/grand), salesInvoiceId, salesInvoiceNumber, createdBy, createdAt`. **Operational + print snapshot; financial truth lives on the linked SI.** |
| `PosReceiptLineSnapshot` | per line: `itemId, code, name, qty, uom, unitPrice, lineDiscount, taxCode, lineTotal`. Snapshot for reprint/audit. |
| `PosPayment` | `id, receiptId, method, amount, changeGiven, reference`. Mirrors the SI settlement rows. |
| `PosCashMovement` | `id, shiftId, type(OPENING_FLOAT/PAYOUT/PAYIN/DROP), amount, reason, createdBy`. Drawer movements feed expected-cash. |
| `PosReturn` + `PosReturnLine` | receipt-based return; links `originalReceiptId` + created `salesReturnId`. |

All carry `companyId`; all reads `(companyId, id)`-scoped. Repository interfaces in `repository/interfaces/pos/`, Firestore + Prisma impls, registered in `bindRepositories.ts`.

---

## 10. Required backend use cases (`application/pos/use-cases`)

| Use case | Calls into | Notes |
|---|---|---|
| `OpenPosShiftUseCase` | Pos repos | One OPEN shift per register; posts opening float as `PosCashMovement`. |
| `ClosePosShiftUseCase` | Pos repos + `SubledgerVoucherPostingService` | Computes expected vs counted; posts over/short voucher; locks shift. |
| `ForceClosePosShiftUseCase` | Pos repos | Manager-only; status `FORCE_CLOSED`. |
| `GetPosBootstrapUseCase` | Pos + Sales/Inventory reads | Register config, open shift, payment methods, settings — one round trip for the cashier screen. |
| `SearchPosProductsUseCase` | `IItemRepository` (+ price resolvers) | Barcode/SKU/name; reuses pricing resolution (Task 242/243) and tax defaults. |
| `CompletePosSaleUseCase` | **`CreateSalesInvoiceUseCase` + `PostSalesInvoiceUseCase`** | Builds cart→SI (`direct`,`source:'pos'`), posts with `CASH_FULL`/`MULTI` settlement, writes `PosReceipt`+`PosPayment` linked to SI. Requires open shift. |
| `CompletePosReturnUseCase` | **`CreateSalesReturnUseCase` + `PostSalesReturnUseCase`** | `AFTER_INVOICE` against the receipt's SI; partial supported; restock per policy; cash refund as `PosCashMovement`. |
| `CreatePosCashMovementUseCase` | Pos repos | Pay-in/pay-out/drop. |
| `ReprintPosReceiptUseCase` | Pos repos | Reads snapshot; no posting. |
| `GetPosXReportUseCase` / `GetPosZReportUseCase` | Pos + ledger reads | X = live open-shift snapshot; Z = finalized post-close. |

POS use cases **must not** open their own GL/inventory transaction for the sale — they delegate to the Sales use cases, which already own the atomic posting transaction.

---

## 11. Required frontend pages (`frontend/src/modules/pos/pages`)

| Page | Type | Notes |
|---|---|---|
| `PosTerminalPage` (cashier screen) | Specialized fast screen | The one justified UX deviation; still inside ERP shell + permissions + i18n + RTL. Uses `ItemSelector`/barcode input, cart, tender modal, `ConfirmDialog` to complete, toast on result. |
| `PosShiftPage` (open / close / X) | Scaffold | Open shift, count cash, close (Z). `ConfirmDialog` + toast. |
| `PosRegistersSettingsPage` | Settings page | Register CRUD (branch, warehouse, cash account). Uses `WarehouseSelector`, `PartyAccountSelector`. |
| `PosSettingsPage` | Settings page | Payment-method→account mapping, walk-in customer, over/short accounts, require-shift, rounding. Mirrors `SalesSettingsPage` structure. |
| `PosReceiptsListPage` | `OperationalListLayout` | History + reprint + drill to linked SI. |
| `PosReturnPage` | Scaffold | Look up receipt → select lines → refund. |
| Report pages (§12) | `ReportContainer` | Under `pos` → `Reports`. |

Routing/sidebar via `moduleMenuMap.ts` (extend the existing `pos` group: add `Reports`, `Shift`, `Settings`, `Returns`).

---

## 12. Required reports (all via `ReportContainer`, under `pos` → `Reports`)

`Shift X Report`, `Shift Z Report`, `Daily POS Summary`, `Payment Method Summary`, `Cashier Sales Summary`, `Cash Over/Short Report`, `Receipt History`, `COGS / Unsettled Cost Report`. Each: a filter initiator + a content component, Excel/PDF/print for free, route in `moduleMenuMap` Reports parent (CI-enforced).

---

## 13. Required permissions (add to `PermissionCatalog.ts`, module `pos`)

Replace the lone `pos.terminal.access` with a real set:

```
pos.terminal.access      Access POS Terminal (sell)
pos.shift.open           Open Shift
pos.shift.close          Close own Shift
pos.shift.forceClose     Force-close any Shift (manager)
pos.cash.movement        Record cash pay-in/pay-out/drop
pos.return.create        Process Returns
pos.receipt.reprint      Reprint Receipts
pos.registers.manage     Manage Registers
pos.settings.manage      Manage POS Settings
pos.reports.view         View POS Reports
```

The dead route permissions (`pos.shift.open`, `pos.order.create` in `pos.routes.ts`) get reconciled to this catalog. Default role attachment via the RBAC `autoAttachToRoles` mechanism (cashier vs manager).

---

## 14. Phase-by-phase implementation plan (estimates)

> Each phase = its own PR, full builder→reviewer→test-runner cycle, with Definition-of-Done docs. Task-size cap (≤8 files / ≤3 dirs) respected per phase.

| Phase | Scope | Deliverable | Est. |
|---|---|---|---|
| **P0 — Foundations & cleanup** | Remove POS stub; add `pos` permissions to catalog; `PosRegister`/`PosSettings`/`PosShift` entities + repos + DI; POS settings & register pages. | Configurable register + settings, no selling yet. | 2–3 d |
| **P1 — Shift lifecycle** | `OpenPosShift`/`ClosePosShift`/`ForceClose`, `PosCashMovement`, opening float, expected vs counted, over/short voucher via engine. X report. | Cashier can open/close a shift; drawer reconciled. | 2–3 d |
| **P2 — Sell (core)** | `GetPosBootstrap`, `SearchPosProducts`, `CompletePosSale` (→ direct SI + settlement), `PosReceipt`/`PosPayment`, cashier screen, receipt print/reprint, governance-rule enable check. | End-to-end cash + card + split sale posting real SIs. | 4–5 d |
| **P3 — Returns** | `CompletePosReturn` (→ `AFTER_INVOICE` SR), return page, partial + restock, cash refund movement. | Receipt-based returns. | 2–3 d |
| **P4 — Reports & polish** | Z report, daily summary, payment-method, cashier, over/short, receipt history, unsettled-cost — all `ReportContainer`; i18n sweep (en/ar/tr); docs (architecture + user-guide). | Reporting parity + DoD complete. | 3–4 d |

Total ≈ **13–18 dev-days** for V1.

---

## 15. Open questions (require owner approval)

1. **Customer on a receipt:** default everything to a single **"Walk-in / Cash Customer"** party, with optional `PartySelector` to attach a named customer for credit/history? (Recommended: yes.) *Note: V1 excludes POS credit sales, so attaching a customer is for history/returns only — still CASH/CARD settled.*
2. **One SI per receipt vs end-of-shift batch SI:** recommend **one SI per receipt** (cleanest audit + returns). Confirm acceptable given it raises SI document volume.
3. **Receipt numbering:** separate POS receipt series (e.g. `R-0001`) distinct from the SI number, with the SI number shown as the legal reference on the receipt? (Recommended: yes.)
4. **Over/short accounts:** create dedicated `Cash Over/Short Income` and `Cash Over/Short Expense` accounts in the starter chart, or map to existing misc income/expense? (Recommended: dedicated, auto-seeded.)
5. **Enabling POS in OPERATIONAL companies:** confirm the POS setup wizard may **auto-create the governance rule** allowing `direct` persona for `formType:'pos_sale'` (with an explicit owner toggle), rather than forcing manual Sales-settings edits.
6. **Rounding:** is cash rounding (e.g. nearest 0.05) required in V1? (Recommended: configurable, default off.)
7. **Branch model:** does the ERP have a first-class Branch entity today, or is "branch" only the governance-rule `branchId` string? This affects `PosRegister.branchId` typing.
```
