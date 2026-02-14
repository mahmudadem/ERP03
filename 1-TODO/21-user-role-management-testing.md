# 21 — User & Role Management Testing

> **Priority:** P1 (tied to existing TODO #3)
> **Estimated Effort:** 1–2 days
> **Dependencies:** None
> **Source:** TODO item #3 — "check if we are ready to test adding new users to the company and assign roles to them"

---

## Problem Statement (from TODO)

Need to verify that the user management and role assignment flows work end-to-end before testing with real users.

---

## Current State

- ✅ RBAC system exists (`PermissionChecker`, role-based guards)
- ✅ API routes protected by `permissionGuard`
- ✅ Roles and permissions defined in the system
- ? User invitation flow — needs verification
- ? Role assignment UI — needs verification
- ? Permission enforcement — needs end-to-end testing

---

## Requirements

### Test Plan

This is primarily a **testing and verification task**, not a build task.

#### Test 1: User Invitation
1. Admin user invites a new user (by email)
2. New user receives invitation
3. New user accepts and creates account
4. New user appears in company user list
5. **Expected:** New user can log in and see the company

#### Test 2: Role Assignment
1. Admin assigns "Accountant" role to the new user
2. New user logs in
3. **Expected:** Can create and edit vouchers, view reports
4. **Expected:** Cannot access settings or delete posted vouchers

#### Test 3: Role Change
1. Admin changes user role from "Accountant" to "Viewer"
2. User refreshes or re-logs
3. **Expected:** Can view vouchers but cannot create/edit
4. **Expected:** UI hides create/edit buttons

#### Test 4: Permission Enforcement
1. User with "Viewer" role tries to POST to `/api/accounting/vouchers` directly (via API)
2. **Expected:** Returns 403 Forbidden
3. User with "Accountant" role tries to access `/api/accounting/settings` 
4. **Expected:** Returns 403 if settings require admin role

#### Test 5: User Removal
1. Admin removes a user from the company
2. **Expected:** User can no longer access the company's data
3. **Expected:** User's session is invalidated or blocked on next request

---

## Implementation Plan

### Step 1: Review Existing User Management Code

1. Find user invitation endpoints and UI
2. Find role assignment endpoints and UI
3. Document current flow

### Step 2: Fix Any Issues Found

If testing reveals:
- Invitation emails not sending → fix the email service integration
- Role assignment not reflecting in UI → fix permission caching
- API routes not checking permissions → add missing guards

### Step 3: Document the Flow

Create internal documentation on how to:
- Invite a user
- Assign a role
- Available roles and their permissions
- How to create custom roles

---

## Verification Plan

### Manual (with two browsers/accounts)
1. Log in as Admin in Browser A
2. Invite a test user by email
3. Check email / invitation link
4. Accept invitation in Browser B
5. In Browser A: assign role to the test user
6. In Browser B: verify permissions match the assigned role
7. In Browser A: change the role
8. In Browser B: refresh and verify permissions changed

---

## Acceptance Criteria

- [ ] User invitation flow works end-to-end
- [ ] Role assignment reflects immediately (or after re-login)
- [ ] Permission enforcement blocks unauthorized API calls
- [ ] UI correctly hides/shows features based on role
- [ ] User removal blocks access to company data
- [ ] Flow is documented for other team members
