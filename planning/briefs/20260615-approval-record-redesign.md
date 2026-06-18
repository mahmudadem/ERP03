# Approval-Record Redesign — closing the caller-asserted-approval leak

> **Status:** Proposed (design note, 2026-06-15). **Interim hotfix shipped** — see §0.
> **Supersedes:** the `ctx.approved` boolean mechanism described in
> [docs/architecture/posting-authority.md](../../docs/architecture/posting-authority.md) §7 (Stage 1/4 "approval derived from caller's real state").
> **Owner decision pending** before any code lands — this touches the single most sensitive path in the system (every posting).

## 0. Interim hotfix (shipped 2026-06-15)

Closed the reported inventory leak without the disruptive blast radius of a global default flip. In `SubledgerVoucherPostingService.resolveApproved`, an **inventory-origin** posting (`metadata.sourceModule === 'inventory'`) that does not state its approval now resolves the **real** requirement from accounting config and presents the posting as NOT approved when approval is required — so `ApprovalRequiredPolicy` blocks it instead of the old fail-open default silently posting. An explicit `input.approved` (Sales/Purchases) still wins; other omitting callers are unchanged.

- **Effect:** in strict mode, valued transfers, stock adjustments, and opening-stock GL postings are now **blocked** (`APPROVAL_REQUIRED`) instead of silently posting. There is no approve UI for these yet, so in strict mode they are blocked until the full record model (or an explicit auto-stamp grant) lands. In non-strict mode: no change. FLAT transfers and zero-uplift valued transfers post no voucher, so they are unaffected.
- **Tests:** `SubledgerVoucherPostingServicePolicy.test.ts` +3 (inventory blocked when required; posts when not required; not blocked for an exempt type). Full inventory+sales+purchases suites green (394/394).
- **Not a full fix:** this is still a caller/metadata-gated boolean. The record model below removes the boolean entirely.

> **Note — the leak class is broader than inventory.** Delivery Note (`DeliveryNoteUseCases.ts:515`) and Goods Receipt postings also call the subledger poster **without** stating approval, so in PERPETUAL + strict mode they would auto-approve the same way. They are intentionally **not** changed by the hotfix (blocking them needs the approval workflow and would break the perpetual sales/purchase flow). The full redesign handles every path deliberately.

## 1. Problem

The posting architecture's own laws say approval is **Accounting's** to decide and enforce, and that a module must **never assert its own approval** on the way in:

- Law 7: *"A module must never stamp its own posting 'approved'… Approval is earned at the guard, not asserted by the thing trying to pass it."*
- §4.1: *"The approval right belongs to Accounting, not the source module."*

The implementation violates this. The guard derives approval from a boolean **the caller passes**, and that boolean **fails open**:

```ts
// PostingGateway.runPolicies()  (backend/src/application/accounting/services/PostingGateway.ts:170)
const approved = ctx.approved !== false;          // omitted → TRUE
status: approved ? voucher.status : DRAFT;         // → APPROVED → ApprovalRequiredPolicy passes
```

So:
- A caller asserts its own approval by passing `approved: true` (or by **omitting it** — same effect). That is exactly the "self-stamping" Law 7 forbids, just relocated from the voucher's status field to a method argument.
- Any path that doesn't pass the flag silently clears the approval policy. No forging, no direct ledger access — **bypass by omission.**

### Evidence / blast radius (audited 2026-06-15)
- **Sales / Purchases** pass `approved: !!approvalContext` (real state) — e.g. `SalesInvoiceUseCases.ts:1461`, `PurchaseInvoiceUseCases.ts:910`. Correct *today*, but only by caller discipline.
- **Inventory** passes nothing → force-approved in strict mode:
  - Valued stock transfer uplift — `StockTransferUseCases.ts:348` (JOURNAL_ENTRY)
  - Stock adjustment — `StockAdjustmentUseCases.ts:344` (JOURNAL_ENTRY)
  - Opening stock — `OpeningStockDocumentUseCases.ts:515` (OPENING_BALANCE)
- The helper meant to drive this decision, `AccountingPolicyRegistry.isApprovalRequiredForVoucherType`, is **wired nowhere** (only its own test references it).
- The architecture test `PostingAuthority.test.ts` enforces *routing* (one door) but has **no assertion** that a posting carries a verified approval decision — so the leak is invisible to CI.

"Strict mode" here = `approvalRequired = financialApprovalEnabled || custodyConfirmationEnabled`
(`FirestoreAccountingPolicyConfigProvider.ts:62`). When on, non-exempt voucher types must be approved before posting — which inventory silently isn't.

## 2. Decision

Replace caller-asserted approval (`ctx.approved`) with an **approval record (stamp)** that the guard **verifies**, and that only an authorized **stamping service** can issue. No record → the guard refuses (fail closed).

This makes approval a *verifiable fact* owned by Accounting, not a claim made by the poster — which is what the laws already require.

## 3. Design

### 3.1 The approval record (the "stamp")
A persisted record, owned by Accounting, created only by the stamping service:

```
ApprovalRecord {
  id
  companyId
  voucherId            // the voucher this approves
  contentFingerprint   // hash of the approved content (see 3.3)
  voucherType
  approvedBy           // the authorizing principal (user or granted module)
  approvedAt
  grantId?             // which approval grant authorized this (see 3.4); null = human approver
  revokedAt?           // a stamp can be revoked; revoked ≠ valid
}
```

### 3.2 The guard check (fail closed)
`PostingGateway.record` no longer reads `ctx.approved`. Instead, when approval is required for the voucher type (`isApprovalRequiredForVoucherType`), it:
1. Looks up a **non-revoked** ApprovalRecord for `voucher.id`.
2. Verifies `contentFingerprint` still matches the voucher being posted.
3. Verifies the issuer was authorized (human approver permission, or a valid grant).
4. **No valid record → reject** (`APPROVAL_REQUIRED`). Omission can no longer pass.

Voucher types where approval is *not* required (config off, or type exempt) skip the lookup — same as today, but that's an explicit Accounting decision, not a caller default.

### 3.3 Anti-leak property A — bind the stamp to content
The fingerprint must cover what was actually approved: **lines (accounts + debit/credit amounts) + date + total**. Otherwise: approve a 100 voucher → edit to 100,000 → post against the old stamp. Any post-approval edit changes the fingerprint and **invalidates the stamp**, forcing re-approval. (This is the editable-posted-voucher / resync path's responsibility too — `replaceForVoucher` must re-check.)

### 3.4 Anti-leak property B — issuer ≠ poster (SoD)
The capability to **issue** a stamp must be distinct from the capability to **post**. If one actor/module holds both, it self-approves and we're back to today's hole with extra steps. Concretely:
- Human approval: `accounting.financialApproval.approve` (already exists, already SoD-guarded per §4.2 of the SSOT doc).
- Module/automated approval: a **grant** (see below) that is separate from the module's posting capability and is itself auditable/revocable.

### 3.5 The grant model (your "approval gateway" — future-proofing)
Today only Accounting issues stamps. To allow approval to legitimately originate elsewhere later, model it as an **explicit approval grant** (a capability), not a flag:

```
ApprovalGrant {
  id, companyId,
  grantee            // module or role allowed to issue stamps
  scope              // voucher types / amount ceilings / conditions
  grantedBy, grantedAt, revokedAt?
}
```

- A granted module calls the **stamping service** (the "approval gateway") to issue a stamp within its scope. It still cannot write the ledger — it can only produce a verifiable approval that the posting guard later checks.
- "Auto-post" stops being a silent default and becomes an explicit grant: *"voucher type X may be auto-stamped."* Visible, audited, revocable. This is exactly the "Future delegation" carve-out the SSOT doc §4.1 already anticipated, made concrete.

## 4. What this removes
- `ctx.approved` on `PostingContext` — **deleted.** Callers can no longer assert approval. (Compile-time: every one of the ~16 posting callers must stop passing it; the guard now decides.)
- The `VoucherStatus.APPROVED` stamp on the freshly-built subledger voucher in `SubledgerVoucherPostingService` stops being meaningful as an authorization (it's just a lifecycle state; authority lives in the record).

## 5. Migration (phased — each phase shippable)
1. **Add the record + stamping service + guard lookup**, running in *shadow* (log when the new check would differ from the old `ctx.approved` result). No behavior change yet.
2. **Flip the guard to fail-closed**; route the **manual** voucher path (which already has a real approve workflow) to issue stamps. Verify nothing regresses.
3. **Sales / Purchases**: their existing approve workflow issues a stamp instead of passing `approved`. Delete the boolean from those calls.
4. **Inventory**: decide per-op — either (a) route through approval (park transfer/adjustment/opening-stock until stamped) or (b) grant them an explicit auto-stamp for their voucher types. Either way it's *on the record*, not a silent omission.
5. **Delete `ctx.approved`** entirely; add an architecture test asserting no posting reaches the ledger without a verified stamp (or an explicit, reasoned exemption). Closes the CI gap.

## 6. Alternatives considered
- **Just flip the default to false (fail closed) and keep the boolean.** Simpler, but the caller still *asserts* approval — Law 7 stays violated, and a caller passing `approved:true` wrongly still leaks. Rejected as a half-measure (acceptable only as an interim hotfix while 1–5 land).
- **Trust the voucher's own `status===APPROVED`.** This is what Law 7 explicitly forbids — the caller builds the voucher and can stamp it. Rejected.

## 7. Open questions for the owner
- **Inventory ops under strict mode:** block-until-approved (true SoD, bigger UX) vs. explicit auto-stamp grant (operational doc is the control)? (§5.4)
- **Granularity of the content fingerprint** — full line set vs. total+accounts only. (Recommendation: full line set; it's cheap and closes edit-after-approve completely.)
- **Interim hotfix?** Do we want the fail-closed-default stopgap (alternative in §6) shipped now to stop the inventory leak, ahead of the full record model?

## 8. Acceptance (definition of done for the redesign)
- `ctx.approved` no longer exists.
- Posting a non-exempt voucher with no valid stamp is rejected, for **every** path, proven by test.
- Editing an approved voucher invalidates its stamp (fingerprint test).
- Issuer ≠ poster enforced (SoD test).
- `docs/architecture/posting-authority.md` updated: §7 and the §8 conformance row corrected to reflect the record model.
