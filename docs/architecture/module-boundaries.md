# Application Module Boundaries

**Status:** Active rule (Epic 250 — System Core / Shared Engines transformation).
**See also:** [system-core.md](./system-core.md) (the engines), [pos-independence.md](./pos-independence.md) (worked example), [Platform Architecture Audit](../audit/platform-architecture-engine-vs-app-audit.md) (why this exists).

This document defines the boundary every application module must respect. It exists because, before Epic 250, application modules (Sales especially) owned shared business logic — POS reached into Sales use-cases, tax math lived in Sales, POS authorization was stored in `SalesSettings`. That coupling is now removed. This is the rule that keeps it removed.

## The three layers

1. **Engines / System Core** (`application/system-core/`) own cross-module business logic: Document/persona, Numbering, Money/Rounding, Tax, Commercial (pricing/discount/promotions/cost-margin), Policy, Approval, Inventory Core, Accounting/Financial + Accounting Bridge, Audit.
2. **Apps / Modules** (`application/sales`, `purchases`, `pos`, `inventory`, `accounting`) are **user-facing orchestrators**. A module composes engine calls into a workflow (a screen, a document lifecycle, a report). It owns its UI, its persistence wiring, and its workflow specifics — nothing more.
3. **UI surfaces** come in three kinds with strict edit scope: **Engine-management UI** (Tax settings, Approval workflow, Numbering, Policy templates, Audit log), **Module-settings UI** (Sales/POS/Purchase/Inventory/Accounting settings — configure *module-scoped policy only*), and **Transaction UI** (invoice/POS/voucher pages — *apply or override within policy only*).

## The rules (enforced)

1. **Modules depend on engine interfaces, not internals.** A module may inject `ITaxEngine`; it may **not** import `SalesInvoiceCalculationService`, construct `CreateSalesInvoiceUseCase`, or reach into another module's entities to borrow logic.
2. **No module governs another module.** `SalesSettings` configures Sales only. POS authorization lives in `POSPolicy`/`POSTerminalPolicy`/`CashierRolePolicy` resolved by `IPolicyEngine`, never in `SalesSettings`.
3. **One owner per concern.** Tax math lives in `ITaxEngine`; money rounding in `IMoneyCore`; document numbers in `INumberingEngine`; persona/identity in Document Core. No second copy in a module.
4. **Engine ≠ App.** Engines run whenever their inputs exist. An App's activation gates **UI/management visibility only** — it never turns an engine off. Disabling the Accounting App hides ledger/reports but financial events still record via `IAccountingBridge`. Disabling the Sales App must not affect POS.
5. **Policy precedence is most-restrictive-wins.** A stricter scope tightens but never loosens a broader one; the only escape from a deny is an explicit approved override (routed to `IApprovalEngine`).
6. **Overrides are governed.** Price/discount/tax/below-cost overrides resolve through `IPolicyEngine` and, when policy requires, route to `IApprovalEngine`; sensitive actions emit `IAuditEngine` records.

## How the rule is enforced in code

- **Architecture test** `backend/src/tests/architecture/SystemCoreBoundaries.test.ts` fails the build if any file under `application/pos/` imports from `application/sales/` or `domain/sales/` (folder-wide), and checks the system-core contract barrel is intact.
- **Posting authority test** `backend/src/tests/architecture/PostingAuthority.test.ts` forbids any path bypassing `PostingGateway` to write the ledger.
- **DI wiring** (`backend/src/infrastructure/di/bindRepositories.ts`) constructs each engine once and injects it; controllers pass engines into use-cases (e.g. `PosController` injects `policyEngine`, `numberingEngine`, `auditEngine`, `inventoryCore`, `accountingBridge`, `taxEngine`, `commercialCore`).

## The engine contracts (what a module may call)

| Engine | Interface | Module calls it for |
|---|---|---|
| Document Core | `IDocumentCore` | document identity, persona (incl. `POS_DIRECT_SALE`), editability |
| Numbering | `INumberingEngine` | next document/voucher/receipt number (scope-keyed) |
| Money | `IMoneyCore` | precision rounding, cash rounding, base conversion |
| Tax | `ITaxEngine` | line/charge tax, invoice-discount allocation, recoverable |
| Commercial | `ICommercialCore` | price resolution, discount, promotions, cost/margin |
| Policy | `IPolicyEngine` | `resolve(scope, action, ctx)` → allowed / requiresApproval |
| Approval | `IApprovalEngine` | `evaluate(subject, ctx)` for any subject (voucher, price/discount/below-cost override, POS manager override) |
| Inventory | `IInventoryCore` | stock IN/OUT, costing, COGS account resolution + accumulation |
| Accounting | `IAccountingBridge` | record a financial event (full posting when the Accounting Engine is initialized, or minimal-journal when it is not initialized) |
| Audit | `IAuditEngine` | record lifecycle / override / approval events |

## When you need new shared behavior

If two modules would need the same business rule, it belongs in an engine, not copied into each module. Add it behind the relevant interface (a temporary adapter delegating to existing code is acceptable for one phase — see [system-core.md](./system-core.md) on adapters), and have both modules depend on the interface.

## Known follow-ups (boundary not yet 100%)

These are tracked in `planning/ACTIVE.md` (FUP-1..4). They are gaps in the boundary, not exceptions to the rule:
- **FUP-1:** promotion stacking/cap model missing — POS/Sales promotions must stay disabled in production until it lands.
- **FUP-2:** SO/PO/SR/PR still use local pricing/discount helpers (only SI/PI moved to `ICommercialCore`).
- **FUP-3:** Sales/Purchases/Inventory posters not yet all routed behind `IAccountingBridge`. Sales DeliveryNote COGS + SalesInvoice + SalesReturn document vouchers migrated to bridge-only (Task 267-F); PaymentSync/Purchases/Inventory still hold a `SubledgerVoucherPostingService` field as fallback.
- **FUP-4:** Sales still imports inventory domain entities for stock-OUT orchestration (only COGS accumulation moved to `IInventoryCore`).
