# COMPANY ADMIN CONTROLS - IMPLEMENTATION BLUEPRINT

**Module**: Company Admin Controls  
**Router**: Tenant Router (`/api/v1/tenant/company-admin`)  
**Purpose**: Enable company owners/admins to manage their company profile, users, roles, modules, bundles, and features  
**Date**: 2025-12-04

---

## SECTION 1 — MODULE STRUCTURE (FILES TO CREATE)

### Directory Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── company-admin/
│   │   │       ├── CompanyProfileController.ts
│   │   │       ├── CompanyUsersController.ts
│   │   │       ├── CompanyRolesController.ts
│   │   │       ├── CompanyModulesController.ts
│   │   │       ├── CompanyBundleController.ts
│   │   │       └── CompanyFeaturesController.ts
│   │   └── routes/
│   │       └── company-admin.routes.ts
│   ├── application/
│   │   └── company-admin/
│   │       └── use-cases/
│   │           ├── UpdateCompanyProfileUseCase.ts
│   │           ├── InviteCompanyUserUseCase.ts
│   │           ├── UpdateCompanyUserRoleUseCase.ts
│   │           ├── DisableCompanyUserUseCase.ts
│   │           ├── CreateCompanyRoleUseCase.ts
│   │           ├── UpdateCompanyRoleUseCase.ts
│   │           ├── DeleteCompanyRoleUseCase.ts
│   │           ├── EnableModuleForCompanyUseCase.ts
│   │           ├── DisableModuleForCompanyUseCase.ts
│   │           ├── UpgradeCompanyBundleUseCase.ts
│   │           └── ToggleFeatureFlagUseCase.ts
│   └── repository/
│       └── interfaces/
│           └── company-admin/
│               └── ICompanyAdminRepository.ts
```

### Files to Create

**Controllers (6 files)**:
- `CompanyProfileController.ts` - Company profile management
- `CompanyUsersController.ts` - User invitation and management
- `CompanyRolesController.ts` - Role CRUD operations
- `CompanyModulesController.ts` - Module activation/deactivation
- `CompanyBundleController.ts` - Bundle upgrades
- `CompanyFeaturesController.ts` - Feature flag toggles

**Use Cases (11 files)**:
- `UpdateCompanyProfileUseCase.ts`
- `InviteCompanyUserUseCase.ts`
- `UpdateCompanyUserRoleUseCase.ts`
- `DisableCompanyUserUseCase.ts`
- `CreateCompanyRoleUseCase.ts`
- `UpdateCompanyRoleUseCase.ts`
- `DeleteCompanyRoleUseCase.ts`
- `EnableModuleForCompanyUseCase.ts`
- `DisableModuleForCompanyUseCase.ts`
- `UpgradeCompanyBundleUseCase.ts`
- `ToggleFeatureFlagUseCase.ts`

**Repository Interfaces (1 file)**:
- `ICompanyAdminRepository.ts` - Aggregates company admin operations

**Routes (1 file)**:
- `company-admin.routes.ts` - All company admin routes

---

## SECTION 2 — ROUTE BLUEPRINT

### Base Path
```
/api/v1/tenant/company-admin
```

### Route Definitions

#### Company Profile Routes
```typescript
GET     /profile                    // Get company profile
POST    /profile/update             // Update company profile
```

#### User Management Routes
```typescript
GET     /users                      // List company users
POST    /users/invite               // Invite new user to company
POST    /users/:userId/update-role  // Update user's role
POST    /users/:userId/disable      // Disable user access
POST    /users/:userId/enable       // Re-enable user access
```

#### Role Management Routes
```typescript
GET     /roles                      // List company roles
GET     /roles/:roleId              // Get role details
POST    /roles/create               // Create new role
POST    /roles/:roleId/update       // Update role
DELETE  /roles/:roleId              // Delete role
```

#### Module Management Routes
```typescript
GET     /modules                    // List available modules
GET     /modules/active             // List active modules
POST    /modules/enable             // Enable module
POST    /modules/disable            // Disable module
```

#### Bundle Management Routes
```typescript
GET     /bundle                     // Get current bundle
GET     /bundle/available           // List available bundles
POST    /bundle/upgrade             // Upgrade to new bundle
```

#### Feature Flag Routes
```typescript
GET     /features                   // List all features
GET     /features/active            // List active features
POST    /features/toggle            // Toggle feature on/off
```

### Middleware Stack

All routes require:
1. `authMiddleware` - Verify Firebase token
2. `tenantContextMiddleware` - Load company context
3. `permissionGuard('system.company.manage')` OR `isOwner === true`

Special consideration:
- Owner role bypasses permission checks
- Some routes may require stricter permissions (e.g., bundle upgrades)

---

## SECTION 3 — USE CASE BLUEPRINTS

### 1. UpdateCompanyProfileUseCase

**Purpose**: Allow company admin/owner to update company profile information

**Input**:
```typescript
{
  companyId: string;
  userId: string;
  updates: {
    name?: string;
    country?: string;
    baseCurrency?: string;
    fiscalYearStart?: number;
    fiscalYearEnd?: number;
    logoUrl?: string;
    contactInfo?: {
      email?: string;
      phone?: string;
      address?: string;
    };
  }
}
```

**Validation**:
- `companyId` required and must exist
- `name` if provided, must be non-empty string
- `baseCurrency` if provided, must match ISO 4217 currency codes
- `fiscalYearStart` and `fiscalYearEnd` must be valid months (1-12)
- User must be owner or have `system.company.manage` permission

**Flow**:
1. Verify user has permission (owner or `system.company.manage`)
2. Load company via `CompanyRepository.findById(companyId)`
3. Validate updates against business rules
4. Apply updates to company entity
5. Save via `CompanyRepository.save(company)`
6. Return updated company profile

**Errors**:
- `CompanyNotFound` - Company ID doesn't exist
- `InvalidCurrency` - Currency code not supported
- `InvalidFiscalYear` - Fiscal year dates invalid
- `PermissionDenied` - User lacks permission
- `ValidationError` - Invalid input data

**Output**:
```typescript
{
  companyId: string;
  name: string;
  country: string;
  baseCurrency: string;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  logoUrl?: string;
  contactInfo: object;
  updatedAt: Date;
}
```

---

### 2. InviteCompanyUserUseCase

**Purpose**: Invite a new user to join the company

**Input**:
```typescript
{
  companyId: string;
  invitedBy: string;
  email: string;
  roleId: string;
  firstName?: string;
  lastName?: string;
}
```

**Validation**:
- `email` must be valid email format
- `email` must not already be a member of this company
- `roleId` must exist in company roles
- Inviter must have `system.company.manage` or be owner

**Flow**:
1. Verify inviter has permission
2. Check if user with email already exists in system
3. If user exists, check they're not already in this company
4. If user doesn't exist, create pending user record
5. Create `CompanyUser` membership record with status `pending`
6. Generate invitation token
7. Send invitation email (via notification service)
8. Return invitation details

**Errors**:
- `UserAlreadyMember` - User already belongs to company
- `InvalidRole` - Role ID doesn't exist
- `PermissionDenied` - Inviter lacks permission
- `InvalidEmail` - Email format invalid

**Output**:
```typescript
{
  invitationId: string;
  email: string;
  roleId: string;
  status: 'pending';
  invitedAt: Date;
  expiresAt: Date;
}
```

---

### 3. UpdateCompanyUserRoleUseCase

**Purpose**: Change a user's role within the company

**Input**:
```typescript
{
  companyId: string;
  userId: string;
  newRoleId: string;
  updatedBy: string;
}
```

**Validation**:
- `userId` must be a member of the company
- `newRoleId` must exist in company roles
- Cannot change owner's role (only one owner per company)
- Updater must have `system.company.manage` or be owner

**Flow**:
1. Verify updater has permission
2. Load company user membership
3. Verify user is not the owner (owners cannot be demoted)
4. Verify new role exists
5. Update `CompanyUser.roleId`
6. Save via `RbacCompanyUserRepository.update()`
7. Return updated membership

**Errors**:
- `UserNotFound` - User not a member
- `CannotChangeOwnerRole` - Attempted to change owner
- `InvalidRole` - Role doesn't exist
- `PermissionDenied` - Updater lacks permission

**Output**:
```typescript
{
  userId: string;
  companyId: string;
  roleId: string;
  roleName: string;
  updatedAt: Date;
}
```

---

### 4. DisableCompanyUserUseCase

**Purpose**: Disable a user's access to the company (soft delete)

**Input**:
```typescript
{
  companyId: string;
  userId: string;
  disabledBy: string;
  reason?: string;
}
```

**Validation**:
- `userId` must be a member of the company
- Cannot disable the owner
- Cannot disable yourself
- Disabler must have `system.company.manage` or be owner

**Flow**:
1. Verify disabler has permission
2. Load company user membership
3. Verify user is not the owner
4. Verify disabler is not disabling themselves
5. Set `CompanyUser.status = 'disabled'`
6. Set `CompanyUser.disabledAt = now()`
7. Save via `RbacCompanyUserRepository.update()`
8. Revoke active sessions (optional)
9. Return confirmation

**Errors**:
- `UserNotFound` - User not a member
- `CannotDisableOwner` - Attempted to disable owner
- `CannotDisableSelf` - User trying to disable themselves
- `PermissionDenied` - Disabler lacks permission

**Output**:
```typescript
{
  userId: string;
  status: 'disabled';
  disabledAt: Date;
  disabledBy: string;
}
```

---

### 5. CreateCompanyRoleUseCase

**Purpose**: Create a new custom role for the company

**Input**:
```typescript
{
  companyId: string;
  createdBy: string;
  name: string;
  description?: string;
  permissions: string[];
}
```

**Validation**:
- `name` required, must be unique within company
- `permissions` must be valid permission codes from system catalog
- Creator must have `system.company.manage` or be owner
- Cannot create role named "Owner" (reserved)

**Flow**:
1. Verify creator has permission
2. Validate role name is unique
3. Validate all permissions exist in system catalog
4. Create `CompanyRole` entity
5. Resolve permissions using `CompanyRolePermissionResolver`
6. Save via `CompanyRoleRepository.create()`
7. Return created role

**Errors**:
- `RoleNameExists` - Role name already used
- `InvalidPermission` - Permission code doesn't exist
- `ReservedRoleName` - Attempted to use reserved name
- `PermissionDenied` - Creator lacks permission

**Output**:
```typescript
{
  roleId: string;
  companyId: string;
  name: string;
  description: string;
  permissions: string[];
  resolvedPermissions: string[];
  createdAt: Date;
}
```

---

### 6. UpdateCompanyRoleUseCase

**Purpose**: Update an existing company role

**Input**:
```typescript
{
  companyId: string;
  roleId: string;
  updatedBy: string;
  updates: {
    name?: string;
    description?: string;
    permissions?: string[];
  }
}
```

**Validation**:
- `roleId` must exist and belong to company
- Cannot update "Owner" role (system-protected)
- If updating `name`, must be unique
- If updating `permissions`, all must be valid
- Updater must have `system.company.manage` or be owner

**Flow**:
1. Verify updater has permission
2. Load role via `CompanyRoleRepository.getById()`
3. Verify role is not "Owner"
4. Validate updates
5. Apply updates to role entity
6. Re-resolve permissions if changed
7. Save via `CompanyRoleRepository.update()`
8. Return updated role

**Errors**:
- `RoleNotFound` - Role doesn't exist
- `CannotUpdateOwnerRole` - Attempted to modify owner role
- `RoleNameExists` - New name conflicts
- `InvalidPermission` - Permission code doesn't exist
- `PermissionDenied` - Updater lacks permission

**Output**:
```typescript
{
  roleId: string;
  name: string;
  description: string;
  permissions: string[];
  resolvedPermissions: string[];
  updatedAt: Date;
}
```

---

### 7. DeleteCompanyRoleUseCase

**Purpose**: Delete a custom company role

**Input**:
```typescript
{
  companyId: string;
  roleId: string;
  deletedBy: string;
}
```

**Validation**:
- `roleId` must exist and belong to company
- Cannot delete "Owner" role
- Cannot delete role if users are assigned to it
- Deleter must have `system.company.manage` or be owner

**Flow**:
1. Verify deleter has permission
2. Load role via `CompanyRoleRepository.getById()`
3. Verify role is not "Owner"
4. Check if any users have this role
5. If users exist, return error
6. Delete via `CompanyRoleRepository.delete()`
7. Return confirmation

**Errors**:
- `RoleNotFound` - Role doesn't exist
- `CannotDeleteOwnerRole` - Attempted to delete owner role
- `RoleInUse` - Users are assigned to this role
- `PermissionDenied` - Deleter lacks permission

**Output**:
```typescript
{
  roleId: string;
  deleted: true;
  deletedAt: Date;
}
```

---

### 8. EnableModuleForCompanyUseCase

**Purpose**: Enable a module for the company (if allowed by bundle)

**Input**:
```typescript
{
  companyId: string;
  moduleName: string;
  enabledBy: string;
}
```

**Validation**:
- `moduleName` must be a valid system module
- Module must be included in company's bundle
- Module must not already be enabled
- Enabler must have `system.company.manage` or be owner

**Flow**:
1. Verify enabler has permission
2. Load company via `CompanyRepository.findById()`
3. Get company's bundle via `getBundleById(company.bundleId)`
4. Verify module is in bundle's allowed modules
5. Add module to `company.modules` array
6. Save via `CompanyRepository.save()`
7. Return updated module list

**Errors**:
- `ModuleNotFound` - Module doesn't exist
- `ModuleNotInBundle` - Module not allowed by bundle
- `ModuleAlreadyEnabled` - Module already active
- `PermissionDenied` - Enabler lacks permission

**Output**:
```typescript
{
  companyId: string;
  moduleName: string;
  enabled: true;
  activeModules: string[];
  enabledAt: Date;
}
```

---

### 9. DisableModuleForCompanyUseCase

**Purpose**: Disable a module for the company

**Input**:
```typescript
{
  companyId: string;
  moduleName: string;
  disabledBy: string;
}
```

**Validation**:
- `moduleName` must be currently enabled
- Cannot disable core modules (e.g., 'accounting' if it's mandatory)
- Disabler must have `system.company.manage` or be owner

**Flow**:
1. Verify disabler has permission
2. Load company via `CompanyRepository.findById()`
3. Verify module is in `company.modules`
4. Verify module is not mandatory
5. Remove module from `company.modules` array
6. Save via `CompanyRepository.save()`
7. Return updated module list

**Errors**:
- `ModuleNotEnabled` - Module not currently active
- `CannotDisableMandatoryModule` - Module is required
- `PermissionDenied` - Disabler lacks permission

**Output**:
```typescript
{
  companyId: string;
  moduleName: string;
  enabled: false;
  activeModules: string[];
  disabledAt: Date;
}
```

---

### 10. UpgradeCompanyBundleUseCase

**Purpose**: Upgrade company to a higher-tier bundle

**Input**:
```typescript
{
  companyId: string;
  newBundleId: string;
  upgradedBy: string;
}
```

**Validation**:
- `newBundleId` must be a valid bundle
- New bundle must be higher tier than current
- Upgrader must be owner (bundle changes are critical)
- Payment verification may be required (future)

**Flow**:
1. Verify upgrader is owner
2. Load company via `CompanyRepository.findById()`
3. Load current bundle via `getBundleById(company.bundleId)`
4. Load new bundle via `getBundleById(newBundleId)`
5. Verify new bundle tier > current tier
6. Update `company.bundleId = newBundleId`
7. Add new modules from bundle to `company.modules`
8. Add new features from bundle to `company.features`
9. Save via `CompanyRepository.save()`
10. Return updated bundle info

**Errors**:
- `BundleNotFound` - Bundle doesn't exist
- `InvalidUpgrade` - New bundle is lower tier
- `PermissionDenied` - Only owner can upgrade
- `PaymentRequired` - Payment verification failed (future)

**Output**:
```typescript
{
  companyId: string;
  bundleId: string;
  bundleName: string;
  modules: string[];
  features: string[];
  upgradedAt: Date;
}
```

---

### 11. ToggleFeatureFlagUseCase

**Purpose**: Enable/disable a feature flag for the company

**Input**:
```typescript
{
  companyId: string;
  featureName: string;
  enabled: boolean;
  toggledBy: string;
}
```

**Validation**:
- `featureName` must be a valid feature
- Feature must be available in company's bundle
- Toggler must have `system.company.manage` or be owner

**Flow**:
1. Verify toggler has permission
2. Load company via `CompanyRepository.findById()`
3. Get company's bundle via `getBundleById(company.bundleId)`
4. Verify feature is in bundle's features
5. If `enabled = true`, add to `company.features`
6. If `enabled = false`, remove from `company.features`
7. Save via `CompanyRepository.save()`
8. Return updated feature list

**Errors**:
- `FeatureNotFound` - Feature doesn't exist
- `FeatureNotInBundle` - Feature not allowed by bundle
- `PermissionDenied` - Toggler lacks permission

**Output**:
```typescript
{
  companyId: string;
  featureName: string;
  enabled: boolean;
  activeFeatures: string[];
  toggledAt: Date;
}
```

---

## SECTION 4 — REPOSITORY INTERFACE BLUEPRINT

### ICompanyAdminRepository

**Purpose**: Aggregate interface for company admin operations (optional wrapper)

```typescript
export interface ICompanyAdminRepository {
  // Profile
  updateProfile(companyId: string, updates: Partial<Company>): Promise<Company>;
  
  // Users
  getCompanyUsers(companyId: string): Promise<CompanyUser[]>;
  inviteUser(companyId: string, invitation: UserInvitation): Promise<Invitation>;
  updateUserRole(companyId: string, userId: string, roleId: string): Promise<CompanyUser>;
  disableUser(companyId: string, userId: string): Promise<void>;
  enableUser(companyId: string, userId: string): Promise<void>;
  
  // Roles
  getRoles(companyId: string): Promise<CompanyRole[]>;
  createRole(role: CompanyRole): Promise<CompanyRole>;
  updateRole(companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<CompanyRole>;
  deleteRole(companyId: string, roleId: string): Promise<void>;
  
  // Modules
  getAvailableModules(bundleId: string): Promise<string[]>;
  enableModule(companyId: string, moduleName: string): Promise<void>;
  disableModule(companyId: string, moduleName: string): Promise<void>;
  
  // Bundle
  upgradeBundle(companyId: string, bundleId: string): Promise<Company>;
  
  // Features
  getAvailableFeatures(bundleId: string): Promise<string[]>;
  toggleFeature(companyId: string, featureName: string, enabled: boolean): Promise<void>;
}
```

### Extensions to Existing Repositories

#### ICompanyRepository (add if missing)
```typescript
export interface ICompanyRepository {
  // Existing methods...
  findById(id: string): Promise<Company | null>;
  save(company: Company): Promise<void>;
  
  // NEW: Add if not present
  update(id: string, updates: Partial<Company>): Promise<Company>;
  enableModule(companyId: string, moduleName: string): Promise<void>;
  disableModule(companyId: string, moduleName: string): Promise<void>;
}
```

#### IRbacCompanyUserRepository (verify exists)
```typescript
export interface IRbacCompanyUserRepository {
  getByUserAndCompany(userId: string, companyId: string): Promise<CompanyUser | null>;
  getByCompany(companyId: string): Promise<CompanyUser[]>;
  create(membership: CompanyUser): Promise<void>;
  update(userId: string, companyId: string, updates: Partial<CompanyUser>): Promise<void>;
  delete(userId: string, companyId: string): Promise<void>;
}
```

#### ICompanyRoleRepository (verify exists)
```typescript
export interface ICompanyRoleRepository {
  getAll(companyId: string): Promise<CompanyRole[]>;
  getById(companyId: string, roleId: string): Promise<CompanyRole | null>;
  create(role: CompanyRole): Promise<void>;
  update(companyId: string, roleId: string, updates: Partial<CompanyRole>): Promise<void>;
  delete(companyId: string, roleId: string): Promise<void>;
}
```

### Firestore Implementation Notes

**Collections**:
- `companies/{companyId}` - Company documents
- `companies/{companyId}/users/{userId}` - Company user memberships (subcollection)
- `companies/{companyId}/roles/{roleId}` - Company roles (subcollection)

**Transactions**:
- Bundle upgrades should use Firestore transactions
- Role updates affecting multiple users should use batch writes

### SQL Implementation Notes

**Tables**:
- `companies` - Company profiles
- `company_users` - User-company memberships
- `company_roles` - Company-specific roles
- `company_role_permissions` - Role-permission mappings

**Constraints**:
- Foreign keys on `company_users.company_id` → `companies.id`
- Foreign keys on `company_users.role_id` → `company_roles.id`
- Unique constraint on `(company_id, user_id)` in `company_users`
- Unique constraint on `(company_id, name)` in `company_roles`

---

## SECTION 5 — TENANT ROUTER WIRING

### Integration into tenant.router.ts

```typescript
/**
 * tenant.router.ts
 */

import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { tenantContextMiddleware } from '../middlewares/tenantContextMiddleware';
import { ModuleRegistry } from '../../application/platform/ModuleRegistry';
import { companyModuleGuard } from '../middlewares/guards/companyModuleGuard';
import { permissionGuard } from '../middlewares/guards/permissionGuard';
import { ownerOrPermissionGuard } from '../middlewares/guards/ownerOrPermissionGuard'; // NEW

// Import company admin routes
import companyAdminRouter from '../routes/company-admin.routes';

// Legacy routes
import rbacRoutes from '../routes/system.rbac.routes';
import companyModuleSettingsRoutes from '../routes/company.moduleSettings.routes';

const router = Router();

// Apply Auth & Tenant Context Middleware
router.use(authMiddleware);
router.use(tenantContextMiddleware);

// Mount Company Admin Routes
// Owner bypass: If user.isOwner === true, skip permission check
router.use(
  '/company-admin',
  ownerOrPermissionGuard('system.company.manage'),
  companyAdminRouter
);

// Dynamically mount module routes from registry
const registry = ModuleRegistry.getInstance();
const modules = registry.getAllModules();

for (const module of modules) {
  const moduleRouter = module.getRouter();
  router.use(`/${module.metadata.id}`, companyModuleGuard(module.metadata.id), moduleRouter);
  console.log(`Mounted module: ${module.metadata.id} at /${module.metadata.id}`);
}

router.use('/rbac', rbacRoutes);
router.use(companyModuleSettingsRoutes);

export default router;
```

### New Middleware: ownerOrPermissionGuard

**File**: `backend/src/api/middlewares/guards/ownerOrPermissionGuard.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

/**
 * Middleware that allows access if user is owner OR has specific permission
 */
export function ownerOrPermissionGuard(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    // Check if user is owner
    const user = (req as any).user;
    if (user && user.isOwner) {
      return next(); // Owner bypasses permission check
    }

    // Check if user has the required permission
    if (!context.permissions.includes(requiredPermission)) {
      return next(ApiError.forbidden(`Permission denied: ${requiredPermission}`));
    }

    next();
  };
}
```

---

## SECTION 6 — FRONTEND INTEGRATION CONTRACT

### API Request/Response Formats

#### 1. Get Company Profile

**Request**:
```http
GET /api/v1/tenant/company-admin/profile
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companyId": "C1",
    "name": "Acme Corp",
    "country": "US",
    "baseCurrency": "USD",
    "fiscalYearStart": 1,
    "fiscalYearEnd": 12,
    "logoUrl": "https://...",
    "contactInfo": {
      "email": "admin@acme.com",
      "phone": "+1234567890",
      "address": "123 Main St"
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-12-04T10:00:00Z"
  }
}
```

#### 2. Update Company Profile

**Request**:
```http
POST /api/v1/tenant/company-admin/profile/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Acme Corporation",
  "country": "US",
  "baseCurrency": "USD",
  "contactInfo": {
    "email": "info@acme.com",
    "phone": "+1234567890"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companyId": "C1",
    "name": "Acme Corporation",
    "country": "US",
    "baseCurrency": "USD",
    "updatedAt": "2024-12-04T10:05:00Z"
  }
}
```

#### 3. List Company Users

**Request**:
```http
GET /api/v1/tenant/company-admin/users
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "userId": "U1",
      "email": "john@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "roleId": "R1",
      "roleName": "Admin",
      "isOwner": true,
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00Z"
    },
    {
      "userId": "U2",
      "email": "jane@acme.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "roleId": "R2",
      "roleName": "Accountant",
      "isOwner": false,
      "status": "active",
      "joinedAt": "2024-02-15T00:00:00Z"
    }
  ]
}
```

#### 4. Invite User

**Request**:
```http
POST /api/v1/tenant/company-admin/users/invite
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "newuser@acme.com",
  "roleId": "R2",
  "firstName": "Alice",
  "lastName": "Johnson"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "invitationId": "INV123",
    "email": "newuser@acme.com",
    "roleId": "R2",
    "status": "pending",
    "invitedAt": "2024-12-04T10:10:00Z",
    "expiresAt": "2024-12-11T10:10:00Z"
  }
}
```

#### 5. Update User Role

**Request**:
```http
POST /api/v1/tenant/company-admin/users/U2/update-role
Authorization: Bearer <token>
Content-Type: application/json

{
  "roleId": "R3"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "userId": "U2",
    "companyId": "C1",
    "roleId": "R3",
    "roleName": "Manager",
    "updatedAt": "2024-12-04T10:15:00Z"
  }
}
```

#### 6. List Company Roles

**Request**:
```http
GET /api/v1/tenant/company-admin/roles
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "roleId": "R1",
      "name": "Owner",
      "description": "Company owner with full access",
      "permissions": ["*"],
      "isSystem": true,
      "userCount": 1
    },
    {
      "roleId": "R2",
      "name": "Accountant",
      "description": "Accounting module access",
      "permissions": ["accounting.voucher.view", "accounting.voucher.create"],
      "isSystem": false,
      "userCount": 3
    }
  ]
}
```

#### 7. Create Role

**Request**:
```http
POST /api/v1/tenant/company-admin/roles/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Sales Manager",
  "description": "Manages sales operations",
  "permissions": [
    "accounting.voucher.view",
    "inventory.items.view",
    "inventory.items.create"
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "roleId": "R4",
    "companyId": "C1",
    "name": "Sales Manager",
    "description": "Manages sales operations",
    "permissions": ["accounting.voucher.view", "inventory.items.view", "inventory.items.create"],
    "resolvedPermissions": ["accounting.voucher.view", "inventory.items.view", "inventory.items.create"],
    "createdAt": "2024-12-04T10:20:00Z"
  }
}
```

#### 8. List Modules

**Request**:
```http
GET /api/v1/tenant/company-admin/modules
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "currentBundle": "professional",
    "availableModules": [
      {
        "id": "accounting",
        "name": "Accounting",
        "description": "Financial accounting module",
        "enabled": true,
        "mandatory": true
      },
      {
        "id": "inventory",
        "name": "Inventory",
        "description": "Inventory management",
        "enabled": true,
        "mandatory": false
      },
      {
        "id": "hr",
        "name": "Human Resources",
        "description": "HR and payroll",
        "enabled": false,
        "mandatory": false
      }
    ]
  }
}
```

#### 9. Enable Module

**Request**:
```http
POST /api/v1/tenant/company-admin/modules/enable
Authorization: Bearer <token>
Content-Type: application/json

{
  "moduleName": "hr"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companyId": "C1",
    "moduleName": "hr",
    "enabled": true,
    "activeModules": ["accounting", "inventory", "hr"],
    "enabledAt": "2024-12-04T10:25:00Z"
  }
}
```

#### 10. Get Current Bundle

**Request**:
```http
GET /api/v1/tenant/company-admin/bundle
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "bundleId": "professional",
    "name": "Professional",
    "tier": 2,
    "modules": ["accounting", "inventory", "hr"],
    "features": ["multiCurrency", "advancedReporting"],
    "pricing": {
      "monthly": 99,
      "annual": 999
    }
  }
}
```

#### 11. Upgrade Bundle

**Request**:
```http
POST /api/v1/tenant/company-admin/bundle/upgrade
Authorization: Bearer <token>
Content-Type: application/json

{
  "bundleId": "enterprise"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companyId": "C1",
    "bundleId": "enterprise",
    "bundleName": "Enterprise",
    "modules": ["accounting", "inventory", "hr", "pos", "manufacturing"],
    "features": ["multiCurrency", "advancedReporting", "apiAccess", "customWorkflows"],
    "upgradedAt": "2024-12-04T10:30:00Z"
  }
}
```

#### 12. List Features

**Request**:
```http
GET /api/v1/tenant/company-admin/features
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "currentBundle": "professional",
    "availableFeatures": [
      {
        "id": "multiCurrency",
        "name": "Multi-Currency",
        "description": "Support for multiple currencies",
        "enabled": true
      },
      {
        "id": "advancedReporting",
        "name": "Advanced Reporting",
        "description": "Custom reports and analytics",
        "enabled": true
      },
      {
        "id": "apiAccess",
        "name": "API Access",
        "description": "REST API for integrations",
        "enabled": false,
        "requiresBundle": "enterprise"
      }
    ]
  }
}
```

#### 13. Toggle Feature

**Request**:
```http
POST /api/v1/tenant/company-admin/features/toggle
Authorization: Bearer <token>
Content-Type: application/json

{
  "featureName": "multiCurrency",
  "enabled": false
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "companyId": "C1",
    "featureName": "multiCurrency",
    "enabled": false,
    "activeFeatures": ["advancedReporting"],
    "toggledAt": "2024-12-04T10:35:00Z"
  }
}
```

### Error Response Format

All errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action",
    "details": {
      "requiredPermission": "system.company.manage",
      "userPermissions": ["accounting.voucher.view"]
    }
  }
}
```

### Tenant Context Updates

After bundle upgrade or feature toggle, the frontend should:
1. Refresh the tenant context
2. Update the navigation menu (show/hide modules)
3. Update feature flags in the app state
4. Optionally redirect to new module if just enabled

**Example Context Refresh**:
```typescript
// After bundle upgrade
const response = await api.post('/company-admin/bundle/upgrade', { bundleId: 'enterprise' });
if (response.success) {
  // Refresh tenant context
  const newContext = await api.get('/tenant/context');
  updateAppContext(newContext.data);
  
  // Update UI
  showNotification('Bundle upgraded successfully!');
  refreshNavigation();
}
```

---

## SECTION 7 — TESTING BLUEPRINT

### Unit Tests

#### Use Case Tests

**File**: `backend/tests/unit/company-admin/UpdateCompanyProfileUseCase.test.ts`

```typescript
describe('UpdateCompanyProfileUseCase', () => {
  it('should update company profile successfully', async () => {
    // Arrange
    const mockRepo = createMockCompanyRepository();
    const useCase = new UpdateCompanyProfileUseCase(mockRepo);
    
    // Act
    const result = await useCase.execute({
      companyId: 'C1',
      userId: 'U1',
      updates: { name: 'New Name' }
    });
    
    // Assert
    expect(result.name).toBe('New Name');
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
  });

  it('should throw error if user lacks permission', async () => {
    // Test permission denial
  });

  it('should validate currency codes', async () => {
    // Test invalid currency
  });
});
```

**Test all 11 use cases** with similar structure:
- Happy path
- Permission denied
- Validation errors
- Not found errors
- Business rule violations

#### Controller Tests

**File**: `backend/tests/unit/company-admin/CompanyProfileController.test.ts`

```typescript
describe('CompanyProfileController', () => {
  it('should return company profile', async () => {
    // Test GET /profile
  });

  it('should update company profile', async () => {
    // Test POST /profile/update
  });

  it('should handle errors gracefully', async () => {
    // Test error handling
  });
});
```

### Integration Tests

#### Route Tests

**File**: `backend/tests/integration/company-admin.routes.test.ts`

```typescript
describe('Company Admin Routes', () => {
  describe('Profile Management', () => {
    it('GET /company-admin/profile should return profile', async () => {
      const response = await request(app)
        .get('/api/v1/tenant/company-admin/profile')
        .set('Authorization', `Bearer ${ownerToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.companyId).toBeDefined();
    });

    it('POST /company-admin/profile/update should update profile', async () => {
      const response = await request(app)
        .post('/api/v1/tenant/company-admin/profile/update')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Updated Name' });
      
      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Name');
    });
  });

  describe('User Management', () => {
    it('should list company users', async () => {
      // Test GET /users
    });

    it('should invite new user', async () => {
      // Test POST /users/invite
    });

    it('should update user role', async () => {
      // Test POST /users/:userId/update-role
    });
  });

  // Test all other route groups...
});
```

### Multi-Tenant Protection Tests

**File**: `backend/tests/integration/multi-tenant-isolation.test.ts`

```typescript
describe('Multi-Tenant Isolation', () => {
  it('should prevent cross-company profile access', async () => {
    // User from Company A tries to access Company B profile
    const response = await request(app)
      .get('/api/v1/tenant/company-admin/profile')
      .set('Authorization', `Bearer ${companyAUserToken}`)
      .set('X-Company-ID', 'CompanyB'); // Attempt to override
    
    expect(response.status).toBe(403);
  });

  it('should prevent cross-company user management', async () => {
    // User from Company A tries to invite user to Company B
  });

  it('should prevent cross-company role access', async () => {
    // User from Company A tries to view Company B roles
  });
});
```

### RBAC Tests

**File**: `backend/tests/integration/company-admin-rbac.test.ts`

```typescript
describe('Company Admin RBAC', () => {
  it('owner should have full access', async () => {
    // Test all endpoints with owner token
  });

  it('user with system.company.manage should have access', async () => {
    // Test all endpoints with admin token
  });

  it('user without permission should be denied', async () => {
    const response = await request(app)
      .post('/api/v1/tenant/company-admin/profile/update')
      .set('Authorization', `Bearer ${regularUserToken}`)
      .send({ name: 'Hacked' });
    
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('PERMISSION_DENIED');
  });

  it('should allow owner to bypass permission checks', async () => {
    // Owner should access even without explicit permission
  });
});
```

### Module Activation Tests

**File**: `backend/tests/integration/module-activation.test.ts`

```typescript
describe('Module Activation After Bundle Upgrade', () => {
  it('should enable new modules after bundle upgrade', async () => {
    // 1. Upgrade bundle
    const upgradeResponse = await request(app)
      .post('/api/v1/tenant/company-admin/bundle/upgrade')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ bundleId: 'professional' });
    
    expect(upgradeResponse.status).toBe(200);
    
    // 2. Verify new modules are accessible
    const moduleResponse = await request(app)
      .get('/api/v1/tenant/inventory/items')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(moduleResponse.status).toBe(200); // Should not be 403
  });

  it('should block access to disabled modules', async () => {
    // Disable module and verify 403
  });
});
```

### Feature Flag Tests

**File**: `backend/tests/integration/feature-flags.test.ts`

```typescript
describe('Feature Flags After Toggle', () => {
  it('should enable feature after toggle', async () => {
    // 1. Toggle feature on
    const toggleResponse = await request(app)
      .post('/api/v1/tenant/company-admin/features/toggle')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ featureName: 'multiCurrency', enabled: true });
    
    expect(toggleResponse.status).toBe(200);
    
    // 2. Verify feature is accessible
    const featureResponse = await request(app)
      .post('/api/v1/tenant/accounting/vouchers')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ currency: 'EUR' }); // Requires multiCurrency feature
    
    expect(featureResponse.status).toBe(200); // Should not be 403
  });

  it('should block feature after toggle off', async () => {
    // Toggle feature off and verify 403
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage for use cases
- **Integration Tests**: 80%+ coverage for routes
- **E2E Tests**: Critical user flows (invite user, upgrade bundle)

---

## SECTION 8 — EXECUTION ORDER

### Phase 1: Foundation (Days 1-2)

1. **Create Directory Structure**
   - Create `backend/src/api/controllers/company-admin/`
   - Create `backend/src/application/company-admin/use-cases/`
   - Create `backend/src/repository/interfaces/company-admin/`

2. **Create Repository Interfaces**
   - Create `ICompanyAdminRepository.ts`
   - Review and extend `ICompanyRepository` if needed
   - Review `IRbacCompanyUserRepository` and `ICompanyRoleRepository`

3. **Create Middleware**
   - Create `ownerOrPermissionGuard.ts`
   - Test middleware in isolation

### Phase 2: Use Cases (Days 3-5)

4. **Implement Profile Use Cases**
   - `UpdateCompanyProfileUseCase.ts`
   - Write unit tests

5. **Implement User Management Use Cases**
   - `InviteCompanyUserUseCase.ts`
   - `UpdateCompanyUserRoleUseCase.ts`
   - `DisableCompanyUserUseCase.ts`
   - Write unit tests

6. **Implement Role Management Use Cases**
   - `CreateCompanyRoleUseCase.ts`
   - `UpdateCompanyRoleUseCase.ts`
   - `DeleteCompanyRoleUseCase.ts`
   - Write unit tests

7. **Implement Module/Bundle/Feature Use Cases**
   - `EnableModuleForCompanyUseCase.ts`
   - `DisableModuleForCompanyUseCase.ts`
   - `UpgradeCompanyBundleUseCase.ts`
   - `ToggleFeatureFlagUseCase.ts`
   - Write unit tests

### Phase 3: Controllers (Days 6-7)

8. **Implement Controllers**
   - `CompanyProfileController.ts`
   - `CompanyUsersController.ts`
   - `CompanyRolesController.ts`
   - `CompanyModulesController.ts`
   - `CompanyBundleController.ts`
   - `CompanyFeaturesController.ts`
   - Write unit tests for each

### Phase 4: Routes (Day 8)

9. **Implement Routes**
   - Create `company-admin.routes.ts`
   - Wire all controllers
   - Apply middleware stack

10. **Wire into Tenant Router**
    - Update `tenant.router.ts`
    - Mount `/company-admin` routes
    - Apply `ownerOrPermissionGuard`

### Phase 5: Testing (Days 9-10)

11. **Integration Tests**
    - Test all routes end-to-end
    - Test multi-tenant isolation
    - Test RBAC enforcement

12. **Module Activation Tests**
    - Test bundle upgrade flow
    - Verify new modules become accessible
    - Verify `companyModuleGuard` respects changes

13. **Feature Flag Tests**
    - Test feature toggle flow
    - Verify `featureFlagGuard` respects changes
    - Test tenant context propagation

### Phase 6: Repository Implementation (Days 11-12)

14. **Firestore Implementation**
    - Implement `FirestoreCompanyAdminRepository`
    - Implement missing methods in existing repositories
    - Test with Firestore emulator

15. **SQL Implementation (Optional)**
    - Implement `PrismaCompanyAdminRepository`
    - Update Prisma schema if needed
    - Run migrations

### Phase 7: Validation & Polish (Days 13-14)

16. **End-to-End Testing**
    - Test complete user flows
    - Test error scenarios
    - Test edge cases

17. **Documentation**
    - Update API documentation
    - Create frontend integration guide
    - Document permission requirements

18. **Performance Testing**
    - Test with multiple companies
    - Test with large user lists
    - Optimize queries if needed

### Phase 8: Deployment (Day 15)

19. **Staging Deployment**
    - Deploy to staging environment
    - Run smoke tests
    - Verify database migrations

20. **Production Deployment**
    - Deploy to production
    - Monitor for errors
    - Verify all features working

---

## SUMMARY

This blueprint provides a complete implementation plan for the Company Admin Controls module:

- **6 Controllers** for different admin areas
- **11 Use Cases** covering all business logic
- **20+ Routes** for comprehensive admin functionality
- **3 Repository Interfaces** with clear contracts
- **Complete Testing Strategy** with unit, integration, and E2E tests
- **15-Day Implementation Timeline** with clear phases

**Key Features**:
✅ Owner bypass for all admin operations  
✅ Permission-based access control  
✅ Multi-tenant isolation  
✅ Bundle upgrade with automatic module activation  
✅ Feature flag toggles with real-time effect  
✅ Complete user and role management  

**Next Steps**:
1. Review and approve this blueprint
2. Begin Phase 1 implementation
3. Follow the execution order for systematic development

---

**End of Blueprint**
