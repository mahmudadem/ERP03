# Deferred QA — Sales Invoice Detail · Section E (Credit Override)

**Parent QA script:** [148-qa-si-detail-round1.md](./148-qa-si-detail-round1.md)
**Deferred on:** 2026-05-31
**Reason:** Out of time during Round 1 walkthrough. Section D passed; Sections A/B/C/F/G/H/I/J also still pending.

## Why this matters

Section E tests the **RBAC security fix** that gates the credit-override modal behind `sales.creditOverride` permission. Without this verified, we cannot claim Task 148 (Sales Invoice Detail rewrite) is done — credit override is one of the 15 native-detail contract clauses.

## What to test (verbatim from parent script)

### E1. Trigger credit-limit BLOCK as an authorized user
- **Setup:** Pick a customer. Set their credit limit very low (e.g. $10) in customer detail. Set Sales Settings credit-check policy to BLOCK.
- **Action:** Create a DRAFT invoice for that customer with amount > $10. Click Save & Post.
- **Expected:** Credit-override modal opens (limit / current exposure / this invoice / projected). Enter reason → "Override & Create" → invoice posts.

### E2. Same scenario as a user WITHOUT `sales.creditOverride` permission
- **Setup:** Log out, log in as a user without that permission (e.g. a sales operator role).
- **Action:** Repeat E1.
- **Expected (NEW BEHAVIOR):** Modal does **NOT** open. Error banner: **"Customer is over their credit limit. You do not have permission to override."**
- 🔴 **If the override modal DOES open** → RBAC fix didn't work → security regression.

### E3. Setting-level override disable
- **Setup:** As Owner, Sales Settings → toggle "Allow Credit Overrides" OFF. Re-login as the authorized user from E1.
- **Action:** Trigger the credit block.
- **Expected:** Error banner: **"Customer is over their credit limit. Overrides are disabled by company policy."** Modal does NOT open.

## Done when

- E1, E2, E3 results recorded back in the parent script's results table.
- Any 🔴/⚠ findings opened as bug-fix tasks.
- Task 148 can then move forward.
