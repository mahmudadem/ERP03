# Task 42 — Sidebar Permission QA Matrix

**Status:** Not started  
**Priority:** Medium  
**Created:** 2026-04-27  
**Owner:** CTO Agent  

## Goal
Verify that every role permission affects sidebar visibility and direct route access exactly as intended.

## Background
The sidebar now filters each link by its own permission, and company roles now derive module access from selected permissions. The remaining work is a systematic QA pass to confirm each permission-to-link mapping behaves correctly.

## Scope
- Accounting first, then repeat for Inventory, Sales, Purchases, and other visible modules.
- Test one permission at a time.
- Confirm sidebar visibility.
- Confirm direct route behavior.
- Confirm parent groups disappear when all children are hidden.
- Confirm no hidden route becomes reachable by URL unless the role has the required permission.

## Test Method
For each permission:
1. Create a temporary role with only that permission.
2. Assign it to a non-owner company user.
3. Sign in as that user or refresh that user session.
4. Record which sidebar links are visible.
5. Attempt direct navigation to related routes.
6. Compare actual result against expected result.

## Acceptance Criteria
- Every sidebar route has a matching required permission.
- Links only appear when the role has the link's permission.
- Parent groups are visible only when at least one child link is visible.
- Direct route access matches sidebar visibility.
- No route produces a false 403 when the required permission exists.
- No route opens when the required permission is missing.

## Suggested Matrix Columns
| Module | Permission | Expected Sidebar Links | Expected Direct Routes | Actual | Result |
| --- | --- | --- | --- | --- | --- |
| Accounting | `accounting.accounts.view` | Chart of Accounts | `/accounting/accounts` | TBD | TBD |
| Accounting | `accounting.vouchers.view` | Vouchers / All Vouchers | `/accounting/vouchers` | TBD | TBD |
| Accounting | `accounting.reports.view` | Reports group | Accounting report routes | TBD | TBD |

## Notes
- Use fresh roles where possible. Existing roles created before the module-bundle fix need to be re-saved or recreated.
- If a permission intentionally unlocks multiple links, document that explicitly in the matrix.
- If a route is intentionally hidden but still accessible through another workflow, document the workflow owner.
