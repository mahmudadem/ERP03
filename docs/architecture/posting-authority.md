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
   checks the override reason against its own rule. *(Stage 6: this vocabulary is now standard
   throughout — `PeriodLockOverride` and `CreditOverride` both persist exactly `{ reason,
   overriddenBy }`, and no "ticket"-named type exists in the codebase.)*
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

### 4.1 Who holds the approval right (segregation of duties)

The approval right belongs to **Accounting**, not the source module that originated the document.
This is a direct application of Law 2 (each domain owns its rules) plus the principle stated in §3:
**"reading another domain's data ≠ the rule belonging to that domain."** Run that principle the
other way around — a posting *touches* a sales document, but the rule *"don't let this ledger
effect happen without authorization"* is an Accounting concern. The trigger does not move the
right.

This is also the standard accounting **segregation of duties (SoD)** control codified by COSO and
SOX 404. The person who *initiates* a transaction must not be the person who *approves* its
financial effect. A salesperson approving the ledger impact of their own commissionable invoice is
the textbook fraud-risk pattern auditors are trained to flag.

**Concrete bindings:**

| Concern | Owner |
|---|---|
| Decision *whether* approval is required (config) | Accounting (the Approval Workflow tab in Accounting Settings) |
| Holding the document in a pending state | Source module (mechanical — the SI/PI carries `PENDING_APPROVAL`) |
| Authority to **approve** the ledger effect | Accounting (`accounting.financialApproval.approve` permission) |
| Authority to **reject** the ledger effect | Accounting (same permission) |
| Visibility / queue of what is pending | Accounting (Approval Center — aggregates pending source docs across modules) |
| Notification when a document parks | Routed to accounting roles (configurable) |

**Source-module pages must not render an Approve action.** A Sales Invoice in `PENDING_APPROVAL`
shows a read-only form plus a "Awaiting accounting approval" banner. The post handler in the source
module exists only because the source module is what *triggers* the post (which then parks via the
gateway) — it must never be the one that *clears* the parked state.

**On rejection,** the source document transitions back to a workable state (typically `DRAFT`)
with the rejection reason recorded in its audit log. The salesperson sees the rejection on the
source document page; they re-submit by re-posting.

**Future delegation (configurable, not built):** a company may choose to grant approval rights to
non-accounting roles under bounded conditions — e.g. "Sales Manager may approve SIs they did not
themselves create, up to $X." This is a standing delegation of the Accounting right, configured in
Accounting, audited like any other exemption. The default is undelegated: Accounting only.

**What this means for routes and permissions:** approve endpoints for source documents
(`/sales/invoices/:id/approve`, `/purchases/invoices/:id/approve`) MUST be guarded by
`accounting.financialApproval.approve`. Sales-side or purchases-side permissions like
`sales.invoices.approve` MUST NOT exist — they would split the right and violate SoD.

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

## 6. Future hooks (designed-for, NOT yet built — Stage 7)

> **Do not build these without an explicit go-ahead.** They are recorded here so the design intent
> is not lost and so new code leaves room for them. Each is purely additive and AND-gated (Law 4) —
> neither can ever *loosen* an existing guard.

- **Request-gating in a module guard.** A module may gate *which forms/users* can even *request* an
  override of an accounting policy. This is **AND-gated** with the owning guard: the module grants the
  right to *ask*, the accounting guard still independently decides whether to *accept*. It maps onto
  the existing forms + permissions system (a permission like `accounting.period-lock.request-override`
  on a form/role), and it never overrules the accounting guard — a user who is allowed to ask can
  still be refused. Worked example: a "Backdated Invoice" form grants the right to *submit* an
  override reason; accounting accepts it only when `allowPeriodLockOverride !== false`.
- **Account-level caps at the Accounting guard.** Per-COA-account exposure ceilings (e.g. a hard cap
  on a specific control account's balance), enforced as a new accounting policy at the ledger door.
  This is a *different* control from the Sales credit limit (per-account ledger balance vs.
  per-customer projected commercial exposure) and is owned by a *different* guard; the two are
  AND-gated and the stricter wins (see §5, third worked example).

When either lands, it becomes a new policy in the `AccountingPolicyRegistry` (account-level caps) or a
new module-guard permission check (request-gating) — both flow through the existing `PostingGateway`
door and the uniform rejection contract (§7, Stage 5). No new bypass is introduced.

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

| Override vocabulary standard (`{ reason, overriddenBy }`, no "ticket") | ✅ **Stage 6** — uniform in code + docs |
| Future hooks documented (request-gating, account caps) | ✅ **Stage 7** — see §6 (designed-for, not built) |

**Remaining:** **Stage 4b** — fold the system-voucher exemptions (settlements, payment-sync, bank-rec,
year-end closing) into the policy set so even those run the full rulebook (today they pass the door +
iron laws only, flagged with an `exemptionReason`). Tracked in the fix plan. All other staged work
(0–7) is complete.
