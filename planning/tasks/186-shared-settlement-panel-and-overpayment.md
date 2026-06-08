# 186 — Shared `SettlementPanel` component + over-payment (negative AR/AP, flagged)

**Status:** Part B (backend over-payment) ✅ DONE — Part A (shared `<SettlementPanel>` UI + library type) and Part C (contract doc) open.
**Origin:** Mahmud, 2026-06-08 — settlement QA.

> **Part B landed (2026-06-08, branch `feat/overpayment-credit-balance`, commit `e4ae939e`).** Opt-in `allowOverpayment` flag (default off) on Sales + Purchase settings; over-payment via `MULTI` now permitted when on, crediting/debiting AR/AP in full → party balance goes negative; invoice shows `PAID` (outstanding clamped at 0). Gated in all four settlement engines; wired through entities, settings use-cases, DTOs, validators. `CASH_FULL` stays exact. 4 new tests (sales+purchase over-pay accepted/AR-AP full + flag-off rejected); 66 settlement/settings tests pass; backend typecheck clean. Architecture docs (`sales.md`/`purchases.md`) updated in the working tree. **Remaining: UI panel (Part A) + a Sales/Purchase **settings toggle** with help text so users can turn the flag on.** Wants the settlement control to become a **shared library component** the form designer consumes (one component, used across SI/PI — same philosophy as [Task 176](./176-unified-line-items-table-skins.md) unified table), placed in the invoice **header**. And wants over-payment supported the way a real accountant works (customer pays more than the invoice; the excess is a credit to the party).
**Split:** UI component + library registration = **UI agent**. Over-payment backend (flag + negative-AR posting) + the `settlementInput` contract = **us (backend)**.
**Related:** [Task 177](./177-si-pi-detail-page-redesign.md) (SI/PI redesign — the header section that hosts this), [Task 184 Finding 5](./184-posting-qa-findings.md) (settlement card hidden/overflowing + pay-button mis-wire), [Task 178](./178-subledger-document-poster-refactor.md) (over-payment posting rides the shared poster), [Task 184-allocation-grid](./184-sales-invoice-allocation-grid-controlled-overrides.md) (**adjacent, not overlapping** — that task is the *financial allocation grid*: which accounts the revenue/tax/discount/charge lines post to. This task is *settlement*: how the invoice is paid. Same page area, different concern.).

---

## What exists today (don't rebuild)

The settlement **engine** is correct and proven. The three modes the user wants already map onto it:

| Dropdown option (user's wording) | Engine mode (exists) | Behavior |
|---|---|---|
| **On Credit** (default) | `DEFERRED` | hits the party's default AR/AP — no payment voucher |
| **Fully Paid** | `CASH_FULL` | one receipt at the form's default cash account (overridable) |
| **Partially Paid** | `MULTI` | account+amount rows, "+" to add more, % of invoice; one receipt voucher per row |

- SI engine: `processSettlementsInTransaction` ([SalesInvoiceUseCases.ts:1699](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:1699)) at post; `PostSalesInvoiceWithSettlementUseCase` / `RecordSalesInvoicePayment` later ([sales PaymentSyncUseCases.ts](../../backend/src/application/sales/use-cases/PaymentSyncUseCases.ts)).
- PI engine: mirror in `purchases/use-cases/PaymentSyncUseCases.ts` + `PurchaseInvoiceUseCases`.
- Always the **two-voucher AR/AP roundtrip**: invoice voucher `Dr AR / Cr Revenue`; separate receipt/payment voucher `Dr Cash / Cr AR` (own RV-/PV- number, linked `PaymentHistory`). Settle-on-post and pay-later use the **same** mechanism — only timing differs (see Task 184 Finding 5).

The current settlement **UI** is a bespoke, non-shared, rail-crammed card duplicated on both pages:
- SI: `renderSettlementCard()` ([SalesInvoiceDetailPage.tsx:2333](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx:2333)), placed in the right rail via `renderRailContent()` ([line 2632](../../frontend/src/modules/sales/pages/SalesInvoiceDetailPage.tsx:2632)) → overflows/cut off at the bottom.
- PI: its own separate copy ([PurchaseInvoiceDetailPage.tsx:132](../../frontend/src/modules/purchases/pages/PurchaseInvoiceDetailPage.tsx:132), render ~1206). Two hand-written cards that drift.

---

## Part A — Shared `SettlementPanel` component (UI agent)

A **composite "smart" widget**, not a plain field. The Field Library ([fieldLibraryApi.ts](../../frontend/src/api/fieldLibraryApi.ts)) models data-bound fields; a settlement control has a dropdown, a modal, multi-row state, % math, and ledger wiring. So:

**Library registration:** register **one** `system_core` field type — `type: 'settlement'`, `sectionHint: 'HEADER'` — as a *placement marker*. The form renderer maps that type to the dedicated shared `<SettlementPanel>` component. Designer users drop "Settlement" into the header; behavior lives in code, not in the designer. (Authoring is super-admin; tenants consume — same as every other field-library entry.)

**Component UX (header section, not the rail):**
- A **dropdown**, default **On Credit**, options: On Credit / Fully Paid / Partially Paid.
#### The reactive state machine (this IS the component — the glue, not the selectors)

The component's value is the **reactive linkage**, which is currently re-implemented inline in SI/PI/SR and drifts. Two linkages it must own:
1. **party → AR/AP account** (because default mode = on credit).
2. **payment method → contra (cash/bank) account.**

| Mode | Contra account | Method shown? | Posts |
|---|---|---|---|
| **On Credit** (default) | the **party's AR/AP account**, auto-derived the moment the customer/vendor is picked (read-only display; advanced override optional) | no | invoice only — `Dr AR / Cr Revenue` |
| **Fully Paid** | **cash/bank account, auto-filled from the chosen method** (`settings.paymentMethodConfigs[method].settlementAccountId`); user can override | yes | invoice + one receipt — `Dr Cash/Bank / Cr AR` |
| **Partially Paid / Installments** | per-row: method + auto-filled cash/bank account + amount + date; **"+"** adds rows; each row shows **% of total** | yes (per row) | invoice + one receipt **per row** |

- **The key rule (`onMethodChange → setContra(default-for-method)`) lives INSIDE the component.** If it's wired per-page instead, it's re-written 3× and drifts — that's the whole reason this is a component, not inline code (Mahmud, 2026-06-08).
- Partial sum **<** outstanding → remainder stays on credit (AR). Sum **>** outstanding → only when `allowOverpayment` is on (AR goes negative — Part B). Flag off → blocked.

#### What's reused vs. net-new (confirmed 2026-06-08)
- ✅ reuse [`AccountSelector`](../../frontend/src/modules/accounting/components/shared/AccountSelector.tsx) for the contra/cash-bank **and** AR account.
- ✅ reuse [`PaymentMethodDropdown`](../../frontend/src/modules/accounting/components/shared/PaymentMethodDropdown.tsx) for the method.
- ✅ reuse [`PartyAccountSelector`](../../frontend/src/components/shared/selectors/PartyAccountSelector.tsx) / derive AR from the selected party.
- ❌ **net-new: the mode dropdown** (On Credit / Fully Paid / Partially Paid) — there is **no** reusable settlement-mode component today (inline + duplicated in SI/PI/SR pages).
- ❌ **net-new: the reactive orchestration** above — the actual work.

So ~80% is assembling existing parts; the new 20% (mode dropdown + reactive glue) is the component's reason to exist.

- The **rail stays view-only** (read-only Paid/Remaining/Affected-account summary). The **editable** control is this component, placed in the **header**. Used by **both** SI and PI (swap AR→AP, Receipt→Payment) and SR (contra-revenue) — pass via props.

**Contract the component calls (defined by us, Part C):** the existing `settlementInput` shape — `{ settlementMode, receivablePayableAccountId?, settlements: [{ settlementAccountId?, amountBase, amountDoc?, paymentMethod?, paymentDate?, reference?, notes? }] }` — plus the new `allowOverpayment` path.

---

## Part B — Over-payment → negative AR/AP, behind a flag (us, backend)

**Decision (Mahmud, 2026-06-08): negative-AR model, opt-in flag.** The excess sits as a **credit balance in the party's AR/AP** (AR goes negative = we owe the customer; AP goes negative = the vendor owes us). No dedicated Advances account. Off by default.

**Today it's blocked** — both engines reject paying more than outstanding:
- `CASH_FULL` must *equal* outstanding ([sales PaymentSyncUseCases.ts:162](../../backend/src/application/sales/use-cases/PaymentSyncUseCases.ts:162)).
- `MULTI` must *not exceed* outstanding ([line 172](../../backend/src/application/sales/use-cases/PaymentSyncUseCases.ts:172)).
- Same guards in the purchases mirror and in `SalesInvoiceUseCases.processSettlementsInTransaction` ([line 1721-1738](../../backend/src/application/sales/use-cases/SalesInvoiceUseCases.ts:1721)).

**The flag:** add `allowOverpayment: boolean` (default **false**) to `SalesSettings` and `PurchaseSettings` — mirror the existing `allowOverDelivery` / `allowDirectInvoicing` pattern ([SalesSettings.ts:64](../../backend/src/domain/sales/entities/SalesSettings.ts:64)): field on entity, `toDTO`, `fromDTO` default `false`, default-settings seed.

**Posting (customer over-pays 1500 on a 1000 invoice, flag ON):**
```
Invoice voucher (unchanged):   Dr AR 1000 / Cr Revenue 1000 (+tax)
Receipt voucher:               Dr Cash 1500 / Cr AR 1500
  → party AR net = 1000 − 1500 = −500 (credit we owe them)
```
- The receipt credits AR by the **full cash received** (may exceed the invoice AR) → AR naturally goes negative. The credit is a **party-ledger fact**, not an invoice field.
- The **invoice itself** is `PAID` / outstanding 0. `paidAmountBase` caps at `grandTotalBase` (the invoice was only 1000); the extra 500 is **not** "paid against this invoice." Surface the 500 as an on-account `PaymentHistory` row (or note) so payment history reconciles to the cash. **Confirm this detail in implementation** — the invoice must not show negative outstanding.
- Vendor side symmetric: `Dr AP 1500 / Cr Cash 1500` → AP net negative = vendor owes us.

**Validation changes (only when flag ON):**
- `CASH_FULL`: allow `settlementTotal ≥ outstanding` (was `==`). Or steer over-payment through `MULTI` and keep `CASH_FULL` exact — decide during build.
- `MULTI`: drop the `> outstanding` throw; allow exceeding.
- Keep all per-row guards (positive amount, valid method, resolvable account).
- When flag **OFF**: behavior is unchanged (current guards stand).

**Route the over-payment receipt through `SubledgerDocumentPoster`** (Task 178) like every other subledger posting — uniform `AccountMappingError`, balance asserts.

---

## Part C — The component contract (frozen 2026-06-08)

**Principle:** the block is a **controlled component** — it never reaches around the page for the customer/currency/rate. The host form (native page OR designer-rendered form) resolves the selected party + document currency/rate and **feeds them in**; the block only owns the settlement choice + the reactive glue, and emits a value + validity back. This is what makes it reusable across native SI/PI/SR and Forms-Designer dynamic forms (which mount it via the `settlement` `system_core` field type).

### Props IN (host form provides)
| Prop | Type | Meaning |
|---|---|---|
| `module` | `'sales' \| 'purchases'` | AR vs AP, Receipt vs Payment, labels |
| `receivablePayableAccountId` | `string` | party's **AR/AP** account (on-credit contra) — form resolves from the selected customer/vendor (`Party.defaultARAccountId`/`defaultAPAccountId` → settings default) |
| `outstandingBase` | `number` | amount left to settle (base currency) |
| `currency`, `exchangeRate` | `string`, `number` | document-level (display/doc-amount only — **not** part of the block's own state) |
| `paymentMethodConfigs` | `{ method, settlementAccountId }[]` | method → default cash/bank account map (settings) |
| `defaultCashAccountId?` | `string` | fallback default for Fully-Paid auto-populate |
| `allowOverpayment` | `boolean` | may total exceed outstanding (Part B) |
| `readOnly` | `boolean` | posted/locked → view-only |
| `value`, `onChange(next, validity)` | controlled | current value + emits value & validity |

### Value OUT (maps 1:1 to the existing backend `settlementInput`)
```ts
type SettlementValue = {
  mode: 'DEFERRED' | 'CASH_FULL' | 'MULTI';
  rows: { settlementAccountId: string; amountBase: number;
          paymentMethod?: string; paymentDate?: string; reference?: string }[];
};
// On Credit  → { mode:'DEFERRED', rows:[] }
// Fully Paid → { mode:'CASH_FULL', rows:[{ account, amount: outstanding }] }
// Partial    → { mode:'MULTI', rows:[ … ] }
```
The form sends `{ settlementMode: value.mode, receivablePayableAccountId, settlements: value.rows }` to the existing endpoints (`POST /invoices/:id/record-payment` for later, or the settlement-on-post path). No backend change — Part B already lifted the over-payment guard.

### Validity (the Post gate — Mahmud's rules, 2026-06-08)
```ts
type Validity = { ok: boolean; message?: string };
```
- **On Credit** → always `{ ok: true }` (nothing to fill; contra = AR/AP).
- **Fully Paid** → one receiving account; auto-populate the default (`paymentMethodConfigs[method]` → `defaultCashAccountId`). **If none resolves, `{ ok:false }` and the form must BLOCK Post until the user fills it.**
- **Partial/Multi** → modal of (account, amount[, method, date]) rows; each row account + amount > 0; ≥1 row; sum ≤ outstanding (or any when `allowOverpayment`).

The host form disables/rejects Post whenever `validity.ok === false`. The backend re-checks account validity + the over-payment flag independently (a buggy form can never post a bad settlement).

---

## Definition of done
- `allowOverpayment` flag on Sales + Purchase settings (default off), surfaced in settings UI with help text ("allows recording payments greater than the invoice total; the excess becomes a credit balance on the customer/vendor account").
- Engines accept over-payment when the flag is on; AR/AP goes negative; invoice shows PAID/outstanding 0; cash fully recorded; payment history reconciles. Flag off = unchanged.
- Over-payment posting goes through the shared poster; balanced; structured account errors.
- Shared `<SettlementPanel>` registered as the `settlement` `system_core` HEADER field type, consumed by both SI and PI, replacing both bespoke rail cards.
- Tests: over-pay customer → AR negative, invoice PAID; over-pay vendor → AP negative; flag-off rejects over-payment (regression on the existing guards); the 3 modes unchanged.
- Docs: `docs/architecture/sales.md` + `purchases.md` (over-payment/credit-balance section); user guide on the settlement panel & over-payment.

## Canonical test (Mahmud's scenario)
Customer buys $1000 of goods, pays $1500. Flag ON → invoice PAID, customer AR shows a $500 credit (we owe them); the $500 offsets their next invoice. Flag OFF → the $1500 payment is rejected with a clear message.
