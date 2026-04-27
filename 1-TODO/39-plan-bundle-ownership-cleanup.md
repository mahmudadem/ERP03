# Plan 39 — Plan/Bundle Ownership Cleanup

**Status:** Planned
**Priority:** Medium
**Reason:** Current onboarding mixes user-level plans with company-level subscriptions.

## Problem

The current system asks a new user to select a plan immediately after signup and stores that choice on the global user record (`users/{userId}.planId`). Company creation then separately asks for a bundle and stores that bundle on the company as `subscriptionPlan`.

For ERP03, this is the wrong ownership model:

- A user account is identity only.
- A company/tenant owns subscription, plan, bundle, limits, modules, and capabilities.
- Employees, accountants, sales users, and warehouse users added to an existing company should not choose a plan.
- User permissions should come from company membership and role, constrained by the company's subscription/entitlement.

## Current Behavior

1. Signup creates Firebase Auth user and global `users` document.
2. User is redirected to `/onboarding/plan`.
3. Selected plan is stored on `User.planId`.
4. User then creates or selects a company.
5. Company creation asks for `bundleId` and creates company entitlement/module records from that bundle.

## Target Behavior

1. Signup creates only identity: Firebase Auth user + global `users` document.
2. If user already belongs to at least one company, send them to company selector.
3. If user belongs to no companies, send them to company creation.
4. Company creation asks for the commercial package:
   - plan, bundle, or a unified subscription package
   - module/capability entitlement
   - limits such as max users, storage, companies, transactions
5. Store subscription and entitlement on the company/tenant, not on the user.

## Proposed Fix

### Phase 1 — Stabilize Access Flow

- Stop creating placeholder global users from company user add/invite flow.
- Allow company admins to add existing platform users only.
- Route users with existing company membership to company selector even if `User.planId` is empty.

### Phase 2 — Rename Concepts

- Rename user-facing "Plan Selection" to company/package selection.
- Decide whether `Plan` and `Bundle` remain separate:
  - **Plan:** commercial limits/pricing.
  - **Bundle:** modules/capabilities package.
- Or merge them into a single `SubscriptionPackage` model.

### Phase 3 — Move Subscription Ownership

- Remove reliance on `User.planId` for onboarding.
- Store selected plan/package on company subscription/entitlement records.
- Keep global `users` free of tenant subscription data.
- Update guards to check company entitlement and role permissions.

### Phase 4 — Data Migration

- For existing users with `planId`, migrate useful plan data to owned companies where possible.
- Leave legacy user `planId` readable during transition, then remove it after compatibility window.

## Acceptance Criteria

- Existing company members never see mandatory plan selection.
- Only company owners/admins creating a company choose commercial package/subscription.
- Subscription limits are enforced at company level.
- Global user records represent identity only.
- SQL migration remains clean: subscription ownership maps to tenant/company tables, not user identity.
