
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
  const { isSuperAdmin, moduleBundles } = useCompanyAccess();
  const { hasPermission } = useRBAC();

  const sidebarSections = useMemo(() => {
    const sections: Record<string, SidebarSection[]> = {
      MODULES: [],
      SETTINGS: [],
      SUPER_ADMIN: []
    };

    const activeModules: string[] = (window as any)?.activeModules || moduleBundles || [];

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
  }, [permissions, isSuperAdmin]);

  return sidebarSections;
};
