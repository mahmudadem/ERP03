# Module, Feature, Bundle, Entitlement Architecture
not all prject spec still valid we need to update this doc
## Purpose

This document replaces the earlier fix plan. The issue is not only that Company Admin reads modules from code instead of the database. The real problem is a missing architecture contract between:

- Backend code implementation
- SuperAdmin-managed registry metadata
- Company subscription/entitlement
- Company-level enablement/configuration

The final architecture below is the agreed contract.

---

## Core Decision

A DB module record does not make a module runnable.

A module is available to a company only when all of these are true:

```text
backend implementation exists
AND DB registry record exists
AND implementation check passed
AND lifecycleStatus = ready
AND runtimeStatus = available
AND company is entitled to the module
```

Company Admin/users never see implementation errors. SuperAdmin sees all registry and implementation details.

---

## Definitions

### Platform Services

Platform services are required system capabilities and are not business modules.

Examples:

```text
auth
tenant context
rbac
companyAdmin
settings
audit
billing engine
module registry itself
```

They must not be sold, bundled, enabled, disabled, suspended, or initialized like business modules.

Current legacy values such as `companyAdmin` may remain in old company module arrays for compatibility, but they must be excluded from new business module registry exposure.

### Business Modules

Business modules are selectable product areas.

Examples:

```text
accounting
inventory
sales
purchase
crm
hr
pos
manufacturing
```

Business modules can be globally released, deprecated, suspended, bundled, entitled, enabled, configured, and initialized.

### Capabilities

Capabilities are features inside a module.

Example:

```text
crm.contacts
crm.custom-fields
crm.ai-scoring
crm.automation
```

Different customer needs must be modeled as capabilities, not as `crm_v1` / `crm_v2` module IDs.

Module version is release tracking. It is not a customer-selectable product variant.

---

## Status Model

Use three separate statuses. Do not overload one `status` field.

### lifecycleStatus

```text
draft
ready
deprecated
inactive
```

Meanings:

```text
draft: SuperAdmin/internal only. Not available for new company use.
ready: available for new assignment/use if all other checks pass.
deprecated: existing companies may keep using it; no new adoption.
inactive: unavailable and unused. Normal deactivation can only reach this state after usage is removed.
```

### runtimeStatus

```text
available
suspended
```

Meanings:

```text
available: runtime access allowed.
suspended: temporary emergency block. Existing users see the module/feature but access is blocked visibly.
```

No `read_only` status for now. Read-only requires route-level read/write classification and is out of scope.

### implementationStatus

```text
unchecked
passed
failed
```

Meanings:

```text
unchecked: SuperAdmin has not run implementation check.
passed: backend verified implementation/manifest compatibility.
failed: check failed; SuperAdmin sees exact reason.
```

Do not add a separate `isActive` field for modules/features in the new architecture. `lifecycleStatus` is the catalog enable/disable state.

---

## Implementation Check

Implementation checks are explicit SuperAdmin actions, not per-request checks.

Recommended endpoints:

```text
POST /super-admin/modules/:id/check-implementation
POST /super-admin/capabilities/:id/check-implementation
```

Module check validates:

```text
1. Code module manifest exists for module ID.
2. DB version is compatible with code manifest version.
3. Router exists.
4. Permission manifest exists.
5. Required migration/check hooks pass.
```

Capability check validates:

```text
1. Capability exists in code manifest.
2. Capability belongs to the correct module.
3. Required permission/guard keys exist.
4. Required migration/check hooks pass.
```

Activation rule:

```text
Cannot set lifecycleStatus = ready unless implementationStatus = passed.
```

Startup rule:

```text
Backend runs lightweight startup validation into an in-memory availability map.
Startup validation does not auto-write implementationStatus to DB.
If DB says passed but runtime validation fails, runtime blocks usage and SuperAdmin sees a mismatch.
Manual SuperAdmin check updates DB.
```

---

## Availability Rules

### SuperAdmin Module Visibility

SuperAdmin sees combined registry state:

```text
DB registered + code installed
DB registered + code missing
code installed + DB record missing
```

Code-only module:

```text
Visible to SuperAdmin as "implementation installed but not registered".
Hidden from Company Admin.
Cannot be enabled by companies.
```

DB-only module:

```text
Visible to SuperAdmin as "registered but implementation missing".
Hidden from Company Admin.
Cannot be ready/active for companies.
```

### Company Admin Module List

Company Admin sees only modules where:

```text
lifecycleStatus = ready
AND runtimeStatus = available
AND implementationStatus = passed
AND startup availability map says usable
AND company is entitled to the module
```

Suspended modules that are already enabled for a company remain visible as enabled/suspended, but access is blocked with a clear message.

Suspended modules not yet enabled are not shown as available to enable.

### Company Admin Enable Module

Backend must validate:

```text
1. Module exists in DB.
2. Runtime implementation exists.
3. lifecycleStatus = ready.
4. runtimeStatus = available.
5. implementationStatus = passed.
6. Startup availability map says usable.
7. Company is entitled to the module.
8. Module is not already enabled.
```

Frontend filters are UX only. Backend use cases must enforce all rules.

### Emergency Suspend

Emergency suspend is different from lifecycle deactivation.

```text
Deactivate/inactive = product catalog decision.
Suspend = temporary runtime safety block due to bug/security/data issue.
```

Emergency suspend behavior:

```text
1. Blocks new companies from enabling the module/feature.
2. Blocks existing companies from using runtime routes.
3. Keeps company module/capability records unchanged.
4. Does not remove items from bundles.
5. Shows enabled users a visible blocked state.
6. Requires reason + audit log.
7. Is reversible.
```

Recommended API response for suspended access:

```text
423 Locked
```

Example message:

```text
CRM is temporarily unavailable due to maintenance. Your data is safe. Please try again later or contact your administrator.
```

### Normal Deactivate

Normal deactivate/inactive is blocked if the module/feature is used.

Block if:

```text
any company has it enabled
OR any ready/active bundle contains it
OR any active entitlement grants it
OR any role/template depends on its permissions
```

Use `deprecated` to stop new adoption while preserving existing users.

Use `suspended` to temporarily block runtime because of an incident.

---

## Versioning And Variants

Module ID stays stable:

```text
crm
```

Do not create customer-facing module IDs such as:

```text
crm_v1
crm_v2
crm-smart
crm-basic
```

If CRM v1 is limited and CRM v2 is smarter, model that as capabilities:

```text
crm.contacts
crm.notes
crm.custom-fields
crm.ai-scoring
crm.automation
```

Company A can have:

```text
crm.contacts
crm.notes
```

Company B can have:

```text
crm.contacts
crm.notes
crm.ai-scoring
crm.automation
```

Both companies use the same `crm` module identity and same CRM data model. Upgrades add capabilities.

---

## Feature/Capability Enablement

SuperAdmin controls global capability availability.

A globally ready capability does not automatically enable it for all companies. It only makes it available for entitlement/assignment.

Capability enablement policies:

```text
platform_only
bundle_entitled
company_admin_optional
```

Meanings:

```text
platform_only: only SuperAdmin can grant/enable for a company.
bundle_entitled: company gets it through bundle/plan entitlement.
company_admin_optional: Company Admin can enable/disable it if entitled and parent module is enabled.
```

Company Admin can enable a capability only if:

```text
1. Capability exists in DB.
2. implementationStatus = passed.
3. lifecycleStatus = ready.
4. runtimeStatus = available.
5. enablementPolicy = company_admin_optional.
6. Company is entitled to the capability.
7. Parent module is enabled.
8. Prerequisites/migrations are satisfied.
```

---

## Subscription Awareness

Build subscription awareness now as entitlements. Do not build payment/billing now.

Important distinction:

```text
Entitled = company is allowed to use something.
Enabled = company has turned it on/configured it.
```

Runtime code must not ask "which subscription tier is this company on?"

Runtime code must ask:

```text
Is company entitled to crm.ai-scoring?
Is crm.ai-scoring enabled for this company?
```

---

## Database Design

The project is DB-agnostic. All persistence must go through repository interfaces and have Prisma + Firestore implementations where applicable.

### ModuleRegistry

```ts
ModuleRegistry {
  id: string                 // "crm"
  name: string
  description?: string
  version: string            // catalog/expected implementation version
  lifecycleStatus: "draft" | "ready" | "deprecated" | "inactive"
  runtimeStatus: "available" | "suspended"
  implementationStatus: "unchecked" | "passed" | "failed"
  implementationError?: string
  implementationCheckedAt?: Date
  releaseNotes?: string
  createdAt: Date
  updatedAt: Date
}
```

### ModuleCapabilityRegistry

```ts
ModuleCapabilityRegistry {
  id: string                 // "crm.ai-scoring"
  moduleId: string           // "crm"
  name: string
  description?: string
  lifecycleStatus: "draft" | "ready" | "deprecated" | "inactive"
  runtimeStatus: "available" | "suspended"
  implementationStatus: "unchecked" | "passed" | "failed"
  implementationError?: string
  implementationCheckedAt?: Date
  enablementPolicy: "platform_only" | "bundle_entitled" | "company_admin_optional"
  requiresMigration?: boolean
  createdAt: Date
  updatedAt: Date
}
```

### BundleRegistry

```ts
BundleRegistry {
  id: string
  name: string
  description?: string
  lifecycleStatus: "draft" | "ready" | "deprecated" | "inactive"
  createdAt: Date
  updatedAt: Date
}
```

### BundleItem

```ts
BundleItem {
  id: string
  bundleId: string
  itemType: "module" | "capability"
  itemKey: string            // "crm" or "crm.ai-scoring"
  createdAt: Date
}
```

Bundles are selectable for new companies only if all BundleItems are valid for new adoption.

Bundles are never auto-mutated when module/capability status changes. SuperAdmin must explicitly edit/create replacement bundles.

### CompanyEntitlement

```ts
CompanyEntitlement {
  id: string
  companyId: string
  sourceType: "bundle" | "superadmin_override" | "trial" | "promotion"
  sourceId: string
  validFrom: Date
  validUntil?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

### CompanyEntitlementItem

```ts
CompanyEntitlementItem {
  id: string
  entitlementId: string
  itemType: "module" | "capability"
  itemKey: string
  createdAt: Date
}
```

Normalized entitlements are the source of truth.

Array-shaped effective entitlements may exist only as derived cache/API response:

```ts
CompanyEffectiveEntitlement {
  companyId: string
  modules: string[]
  capabilities: string[]
  recalculatedAt: Date
}
```

### CompanyModule

Company module enablement/configuration is separate from entitlement.

```ts
CompanyModule {
  id: string
  companyId: string
  moduleId: string
  enabled: boolean
  initialized: boolean
  initializationStatus: "pending" | "in_progress" | "complete"
  config: Json
  enabledAt?: Date
  disabledAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

### CompanyCapability

```ts
CompanyCapability {
  id: string
  companyId: string
  capabilityId: string
  enabled: boolean
  config: Json
  enabledAt?: Date
  disabledAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

---

## Permissions

Permission keys for implemented modules/features are owned by code manifests.

Company Admin reads permissions from backend API, not directly from DB or code.

Backend serves a verified permission catalog generated/synced from module/capability manifests and filtered by company entitlement and enabled modules/features.

SuperAdmin can manage permission metadata only:

```text
label
description
assignable
group
display order
deprecated/hidden metadata
```

SuperAdmin cannot freely create/delete/rename manifest-owned permission keys.

Example:

```ts
PermissionCatalog {
  key: "crm.contacts.manage"
  moduleId: "crm"
  capabilityId: "crm.contacts"
  label: "Manage Contacts"
  description: "Create and edit CRM contacts"
  assignable: true
  source: "manifest"
  createdAt: Date
  updatedAt: Date
}
```

Company Admin assigns permissions through roles:

```text
1. Company Admin opens role editor.
2. Frontend calls available permissions API.
3. Backend returns permissions only for enabled/entitled modules and capabilities.
4. Company Admin selects permissions for a role.
5. Backend validates selected permissions against the same catalog.
6. Users receive permissions through roles.
```

---

## Route And Guard Rules

Route mounting remains code-based.

Reason:

```text
A DB row cannot provide Express routes, controllers, migrations, or business logic.
```

Tenant/module guards must use the availability service, not raw code registry or raw DB alone.

Guard order:

```text
1. Backend implementation exists.
2. DB registry exists.
3. Startup availability map says usable.
4. lifecycleStatus allows existing usage.
5. runtimeStatus is not suspended.
6. Company is entitled.
7. Company module is enabled.
8. Module initialization is complete if required.
9. User has permission.
```

If suspended:

```text
Return 423 Locked with visible message.
```

If not entitled or not enabled:

```text
Return 403 Forbidden.
```

If implementation missing:

```text
Return 503 Service Unavailable or 400 for admin activation attempts.
```

---

## Migration From Current System

Current problems to address:

```text
ListCompanyModulesUseCase reads ModuleRegistry code directly.
EnableModuleForCompanyUseCase validates against ModuleRegistry code directly.
companyModuleGuard uses ModuleRegistry code directly.
AuthPermissionsController filters modules through ModuleRegistry code directly.
BundleRegistry only stores module arrays.
Company creation stores bundle modules directly and forces companyAdmin as a module.
SuperAdmin permissions are free-form CRUD.
```

Migration principles:

```text
1. Do not break existing companies.
2. Keep legacy company.modules temporarily for compatibility.
3. Introduce normalized entitlements and enablement records.
4. Backfill entitlements from existing company subscription/bundle data.
5. Keep route mounting code-based.
6. Replace request-time code-registry decisions with ModuleAvailabilityService.
7. Exclude platform/internal IDs from business module catalog.
```

Platform/internal IDs to exclude:

```text
companyAdmin
core
auth
rbac
settings
```

Do not refactor `companyAdmin` storage in the first implementation unless necessary. Treat it as legacy/platform access.

---

## Implementation Phases

### Phase 1: Availability Contract And Enforcement

```text
1. Define module/capability manifest contract in code.
2. Extend registry domain models and DB schemas.
3. Add ModuleAvailabilityService.
4. Add startup validation in memory.
5. Add SuperAdmin check implementation endpoint.
6. Change Company Admin module list to return only available + entitled modules.
7. Change Company Admin enable to validate available + entitled.
8. Change module guards to block suspended/unavailable modules visibly.
9. Keep route mounting from code registry.
```

### Phase 2: Entitlements And Bundles

```text
1. Add CompanyEntitlement and CompanyEntitlementItem.
2. Add BundleItem.
3. Backfill bundle items from existing modulesIncluded/modules arrays.
4. Create company entitlements from selected bundle.
5. Add EntitlementService.
6. Change company creation and bundle upgrade to use entitlement records.
7. Block invalid bundles from new company selection.
```

### Phase 3: Capabilities

```text
1. Add ModuleCapabilityRegistry.
2. Add CompanyCapability.
3. Add capability availability checks.
4. Add Company Admin optional feature enable/disable for company_admin_optional capabilities.
5. Add SuperAdmin capability lifecycle/runtime/implementation actions.
```

### Phase 4: Permissions

```text
1. Define permission manifest format.
2. Sync permission catalog from manifests.
3. Refactor SuperAdmin permissions page away from free-form key CRUD.
4. Add Company Admin available-permissions API.
5. Validate role save against available permission catalog.
```

### Phase 5: UI

```text
1. SuperAdmin shows DB/code implementation mismatch states.
2. SuperAdmin can run implementation checks.
3. SuperAdmin can draft/ready/deprecate/inactivate when rules allow.
4. SuperAdmin can emergency suspend/resume with reason/audit.
5. Company Admin sees only available modules and optional features.
6. Existing enabled suspended modules remain visible with blocked state.
```

---

## Acceptance Criteria

```text
Company Admin module list does not read raw code registry.
Company Admin enable does not allow DB-only or implementation-failed modules.
DB-only modules are SuperAdmin-only.
Code-only modules are visible to SuperAdmin as unregistered implementations.
Suspended enabled modules remain visible but blocked.
Normal deactivate is blocked while used.
Bundles are never auto-mutated.
Invalid bundles cannot be selected for new company creation/upgrade.
Entitlements are checked before enablement.
Company Admin optional features require entitlement + enablementPolicy.
Permissions assigned to roles come from verified catalog, not arbitrary strings.
Prisma and Firestore repositories implement the same repository contracts.
Tests cover availability, entitlement, bundle validation, guard behavior, and permission filtering.
```

---

## Copy-Ready Handoff Prompt For Executing Agent

```text
You are executing the final module architecture refactor for this ERP project.

Read D:\DEV2026\ERP03\SPEC.md fully before coding. Treat it as the source of truth.

Goal:
Implement the module/feature/bundle/entitlement architecture described in SPEC.md. Do not implement the old "just read modules from DB" plan. The correct fix is an availability contract:

available module =
backend implementation exists
AND DB registry record exists
AND implementation check passed
AND lifecycleStatus = ready
AND runtimeStatus = available
AND company is entitled

Important constraints:
- Route mounting remains code-based. A DB record cannot create runtime routes.
- Company Admin must never see DB-only or implementation-failed modules.
- SuperAdmin must see DB/code mismatch states.
- Do not add protected module logic.
- Do not add read_only runtime status.
- Do not use crm_v1/crm_v2 module IDs for product variants. Use capabilities.
- Do not refactor companyAdmin storage in the first pass unless required; exclude platform/internal IDs from business module exposure.
- Backend use cases enforce all rules. Frontend filtering is UX only.
- The project is DB-agnostic. Use repository interfaces and implement both Prisma and Firestore paths where the project has both.

Known current files to inspect:
- backend/src/application/platform/ModuleRegistry.ts
- backend/src/modules/index.ts
- backend/src/modules/*/*Module.ts
- backend/src/application/company-admin/use-cases/ListCompanyModulesUseCase.ts
- backend/src/application/company-admin/use-cases/EnableModuleForCompanyUseCase.ts
- backend/src/api/middlewares/guards/companyModuleGuard.ts
- backend/src/api/controllers/auth/AuthPermissionsController.ts
- backend/src/application/company-admin/use-cases/ListAvailableBundlesUseCase.ts
- backend/src/application/company-admin/use-cases/UpgradeCompanyBundleUseCase.ts
- backend/src/application/onboarding/use-cases/CreateCompanyUseCase.ts
- backend/src/repository/interfaces/super-admin/IModuleRegistryRepository.ts
- backend/src/repository/interfaces/super-admin/IBundleRegistryRepository.ts
- backend/src/infrastructure/prisma/repositories/super-admin/*
- backend/src/infrastructure/firestore/repositories/super-admin/*
- backend/prisma/schema.prisma
- frontend/src/modules/super-admin/pages/ModulesManagerPage.tsx
- frontend/src/modules/super-admin/pages/BundlesManagerPage.tsx
- frontend/src/api/superAdmin/index.ts
- frontend/src/pages/company-admin/pages/ModulesPage.tsx
- frontend/src/hooks/useCompanyAdmin.ts

Recommended first implementation phase:
1. Add manifest contract for modules/capabilities in code.
2. Extend ModuleRegistry domain/schema/repositories with:
   lifecycleStatus: draft | ready | deprecated | inactive
   runtimeStatus: available | suspended
   implementationStatus: unchecked | passed | failed
   implementationError
   implementationCheckedAt
   version
   releaseNotes
3. Add ModuleAvailabilityService that combines DB registry + code registry + startup validation.
4. Add startup validation in memory only; do not auto-write DB on startup.
5. Add SuperAdmin check implementation endpoint.
6. Update Company Admin module list to use availability + entitlement filtering.
7. Update Company Admin enable use case to validate availability + entitlement.
8. Update companyModuleGuard and permission normalization paths to use the availability service rather than raw ModuleRegistry.getAllModules().
9. Keep route mounting from code registry.
10. Add tests for DB-only, code-only, version mismatch, suspended, deprecated, and ready cases.

Then implement normalized entitlements and bundle items:
- CompanyEntitlement
- CompanyEntitlementItem
- BundleItem
- EntitlementService

Rules:
- Bundles are never auto-mutated.
- Invalid bundles are blocked from new company use.
- Normal inactive/deactivate is blocked while any company/bundle/entitlement uses the item.
- Emergency suspend is allowed, audited, visible, and reversible.

Deliverable:
Code changes plus tests. Summarize any intentionally deferred legacy cleanup, especially companyAdmin/platform service cleanup.
```
