import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';
import { useVoucherTypes, SidebarFormEntry } from './useVoucherTypes';
import { useTranslation } from 'react-i18next';

type SidebarItem = {
  label: string;
  path?: string;
  icon?: string;
  children?: SidebarItem[];
};

// Maps module IDs to their base route and permission prefix
const MODULE_ROUTE_MAP: Record<string, { baseRoute: string; permission: string; icon: string }> = {
  accounting: { baseRoute: '/accounting/vouchers', permission: 'accounting.vouchers.view', icon: 'File' },
  sales:      { baseRoute: '/sales',               permission: 'sales.view',               icon: 'File' },
  purchase:   { baseRoute: '/purchases',            permission: 'purchase.view',            icon: 'File' },
};

export const useSidebarConfig = () => {
  const { isSuperAdmin, moduleBundles, resolvedPermissions } = useCompanyAccess();
  const { hasPermission } = useRBAC();
  const { voucherTypes, allModuleForms } = useVoucherTypes();
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
    'Subgroup Tagging': 'sidebar.subgroupTagging',
    'Approval Center': 'sidebar.approvalCenter',
    Vouchers: 'sidebar.vouchers',
    Documents: 'sidebar.documents',
    'All Vouchers': 'sidebar.allVouchers',
    'Forms Designer': 'sidebar.formsDesigner',
    'Window Designer': 'sidebar.windowDesigner',
    'Trial Balance': 'sidebar.trialBalance',
    'Account Statement': 'sidebar.accountStatement',
    'Balance Sheet': 'sidebar.balanceSheet',
    'General Ledger': 'sidebar.generalLedger',
    'Profit & Loss': 'sidebar.profitLoss',
    'Trading Account': 'sidebar.tradingAccount',
    'Cash Flow': 'sidebar.cashFlow',
    'Journal': 'sidebar.journal',
    Aging: 'sidebar.aging',
    'Bank Reconciliation': 'sidebar.bankReconciliation',
    'Cost Center Summary': 'sidebar.costCenterSummary',
    'Budget vs Actual': 'sidebar.budgetVsActual',
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

  /**
   * Build dynamic form groups for a given module from allModuleForms.
   * Groups forms by their sidebarGroup. If sidebarGroup is null, they become top-level items.
   */
  const buildDynamicFormGroups = (moduleId: string): SidebarItem[] => {
    const moduleKey = moduleId.toUpperCase();
    const moduleForms = allModuleForms.filter(f => f.module === moduleKey && f.enabled);
    if (moduleForms.length === 0) return [];

    const routeConfig = MODULE_ROUTE_MAP[moduleId];
    if (!routeConfig) return [];

    // Group by sidebarGroup
    const groups = new Map<string, SidebarFormEntry[]>();
    const topLevel: SidebarFormEntry[] = [];

    moduleForms.forEach(form => {
      if (form.sidebarGroup) {
        if (!groups.has(form.sidebarGroup)) {
          groups.set(form.sidebarGroup, []);
        }
        groups.get(form.sidebarGroup)!.push(form);
      } else {
        topLevel.push(form);
      }
    });

    const result: SidebarItem[] = [];

    // Add grouped items as submenus
    groups.forEach((forms, groupName) => {
      const children: SidebarItem[] = [];

      // For accounting, add "All Vouchers" link at the top
      if (moduleId === 'accounting' && groupName === 'Vouchers') {
        children.push({
          label: translateLabel('All Vouchers'),
          path: '/accounting/vouchers',
          icon: 'FileSearch'
        });
      }

      forms.forEach(form => {
        children.push({
          label: form.name,
          path: moduleId === 'accounting' 
            ? `${routeConfig.baseRoute}?type=${form.id}`
            : `${routeConfig.baseRoute}/${form.code.replace(/_/g, '-')}`,
          icon: routeConfig.icon
        });
      });

      result.push({
        label: translateLabel(groupName),
        icon: groupName === 'Vouchers' ? 'FileText' : 'FolderOpen',
        children
      });
    });

    // Add top-level items (no submenu)
    topLevel.forEach(form => {
      result.push({
        label: form.name,
        path: moduleId === 'accounting'
          ? `${routeConfig.baseRoute}?type=${form.id}`
          : `${routeConfig.baseRoute}/${form.code.replace(/_/g, '-')}`,
        icon: routeConfig.icon
      });
    });

    return result;
  };

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
    const activeModules: string[] = Array.from(new Set([...mapped, 'tools']));

    activeModules.forEach((moduleId) => {
      const def = moduleMenuMap[moduleId] || {
        label: moduleId.charAt(0).toUpperCase() + moduleId.slice(1),
        icon: 'LayoutGrid',
        items: []
      };
      let items = def.items.filter((item) => hasPermission(item.permission));
      
      // === DYNAMIC FORM INJECTION ===
      // For modules with dynamic forms (accounting, sales, purchase),
      // inject form entries grouped by sidebarGroup
      
      const dynamicModuleId = moduleId === 'purchases' ? 'purchase' : moduleId;
      
      if (MODULE_ROUTE_MAP[dynamicModuleId]) {
        const dynamicGroups = buildDynamicFormGroups(dynamicModuleId);
        
        if (dynamicGroups.length > 0) {
          if (moduleId === 'accounting') {
            // ACCOUNTING: Remove hardcoded "Vouchers" and inject dynamic groups after COA
            items = items.filter(item => item.label !== 'Vouchers');
            
            const coaIndex = items.findIndex(item => item.label === 'Chart of Accounts');
            const insertIndex = coaIndex >= 0 ? coaIndex + 1 : 0;
            
            items = [
              ...items.slice(0, insertIndex),
              ...dynamicGroups as any[],
              { 
                label: translateLabel('Window Designer'), 
                path: '/accounting/window-config-test',
                permission: 'accounting.settings.manage',
                icon: 'DraftingCompass'
              },
              ...items.slice(insertIndex)
            ] as any;
          } else {
            // SALES / PURCHASE: Inject dynamic groups before Settings
            const settingsIndex = items.findIndex(item => item.label === 'Settings');
            const insertIndex = settingsIndex >= 0 ? settingsIndex : items.length;
            
            items = [
              ...items.slice(0, insertIndex),
              ...dynamicGroups as any[],
              ...items.slice(insertIndex)
            ] as any;
          }
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
  }, [hasPermission, isSuperAdmin, moduleBundles, resolvedPermissions, allModuleForms, voucherTypes, t]);

  return sidebarSections;
};
