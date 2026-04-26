# Phase 2: Module Entitlements Implementation Report

**Date:** 2026-04-26
**Status:** ✅ Complete

---

## Goal

Implement Phase 2 of the module architecture refactor: entitlements and bundles - replacing the legacy `company.modules` array with normalized `CompanyEntitlement` tables and real `EntitlementService`.

---

## Scope

| Component | Status |
|-----------|--------|
| CompanyEntitlement/Item Prisma tables | ✅ |
| BundleItem Prisma table | ✅ |
| ICompanyEntitlementRepository (SQL + Firestore) | ✅ |
| PrismaCompanyEntitlementRepository implementation | ✅ |
| FirestoreCompanyEntitlementRepository implementation | ✅ |
| EntitlementService (real implementation) | ✅ |
| EntitlementServiceAdapter (legacy stub) | ✅ |
| Module startup validation using entitlements | ✅ |
| CreateCompanyUseCase → write entitlements | ✅ |
| UpgradeCompanyBundleUseCase → reconcile entitlements | ✅ |

---

## Database Changes

### Prisma Schema (`prisma/schema.prisma`)

**New Models:**

```prisma
model BundleRegistry {
  id                String   @id @default(uuid())
  code              String   @unique
  name              String
  description      String?
  modules          String[]
  lifecycleStatus  String   @default("draft") // draft | ready | deprecated | inactive
  pricing          Json?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  items            BundleItem[]
}

model BundleItem {
  id        String   @id @default(uuid())
  bundleId  String
  itemType  String   // "module" or "capability"
  itemKey   String
  createdAt DateTime @default(now())

  bundle    BundleRegistry @relation(fields: [bundleId], references: [id], onDelete: Cascade)

  @@unique([bundleId, itemKey])
}

model CompanyEntitlement {
  id          String   @id @default(uuid())
  companyId   String
  sourceType  String   // "bundle" | "superadmin_override" | "trial" | "promotion"
  sourceId    String
  validFrom   DateTime @default(now())
  validUntil  DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       CompanyEntitlementItem[]

  @@index([companyId])
  @@index([companyId, isActive])
}

model CompanyEntitlementItem {
  id              String   @id @default(uuid())
  entitlementId   String
  itemType        String   // "module" or "capability"
  itemKey         String
  createdAt       DateTime @default(now())

  entitlement     CompanyEntitlement @relation(fields: [entitlementId], references: [id], onDelete: Cascade)

  @@unique([entitlementId, itemKey])
}
```

---

## Domain Models

### File: `src/domain/super-admin/EntitlementDefinition.ts`

```typescript
export type EntitlementSourceType = 'bundle' | 'superadmin_override' | 'trial' | 'promotion';
export type EntitlementItemType = 'module' | 'capability';

export interface CompanyEntitlement {
  id: string;
  companyId: string;
  sourceType: EntitlementSourceType;
  sourceId: string;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  items: CompanyEntitlementItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyEntitlementItem {
  id: string;
  entitlementId: string;
  itemType: EntitlementItemType;
  itemKey: string;
  createdAt: Date;
}
```

---

## Repository Interfaces

### File: `src/repository/interfaces/super-admin/ICompanyEntitlementRepository.ts`

```typescript
export interface ICompanyEntitlementRepository {
  getByCompanyId(companyId: string): Promise<CompanyEntitlement[]>;
  getActiveByCompanyId(companyId: string): Promise<CompanyEntitlement[]>;
  getEntitlementById(id: string): Promise<CompanyEntitlement | null>;
  createEntitlement(entitlement: CompanyEntitlement): Promise<void>;
  updateEntitlement(id: string, updates: Partial<CompanyEntitlement>): Promise<void>;
  deactivateEntitlement(id: string): Promise<void>;

  addItem(entitlementId: string, item: CompanyEntitlementItem): Promise<void>;
  removeItem(entitlementId: string, itemKey: string): Promise<void>;
  getItemsByEntitlementId(entitlementId: string): Promise<CompanyEntitlementItem[]>;

  getEffectiveModules(companyId: string): Promise<string[]>;
  getEffectiveCapabilities(companyId: string): Promise<string[]>;
  hasModule(companyId: string, moduleId: string): Promise<boolean>;
  hasCapability(companyId: string, capabilityId: string): Promise<boolean>;
}
```

**SQL Implementation:** `src/infrastructure/prisma/repositories/super-admin/PrismaCompanyEntitlementRepository.ts`
**Firestore Implementation:** `src/infrastructure/firestore/repositories/super-admin/FirestoreCompanyEntitlementRepository.ts`

---

## Service Layer

### Interface: `src/application/platform/IEntitlementService.ts`

```typescript
export interface IEntitlementService {
  companyHasModule(companyId: string, moduleId: string): Promise<boolean>;
  companyHasCapability(companyId: string, capabilityId: string): Promise<boolean>;
  getEntitledModules(companyId: string): Promise<string[]>;
  getEntitledCapabilities(companyId: string): Promise<string[]>;
  grantModule(companyId: string, moduleId: string, sourceType: string, sourceId: string): Promise<void>;
  revokeModule(companyId: string, moduleId: string): Promise<void>;
}
```

### Real Implementation: `src/application/platform/EntitlementService.ts`

- Uses `ICompanyEntitlementRepository` internally
- Delegates to repository methods for CRUD
- Normalizes module IDs to lowercase

### Legacy Adapter: `src/application/platform/EntitlementServiceAdapter.ts`

- Reads from legacy `company.modules` array
- Maintains backward compatibility with Phase 1
- Stub for `grantModule`/`revokeModule` (returns error)

---

## Use Case Changes

### 1. CreateCompanyUseCase (`src/application/onboarding/use-cases/CreateCompanyUseCase.ts`)

**Changes:**
- Added `ICompanyEntitlementRepository` to constructor
- Creates `CompanyEntitlement` after company save
- Includes all modules from bundle + `companyAdmin`
- Tracks `entitlementCreated` flag for rollback

**Entitlement Created:**
```typescript
{
  id: `ent_${company.id}`,
  companyId: company.id,
  sourceType: 'bundle',
  sourceId: input.bundleId,
  isActive: true,
  items: finalModules.map(moduleCode => ({
    id: `item_${company.id}_${moduleCode}`,
    entitlementId: `ent_${company.id}`,
    itemType: 'module',
    itemKey: moduleCode
  }))
}
```

**Controller:** `src/api/controllers/onboarding/OnboardingController.ts`
- Passes `diContainer.companyEntitlementRepository!` to use case

### 2. UpgradeCompanyBundleUseCase (`src/application/company-admin/use-cases/UpgradeCompanyBundleUseCase.ts`)

**Changes:**
- Added `ICompanyEntitlementRepository` to constructor
- Reconciles entitlements after bundle change:
  - Gets current entitlement items
  - Adds modules in new bundle but not current
  - Removes modules in current but not new bundle

**Returns:**
```typescript
{
  bundleId: string,
  status: 'upgraded',
  modulesAdded: string[],
  modulesRemoved: string[]
}
```

**Controller:** `src/api/controllers/company-admin/CompanyBundleController.ts`
- Passes `diContainer.companyEntitlementRepository!` to use case

---

## DI Container

### File: `src/infrastructure/di/bindRepositories.ts`

```typescript
get companyEntitlementRepository(): ICompanyEntitlementRepository | null {
  if (DB_TYPE !== 'SQL') return null;
  return new PrismaCompanyEntitlementRepository(getPrismaClient());
}
```

**Note:** SQL-only implementation. Returns `null` for Firestore mode. Firestore continues to use legacy adapter.

---

## Module Startup Validation

### File: `src/modules/moduleStartupValidation.ts`

- Uses real `EntitlementService` if available from DI
- Falls back to `EntitlementServiceAdapter` for legacy compatibility

---

## Unit Tests

### File: `src/application/platform/__tests__/EntitlementService.test.ts`

**Tests:** 9 passing
- Create entitlement with bundle modules
- Add to existing entitlement
- Query entitled modules/capabilities
- Bundle upgrade (add modules)
- Bundle downgrade (remove modules)
- Capability support

---

## Build Status

```
✅ npm run build - passes
✅ npm test - passes (9/9 EntitlementService tests)
```

---

## Notes

1. **Legacy Data preserved:** Company still has `modules` array - used for backward compatibility
2. **Phase 3 continues:** `CompanyModuleEntity` creation still happens for initialization tracking
3. **SQL-only entitlements:** Firestore mode uses legacy adapter; SQL mode uses real implementation
4. **No migration:** Existing companies' modules not migrated (no production data yet)
5. **Platform IDs:** `companyAdmin`, `core`, `auth`, `rbac`, `settings` excluded from entitlement checks

---

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added CompanyEntitlement, CompanyEntitlementItem, BundleItem |
| `src/domain/super-admin/EntitlementDefinition.ts` | New domain models |
| `src/repository/interfaces/super-admin/ICompanyEntitlementRepository.ts` | New interface |
| `src/infrastructure/prisma/repositories/super-admin/PrismaCompanyEntitlementRepository.ts` | New implementation |
| `src/infrastructure/firestore/repositories/super-admin/FirestoreCompanyEntitlementRepository.ts` | New implementation |
| `src/application/platform/EntitlementService.ts` | Real implementation |
| `src/application/platform/EntitlementServiceAdapter.ts` | Added grant/revoke stubs |
| `src/application/platform/IEntitlementService.ts` | Interface updated |
| `src/application/onboarding/use-cases/CreateCompanyUseCase.ts` | Creates entitlements |
| `src/application/company-admin/use-cases/UpgradeCompanyBundleUseCase.ts` | Reconciles entitlements |
| `src/api/controllers/onboarding/OnboardingController.ts` | Injects entitlementRepo |
| `src/api/controllers/company-admin/CompanyBundleController.ts` | Injects entitlementRepo |
| `src/infrastructure/di/bindRepositories.ts` | Added entitlementRepo binding |
| `src/application/platform/__tests__/EntitlementService.test.ts` | Unit tests |

---

## Next Steps (Optional)

1. **Bundle downgrade flow:** Already handled in UpgradeCompanyBundleUseCase
2. **Backfill migration:** Script to convert existing companies' modules to entitlements (when needed)
3. **BundleItem capabilities:** Add capability items to bundles (not implemented yet)
4. **Trial/Promotion sources:** Add support for `trial` and `promotion` source types in use cases