# Company Admin Frontend Integration - Complete Implementation

## Summary

This document contains the complete implementation of the Company Admin frontend integration with the backend API.

## Files Created

### 1. API Client
- **File**: `frontend/src/api/companyAdmin.ts`
- **Status**: ✅ Created
- **Features**:
  - Complete TypeScript types for all entities
  - All API endpoints implemented
  - Proper error handling
  - Uses global Axios client

### 2. React Query Hooks
- **File**: `frontend/src/hooks/useCompanyAdmin.ts`
- **Status**: ✅ Created
- **Features**:
  - `useCompanyProfile()` - Profile management
  - `useCompanyUsers()` - User management with invite/disable/enable
  - `useCompanyRoles()` - Role CRUD operations
  - `useCompanyRole(id)` - Single role fetching
  - `useCompanyModules()` - Module management
  - `useCompanyBundles()` - Bundle management
  - `useCompanyFeatures()` - Feature toggle management
  - Proper caching with React Query
  - Toast notifications on success/error
  - Loading states for all mutations

### 3. Pages Updated
- **OverviewPage.tsx**: ✅ Updated with real data
- **RolesPage.tsx**: ✅ Updated with search and delete
- **CreateRolePage.tsx**: ⏳ See below
- **EditRolePage.tsx**: ⏳ See below
- **ModulesPage.tsx**: ⏳ See below
- **BundlesPage.tsx**: ⏳ See below
- **FeaturesPage.tsx**: ⏳ See below
- **UsersPage.tsx**: ⏳ See below
- **SettingsPage.tsx**: ⏳ See below

## Remaining Page Implementations

Due to response length limitations, here are the implementations for the remaining pages:

---

### CreateRolePage.tsx

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRoles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const CreateRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { createRole, isCreating } = useCompanyRoles();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRole(formData, {
      onSuccess: () => {
        navigate('/company-admin/roles');
      }
    });
  };

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={t("companyAdmin.roles.createTitle")} 
        breadcrumbs={[
          { label: 'Company Admin' }, 
          { label: 'Roles', href: '/company-admin/roles' }, 
          { label: 'Create' }
        ]}
      />

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Finance Manager"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's responsibilities..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/company-admin/roles')}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Card>
    </CompanyAdminLayout>
  );
};

export default CreateRolePage;
```

---

### EditRolePage.tsx

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CompanyAdminLayout } from '../layout/CompanyAdminLayout';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useCompanyRole, useCompanyRoles } from '../../../hooks/useCompanyAdmin';

const t = (key: string) => key;

export const EditRolePage: React.FC = () => {
  const navigate = useNavigate();
  const { roleId } = useParams<{ roleId: string }>();
  const { data: role, isLoading } = useCompanyRole(roleId!);
  const { updateRole, isUpdating } = useCompanyRoles();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        permissions: role.permissions || [],
      });
    }
  }, [role]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleId) return;
    
    updateRole({ roleId, data: formData }, {
      onSuccess: () => {
        navigate('/company-admin/roles');
      }
    });
  };

  if (isLoading) {
    return (
      <CompanyAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </CompanyAdminLayout>
    );
  }

  if (!role) {
    return (
      <CompanyAdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Role not found</p>
          <Button onClick={() => navigate('/company-admin/roles')} className="mt-4">
            Back to Roles
          </Button>
        </div>
      </CompanyAdminLayout>
    );
  }

  return (
    <CompanyAdminLayout>
      <PageHeader 
        title={`Edit ${role.name}`} 
        breadcrumbs={[
          { label: 'Company Admin' }, 
          { label: 'Roles', href: '/company-admin/roles' }, 
          { label: 'Edit' }
        ]}
      />

      {role.isSystem && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ This is a system role. Some fields cannot be modified.
          </p>
        </div>
      )}

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role Name *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Finance Manager"
              required
              disabled={role.isSystem}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role's responsibilities..."
              disabled={role.isSystem}
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/company-admin/roles')}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating || role.isSystem}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Card>
    </CompanyAdminLayout>
  );
};

export default EditRolePage;
```

---

## Installation Instructions

1. **Install Dependencies** (if not already installed):
```bash
cd frontend
npm install @tanstack/react-query react-hot-toast
```

2. **Ensure QueryClient is set up** in your main App component:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" />
      {/* Your app routes */}
    </QueryClientProvider>
  );
}
```

3. **Test the integration**:
- Navigate to `/company-admin/overview`
- Verify data loads from backend
- Test CRUD operations

## Notes

1. **Error Handling**: All API errors are caught and displayed via toast notifications
2. **Loading States**: Every operation shows appropriate loading indicators
3. **Type Safety**: Full TypeScript coverage with proper types
4. **Caching**: React Query handles caching with 5-minute stale time for most queries
5. **Optimistic Updates**: Some mutations invalidate queries to refetch fresh data

## Next Steps

The remaining pages (ModulesPage, BundlesPage, FeaturesPage, UsersPage, SettingsPage) follow the same pattern. Would you like me to generate those as well?
