import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';
import { useVoucherTypes } from './useVoucherTypes';

type SidebarItem = {
  label: string;
  path?: string;
  icon?: string;
  children?: SidebarItem[];
};

export const useSidebarConfig = () => {
  const { isSuperAdmin, moduleBundles, resolvedPermissions } = useCompanyAccess();
  const { hasPermission } = useRBAC();
  const { voucherTypes } = useVoucherTypes();

  const sidebarSections = useMemo(() => {
    const sections: Record<string, { icon: string; items: SidebarItem[] }> = {};

    if (isSuperAdmin) {
      return {};
    }

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

    activeModules.forEach((moduleId) => {
      const def = moduleMenuMap[moduleId] || {
        label: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
        icon: 'LayoutGrid',
        items: []
      };
      let items = def.items.filter((item) => hasPermission(item.permission));
      
      if (moduleId === 'accounting') {
        items = items.filter(item => item.label !== 'Vouchers');
        
        const voucherChildren = [
          { 
            label: 'All Vouchers', 
            path: '/accounting/vouchers', 
            permission: 'accounting.vouchers.view',
            icon: 'FileSearch'
          },
          ...voucherTypes
            .filter(vt => vt.enabled !== false)
            .map(vt => ({
              label: vt.name,
              path: `/accounting/vouchers?type=${vt.id}`,
              permission: 'accounting.vouchers.view',
              icon: 'File'
            }))
        ];
        
        const vouchersGroup = {
          label: 'Vouchers',
          icon: 'FileText',
          children: voucherChildren.filter(item => hasPermission(item.permission))
        } as any;
        
        const coaIndex = items.findIndex(item => item.label === 'Chart of Accounts');
        if (coaIndex >= 0) {
          items = [
            ...items.slice(0, coaIndex + 1),
            vouchersGroup,
            { 
              label: 'Window Designer', 
              path: '/accounting/window-config-test',
              permission: 'accounting.settings.manage',
              icon: 'DraftingCompass'
            },
            ...items.slice(coaIndex + 1)
          ];
        } else {
          items = [
            vouchersGroup,
            { 
              label: 'Window Designer', 
              path: '/accounting/window-config-test',
              permission: 'accounting.settings.manage',
              icon: 'DraftingCompass'
            },
            ...items
          ];
        }
      }
      
      if (items.length > 0) {
        sections[def.label] = {
          icon: def.icon || 'LayoutGrid',
          items: items.map(i => ({
            label: i.label,
            path: i.path,
            children: (i as any).children,
            icon: (i as any).icon
          }))
        };
      }
    });

    return sections;
  }, [hasPermission, isSuperAdmin, moduleBundles, resolvedPermissions, voucherTypes]);

  return sidebarSections;
};
