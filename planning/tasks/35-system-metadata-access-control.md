# 35 - System Metadata Access Control

## Problem
`system_metadata` is currently used as a global source (voucher templates, currencies, COA templates), but access is too broad.

We must allow valid flows (for example module/accounting initialization), while preventing unrelated client access and all client-side writes.

## Target Model
1. Deny by default in Firestore rules.
2. Allow read-only access to safe global metadata only when needed.
3. Block all client writes to `system_metadata/**`.
4. Perform privileged operations (copy selected templates to company) through backend use-cases only.
5. After initialization, modules should read from `companies/{companyId}/...` data, not directly from global system paths.

## Required Work
1. Replace temporary global-open Firestore rule with strict scoped rules.
2. Define explicit rule groups:
   - `system_metadata/**`: read policy by auth + collection allowlist, no client write.
   - `companies/{companyId}/**`: only company members and permission-scoped operations.
3. Move/verify initialization logic in backend:
   - read selected system templates
   - copy only selected items into company module collections
4. Remove direct frontend dependency on unrestricted `system_metadata` reads where not required.
5. Add backend authorization checks for initialization endpoints (company role + permission).

## Acceptance Criteria
1. A normal company user cannot write anything under `system_metadata/**`.
2. A company can only read/write its own `companies/{companyId}/...` documents.
3. Accounting initialization can still copy selected voucher types successfully.
4. Sidebar/forms show only company-selected/owned voucher forms after initialization.
5. Security rules tests cover positive and negative access scenarios.

## Notes
- Shared read catalogs are acceptable only when explicitly intended and rule-scoped.
- System/global updates must be done by backend service/admin path only.
