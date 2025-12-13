import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';

type SidebarSection = {
  label: string;
  path?: string;
};

export const useSidebarConfig = () => {
  const { isSuperAdmin, moduleBundles, resolvedPermissions } = useCompanyAccess();
  const { hasPermission } = useRBAC();

  const sidebarSections = useMemo(() => {
    const sections: Record<string, SidebarSection[]> = {
      MODULES: [],
      COMPANY_ADMIN: [],
      SETTINGS: [],
    };

    // Super Admin items should NEVER appear in regular sidebar
    // Super admins use the SuperAdminShell with its own dedicated sidebar
    // If a super admin somehow ends up here, show them nothing to avoid confusion
    if (isSuperAdmin) {
      // Return empty sections - super admins should be in /super-admin/* routes with SuperAdminShell
      return {};
    }

    // 2. Company User View
    let cachedPerms: string[] = [];
    try {
      const rawPerms = localStorage.getItem('resolvedPermissions');
      if (rawPerms) cachedPerms = JSON.parse(rawPerms);
    } catch (e) {
      cachedPerms = [];
    }
    const effectivePermissions = resolvedPermissions.length ? resolvedPermissions : cachedPerms;
    const hasWildcard = effectivePermissions.includes('*');
    let persistedModules: string[] = [];
    try {
      const raw = localStorage.getItem('activeModules');
      if (raw) persistedModules = JSON.parse(raw);
    } catch (e) {
      persistedModules = [];
    }

    const bundleList =
      (window as any)?.activeModules ||
      (moduleBundles && moduleBundles.length ? moduleBundles : persistedModules.length ? persistedModules : hasWildcard ? Object.keys(moduleMenuMap) : []);

    const mapped = bundleList.flatMap((m: string) => {
      if (m === 'financial') return ['accounting'];
      return [m];
    });
    const activeModules: string[] = Array.from(new Set(mapped));

    // Build specific sections for each Module (App Name Grouping)
    activeModules.forEach((moduleId) => {
      const def = moduleMenuMap[moduleId] || {
        label: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
        items: []
      };
      const items = def.items.filter((item) => hasPermission(item.permission));
      
      if (items.length > 0) {
        // Create a new section for this App
        sections[def.label] = items.map(i => ({
          label: i.label,
          path: i.path
        }));
      }
    });

    // Remove the generic MODULES key if unused (or keep it empty)
    delete sections.MODULES;

    // Company Admin menu (Permission Gated or Module Check)
    if (activeModules.includes('companyAdmin') || hasPermission('manage_settings') || hasWildcard) {
      const companyAdminItems: SidebarSection[] = [
        { label: 'CA • Overview', path: '/company-admin/overview' },
        { label: 'CA • Users', path: '/company-admin/users' },
        { label: 'CA • Roles', path: '/company-admin/roles' },
        { label: 'CA • Modules', path: '/company-admin/modules' },
        { label: 'CA • Features', path: '/company-admin/features' },
        { label: 'CA • Bundles', path: '/company-admin/bundles' },
        { label: 'CA • Settings', path: '/company-admin/settings' }
      ];
      sections.COMPANY_ADMIN.push(...companyAdminItems);
    }

    return sections;
  }, [hasPermission, isSuperAdmin, moduleBundles, resolvedPermissions]);

  return sidebarSections;
};
