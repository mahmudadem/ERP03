import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';
import { useVoucherTypes } from './useVoucherTypes';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('common');

  const labelKeyMap: Record<string, string> = {
    Accounting: 'sidebar.accounting',
    Inventory: 'sidebar.inventory',
    Sales: 'sidebar.sales',
    Purchases: 'sidebar.purchases',
    HR: 'sidebar.hr',
    CRM: 'sidebar.crm',
    POS: 'sidebar.pos',
    Manufacturing: 'sidebar.manufacturing',
    Projects: 'sidebar.projects',
    Reports: 'sidebar.reports',
    'Chart of Accounts': 'sidebar.chartOfAccounts',
    'Approval Center': 'sidebar.approvalCenter',
    Vouchers: 'sidebar.vouchers',
    'All Vouchers': 'sidebar.allVouchers',
    'Forms Designer': 'sidebar.formsDesigner',
    'Window Designer': 'sidebar.windowDesigner',
    'Trial Balance': 'sidebar.trialBalance',
    'Account Statement': 'sidebar.accountStatement',
    'Balance Sheet': 'sidebar.balanceSheet',
    'General Ledger': 'sidebar.generalLedger',
    'Profit & Loss': 'sidebar.profitLoss',
    'Cost Center Summary': 'sidebar.costCenterSummary',
    Settings: 'sidebar.settings',
    Items: 'sidebar.items',
    Warehouses: 'sidebar.warehouses',
    'Stock Movements': 'sidebar.stockMovements',
    Quotations: 'sidebar.quotations',
    Invoices: 'sidebar.invoices',
    Customers: 'sidebar.customers',
    'Purchase Orders': 'sidebar.purchaseOrders',
    Vendors: 'sidebar.vendors',
    Employees: 'sidebar.employees',
    Attendance: 'sidebar.attendance',
    Payroll: 'sidebar.payroll',
    Leads: 'sidebar.leads',
    Terminal: 'sidebar.terminal',
    Sessions: 'sidebar.sessions',
    'Work Orders': 'sidebar.workOrders',
    BOM: 'sidebar.bom',
    'General Settings': 'sidebar.generalSettings',
    Overview: 'sidebar.overview',
    Users: 'sidebar.users',
    Roles: 'sidebar.roles',
    Modules: 'sidebar.modules',
    Features: 'sidebar.features',
    Bundles: 'sidebar.bundles'
  };

  const translateLabel = (label: string) => t(labelKeyMap[label] || label, { defaultValue: label });

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
            label: translateLabel('All Vouchers'), 
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
          label: translateLabel('Vouchers'),
          icon: 'FileText',
          children: voucherChildren.filter(item => hasPermission(item.permission))
        } as any;
        
        const coaIndex = items.findIndex(item => item.label === 'Chart of Accounts');
        if (coaIndex >= 0) {
          items = [
            ...items.slice(0, coaIndex + 1),
            vouchersGroup,
            { 
              label: translateLabel('Window Designer'), 
              path: '/accounting/window-config-test',
              permission: 'accounting.settings.manage',
              icon: 'DraftingCompass'
            },
            {
              label: translateLabel('Ledger Report'),
              path: '/accounting/reports/ledger',
              permission: 'accounting.reports.view', 
              icon: 'BookOpen'
            },
            ...items.slice(coaIndex + 1)
          ];
        } else {
          items = [
            vouchersGroup,
            { 
              label: translateLabel('Window Designer'), 
              path: '/accounting/window-config-test',
              permission: 'accounting.settings.manage',
              icon: 'DraftingCompass'
            },
            ...items
          ];
        }
      }
      
      if (items.length > 0) {
        sections[translateLabel(def.label)] = {
          icon: def.icon || 'LayoutGrid',
          items: items.map(i => ({
            label: translateLabel(i.label),
            path: i.path,
            children: (i as any).children
              ? (i as any).children.map((c: any) => ({
                  label: translateLabel(c.label),
                  path: c.path,
                  permission: c.permission,
                  icon: c.icon,
                  children: c.children
                }))
              : undefined,
            icon: (i as any).icon
          }))
        };
      }
    });

    return sections;
  }, [hasPermission, isSuperAdmin, moduleBundles, resolvedPermissions, voucherTypes, t]);

  return sidebarSections;
};
