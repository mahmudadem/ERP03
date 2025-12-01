
import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';

type SidebarSection = {
  label: string;
  icon?: string;
  path?: string;
  children?: Array<{ label: string; path: string }>;
};

export const useSidebarConfig = () => {
  const { isSuperAdmin, moduleBundles, resolvedPermissions } = useCompanyAccess();
  const { hasPermission } = useRBAC();

  const sidebarSections = useMemo(() => {
    const sections: Record<string, SidebarSection[]> = {
      MODULES: [],
      SETTINGS: [],
      SUPER_ADMIN: []
    };

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

    const mapped = bundleList.flatMap((m) => {
      if (m === 'financial') return ['accounting'];
      return [m];
    });
    const activeModules: string[] = Array.from(new Set(mapped));

    activeModules.forEach((moduleId) => {
      const def = moduleMenuMap[moduleId] || {
        label: moduleId,
        icon: 'Package',
        items: []
      };
      const items = def.items.filter((item) => hasPermission(item.permission));
      if (items.length > 0) {
        sections.MODULES.push({
          label: def.label,
          icon: def.icon,
          children: items.map((i) => ({ label: i.label, path: i.path }))
        });
      }
    });

    if (isSuperAdmin) {
      sections.SUPER_ADMIN.push({
        label: 'Super Admin',
        path: '/super-admin/overview'
      });
    }

    return sections;
  }, [hasPermission, isSuperAdmin, moduleBundles, resolvedPermissions]);

  return sidebarSections;
};
