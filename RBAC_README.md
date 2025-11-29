# RBAC (Role-Based Access Control) Implementation

## Overview

This project now includes a complete RBAC system that supports:

- **SUPER_ADMIN** global role (system-level)
- **Dynamic Company Roles** per company
- **System Role Templates** as blueprints
- **Permissions** as a fixed system-wide dictionary
- **CompanyUser** membership linking users to companies with roles
- Permission checking in use cases (domain/application layer)
- Firestore infrastructure implementation
- Frontend integration with React + route guards

---

## Backend Structure

### Domain Entities (`backend/src/domain/rbac/`)

- **Permission.ts**: System-wide permission definition
- **SystemRoleTemplate.ts**: Reusable role templates
- **CompanyRole.ts**: Company-specific roles
- **CompanyUser.ts**: User-company-role association

### Repository Interfaces (`backend/src/repository/interfaces/rbac/`)

- **IPermissionRepository.ts**
- **ISystemRoleTemplateRepository.ts**
- **ICompanyRoleRepository.ts**
- **ICompanyUserRepository.ts**

### Use Cases (`backend/src/application/rbac/use-cases/`)

- **CreateCompanyRoleUseCase**: Create new company role
- **UpdateCompanyRoleUseCase**: Update existing role
- **DeleteCompanyRoleUseCase**: Delete role (with in-use check)
- **AssignRoleToCompanyUserUseCase**: Assign role to user
- **ListCompanyRolesUseCase**: List all company roles
- **ListCompanyUsersWithRolesUseCase**: List users with their roles
- **GetCurrentUserPermissionsForCompanyUseCase**: Get user's effective permissions

### Permission Checker (`backend/src/application/rbac/PermissionChecker.ts`)

Generic service for permission validation:
```typescript
await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
```

### Firestore Implementation (`backend/src/infrastructure/firestore/repositories/rbac/`)

- **FirestorePermissionRepository**
- **FirestoreSystemRoleTemplateRepository**
- **FirestoreCompanyRoleRepository**
- **FirestoreCompanyUserRepository**

**Firestore Structure:**
```
permissions (collection)
system_role_templates (collection)
companies/{companyId}/roles/{roleId}
companies/{companyId}/users/{uid}
```

### API Routes (`backend/src/api/routes/system.rbac.routes.ts`)

```
GET    /api/v1/rbac/permissions
GET    /api/v1/rbac/system-role-templates
GET    /api/v1/rbac/current-user-permissions?companyId=X
GET    /api/v1/rbac/companies/:companyId/roles
POST   /api/v1/rbac/companies/:companyId/roles
PATCH  /api/v1/rbac/companies/:companyId/roles/:roleId
DELETE /api/v1/rbac/companies/:companyId/roles/:roleId
GET    /api/v1/rbac/companies/:companyId/users
POST   /api/v1/rbac/companies/:companyId/users/:uid/assign-role
```

---

## Frontend Structure

### API Client (`frontend/src/api/rbac/index.ts`)

Provides typed API methods for all RBAC operations.

### Context (`frontend/src/context/CompanyAccessContext.tsx`)

Global state management for:
- Current company ID
- User's permissions for that company
- Super admin status
- Loading state

### Components

**RequirePermission** (`frontend/src/components/auth/RequirePermission.tsx`):
```tsx
<RequirePermission permission="accounting.vouchers.create">
  <CreateButton />
</RequirePermission>
```

**ProtectedRoute** (`frontend/src/components/auth/ProtectedRoute.tsx`):
Wraps routes to enforce permission requirements.

### Pages (`frontend/src/modules/settings/rbac/`)

- **RolesListPage.tsx**: List all company roles
- **EditRolePage.tsx**: Create/edit roles with permission selection
- **AssignUsersRolesPage.tsx**: Assign roles to users

### Routes

All routes in `routes.config.ts` now support `requiredPermission`:
```typescript
{
  path: '/accounting/vouchers',
  component: VouchersListPage,
  requiredPermission: 'accounting.vouchers.view'
}
```

---

## Permission Dictionary

### Accounting
- `accounting.vouchers.create`
- `accounting.vouchers.view`
- `accounting.vouchers.edit`
- `accounting.vouchers.approve`
- `accounting.vouchers.lock`
- `accounting.vouchers.cancel`
- `accounting.reports.trialBalance.view`
- `accounting.accounts.create`

### Inventory
- `inventory.items.manage`
- `inventory.warehouses.manage`
- `inventory.stock.view`

### Designer
- `designer.vouchers.modify`
- `designer.forms.modify`

### System
- `system.company.settings.manage`
- `system.roles.manage`
- `system.users.manage`

### HR
- `hr.employees.manage`
- `hr.payroll.manage`

---

## Setup Instructions

### 1. Seed Initial Data

Run the seed script to populate permissions and role templates:

```bash
cd backend
npx ts-node src/infrastructure/firestore/seeds/seedRbacData.ts
```

### 2. Create Company Roles

Use the UI at `/settings/rbac/roles` or the API to create company-specific roles.

### 3. Assign Users to Roles

Navigate to `/settings/rbac/users` to assign roles to company users.

---

## Usage Examples

### Backend: Enforce Permission in Use Case

```typescript
export class CreateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(data: { userId: string; companyId: string; ... }) {
    await this.permissionChecker.assertOrThrow(
      data.userId,
      data.companyId,
      'accounting.vouchers.create'
    );
    
    // ... proceed with voucher creation
  }
}
```

### Frontend: Conditional Rendering

```tsx
import { RequirePermission } from '@/components/auth/RequirePermission';

function VoucherActions() {
  return (
    <div>
      <RequirePermission permission="accounting.vouchers.edit">
        <button>Edit</button>
      </RequirePermission>
      
      <RequirePermission permission="accounting.vouchers.approve">
        <button>Approve</button>
      </RequirePermission>
    </div>
  );
}
```

### Frontend: Route Protection

Routes are automatically protected based on `requiredPermission` in `routes.config.ts`.

---

## Special Cases

### SUPER_ADMIN

Users with `role: 'SUPER_ADMIN'` in the `User` entity automatically receive `['*']` permissions, granting full access.

### Company Owners

Users with `isOwner: true` in `CompanyUser` also receive `['*']` permissions for that company.

### No Permission Required

Routes without `requiredPermission` are accessible to all authenticated users.

---

## Architecture Compliance

✅ **Clean Architecture**: Domain entities are pure, use cases orchestrate logic, infrastructure handles persistence.

✅ **No Breaking Changes**: Existing voucher engine, inventory, designer, and core modules remain untouched.

✅ **Firestore Conventions**: Follows existing repository patterns and collection structure.

✅ **Type Safety**: Full TypeScript coverage across backend and frontend.

---

## Testing Checklist

- [ ] SUPER_ADMIN can access all routes
- [ ] Company owners can manage roles
- [ ] Users without permissions see 403 Forbidden
- [ ] Voucher creation requires `accounting.vouchers.create`
- [ ] Inventory management requires `inventory.items.manage`
- [ ] Designer requires `designer.vouchers.modify`
- [ ] Role deletion blocked if role is in use
- [ ] Permission changes reflect immediately after refresh

---

## Future Enhancements

- **Audit Logging**: Track permission changes
- **Dynamic Permissions**: Allow custom permissions per company
- **Permission Groups**: Organize permissions into logical groups
- **Time-based Access**: Temporary role assignments
- **Multi-factor for Sensitive Actions**: Require additional verification for critical permissions

---

## Support

For questions or issues with the RBAC system, refer to:
- Backend: `backend/src/application/rbac/`
- Frontend: `frontend/src/modules/settings/rbac/`
- API Docs: See route definitions in `system.rbac.routes.ts`
