# Posting Authority & Guard Architecture

> **Status:** Target architecture (agreed 2026-06-03). Parts are already true in code;
> the gaps and the migration are tracked in
> [planning/briefs/20260603-posting-authority-fix-plan.md](../../planning/briefs/20260603-posting-authority-fix-plan.md).
> This document is the **single source of truth** for how postings reach the ledger.
> If you are adding a policy, an override, or a new posting path, read this first.

## 1. The mental model

The **ledger is the vault.** Writing to it is the only truly irreversible act in the system, so
it is the thing the architecture protects above all else.

A business transaction (a Sales Invoice, a Purchase Invoice, a Stock Adjustment…) usually has
**several effects** — it moves stock, it settles a payment, it writes to the ledger. Each effect
belongs to a **domain** (Inventory, Sales/AR, Accounting), and each domain has a **guard** that
owns the rules for its concern.

A transaction must clear **every guard whose concern it touches.** The guards are **not a fixed
two-layer stack** — they are an open set, **composed per transaction** by what the transaction
actually affects:

| Transaction | Guards it must clear |
|---|---|
| Sales Invoice | Sales guard → Inventory guard → **Accounting guard** |
| Purchase Invoice | Purchases guard → Inventory guard → **Accounting guard** |
| Stock Adjustment | Inventory guard → **Accounting guard** |
| Manual journal voucher | **Accounting guard** only |

The **Accounting guard is always the terminal gate** for anything that touches the ledger — the
last, unbypassable door. The domain guards are composed in front of it by effect.

## 2. The laws

These are invariants. New code must not violate them.

1. **One accounting guard at the ledger door.** Every posting from every module converges on one
   guard that enforces all ledger rules. Nothing reaches the ledger except past it.
2. **Each guard owns its policy *and* the rule for overriding that policy.** Period-lock and "may
   this be overridden?" → Accounting. Credit-limit and "may this be overridden?" → Sales. No
   cross-ownership.
3. **An override is an *override reason* carried with the transaction** — `{ reason, overriddenBy }`.
   There is no "ticket" object; that was only ever a metaphor. The guard sees the violation, then
   checks the override reason against its own rule.
4. **Guards compose by AND.** Each guard can only *restrict*, never *force*. A permission in one
   guard grants only the right to *ask* the next guard — never the right to overrule it.
   **Adding a guard can only ever tighten, never loosen.** The most restrictive concern wins.
5. **Every guard signs its refusal.** A rejection is typed and attributed: `{ guard, code, message,
   fieldHints }`. A failure is never an anonymous "something went wrong" — you can always see
   *which* guard refused and *why*.
6. **All-or-nothing.** A multi-effect transaction runs inside one transaction boundary. If *any*
   guard refuses — even the last one — *everything* rolls back. Never "stock moved but ledger
   refused."
7. **No forged credentials; the guard sits at the door; no bypass.** A module must never stamp its
   own posting "approved" (or otherwise pre-clear an accounting control) on the way in. Approval —
   and every ledger rule — is **earned at the guard**, not asserted by the thing trying to pass it.

## 3. The ownership test (how to classify any rule)

When you add a rule and don't know which guard owns it, ask **one** question:

> **"Does this rule make sense for *any* posting, no matter which module it came from?"**
> - **Yes** → it is a **ledger rule** → the **Accounting guard**. (period lock, approval,
>   balanced, valid/active account, cost centre, account access)
> - **No — it only means something inside one module's business** → that **module's guard**.
>   (credit limit, over-invoicing, over-delivery, required warehouse)

**Corollary — data vs. ownership:** a guard may *read* another domain's data to make its
decision; that does **not** move ownership. Credit-limit reads the customer's AR balance (ledger
data) but the rule *"don't let this customer exceed their limit"* is Sales' concern, decided at
the Sales guard. **Reading another domain's data ≠ the rule belonging to that domain.**

## 4. Policies, scope, and overrides

- **Definition + scope + exemptions all live in Accounting** (the one rulebook). The guard
  auto-applies every active policy. **Add a policy to the registry → it is enforced everywhere,
  automatically** — no per-module wiring.
- **Scope is by document type** (e.g. `sales_invoice`, `delivery_note`, `stock_adjustment`),
  presented grouped by module in the UI. A policy may be active globally but **exempt** specific
  types. Example: *Approval = active; exempt = `sales_invoice`* → the guard blocks unapproved
  postings everywhere except sales invoices.
- **Exemptions are themselves a relaxation of a control and must be auditable** (who exempted what,
  when, ideally why).
- **Two distinct kinds of override — never blur them:**
  - **Standing exemption** (config, in Accounting): "this type is exempt from this policy." Applies
    always.
  - **Per-transaction override reason** (runtime, audited): "skip this lock for *this* posting
    because *[reason]*, by *[user]*." Travels with the transaction.

## 5. Worked examples

- **Admin posts an SI into a locked period, with an override reason; accounting forbids the
  override** → Sales guard lets the request through, **Accounting guard rejects** (`PERIOD_LOCKED`).
  Both doors must open; accounting's stayed shut. *(Law 4.)*
- **Credit-limit exceeded, no override** → **Sales guard rejects** (`CREDIT_LIMIT_EXCEEDED`); the
  transaction never reaches the Accounting guard. Credit limit is a Sales concern. *(Law 2 + test.)*
- **Customer credit limit vs. a (future) account-level cap on the customer's COA sub-account** →
  two *different* controls (per-customer commercial limit vs. per-account ledger cap), owned by
  *different* guards, **AND-gated**. They may target the same number yet measure different things
  (projected exposure incl. open orders, vs. posted account balance). The stricter wins; they can
  never contradict. *(Law 4.)*

## 6. Future hooks (designed-for, not yet built)

- **Request-gating in a module guard:** a module may gate *which forms/users* can even *request*
  an override of an accounting policy — AND-gated with the owning guard (the module grants the
  right to *ask*; accounting still decides). Maps onto the existing forms + permissions system.
- **Account-level caps** at the Accounting guard (per-COA-account exposure ceilings).

## 7. The ledger door — `PostingGateway` (Stage 4)

The literal door is one class: **`PostingGateway`**
(`backend/src/application/accounting/services/PostingGateway.ts`). It is the **only** code permitted
to call `ILedgerRepository.recordForVoucher`. An architecture test
(`backend/src/tests/architecture/PostingAuthority.test.ts`) scans all production source and fails the
build if any other file calls `.recordForVoucher(` — so the door cannot be bypassed by a new caller.

`PostingGateway.record(voucher, ctx, transaction)` does, in order:

1. **Iron laws, always** — `validateCore` (and `validateAccounts` when an account repo is supplied).
   No exemption.
2. **The policy set** — when `ctx.enforcePolicies !== false` and a registry is present, it runs the
   full enabled policy set. **Approval is derived from `ctx.approved` (the caller's real state), never
   from the voucher's own status** — this is where Law 7 is enforced for every path.
3. **The ledger write** — `recordForVoucher`.

**Explicit, auditable exemptions.** A few system-generated postings legitimately skip the policy set
today (settlements, payment-sync receipts/payments, bank-rec adjustments, year-end closing &
reversal). They pass `enforcePolicies: false` **with a mandatory `exemptionReason`** — the gateway
throws if a reason is missing, so no skip is silent. Every exemption is greppable
(`grep "enforcePolicies: false"`). Folding these exemptions into the policy set is tracked as
**Stage 4b**.

Which paths enforce vs. exempt today:

| Posting path | Gateway mode |
|---|---|
| Sales/Purchase subledger (`SubledgerVoucherPostingService`) | **enforce** (full policy set, approval from caller) |
| Manual voucher (`PostVoucherUseCase`, auto-post, edit re-record) | exempt — policies validated inline by the caller (pre-gateway; Stage 4b folds in) |
| Sales/Purchase invoice settlement; payment-sync | exempt — system-generated settlement (Stage 4b) |
| Bank-reconciliation adjustment | exempt — system-generated adjustment (Stage 4b) |
| Year-end closing & closing reversal | exempt — system event under strict lock (Stage 4b) |

## 8. Current conformance (2026-06-03)

| Law / piece | State |
|---|---|
| Credit limit owned by Sales, accounting ignorant of it | ✅ holds (verified: zero `creditLimit` refs in accounting) |
| Subledger postings run the accounting policy registry | ✅ holds (post-`ac963d32`; now via the gateway) |
| `allowPeriodLockOverride` is an accounting concern | ✅ holds (accounting config) |
| One accounting guard, literally at the ledger write | ✅ **Stage 4** — `PostingGateway` is the sole caller of `recordForVoucher`, enforced by an architecture test. Some system postings are explicitly policy-exempt (Stage 4b) but still pass through the door + iron laws |
| No forged "approved" stamp | ✅ **Stage 1 + 4** — approval is derived from the caller's *real* state inside the gateway, for every path |
| Approval owned in Accounting (one rulebook + scope) | ✅ solved (Stage 2b/2c — per-module flag retired) |
| Period lock has one implementation | ✅ holds — `PeriodLockService` is a thin adapter delegating to `PeriodLockPolicy` |
| Each guard signs its refusal (uniform contract) | ✅ **Stage 5** — `toRejectionContract(err)` maps every guard error onto `{ guard, code, message, fieldHints }`; the error handler surfaces `guard` + `code` consistently |
| All-or-nothing transaction | ✅ holds for postings |

**Remaining (post-Stage-5):** Stage 4b — fold the system-voucher exemptions into the policy set so
even settlements/closings run the full rulebook (today they pass the door + iron laws only). Tracked
in the fix plan.
