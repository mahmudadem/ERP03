import { useMemo } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { useRBAC } from '../api/rbac/useRBAC';
import { moduleMenuMap } from '../config/moduleMenuMap';
import { useDocumentPolicies } from './useDocumentPolicies';
import { useVoucherTypes, SidebarFormEntry } from './useVoucherTypes';
import { useTranslation } from 'react-i18next';
import {
  isOperationalPurchaseDocument,
  isOperationalSalesDocument,
} from '../utils/documentPolicy';

type SidebarItem = {
  label: string;
  path?: string;
  permission?: string;
  icon?: string;
  badge?: string;
  children?: SidebarItem[];
};

// Maps module IDs to their base route and permission prefix
const MODULE_ROUTE_MAP: Record<string, { baseRoute: string; permission: string; icon: string }> = {
  accounting: { baseRoute: '/accounting/vouchers', permission: 'accounting.vouchers.view', icon: 'File' },
  sales:      { baseRoute: '/sales',               permission: 'sales.view',               icon: 'File' },
  purchase:   { baseRoute: '/purchases',            permission: 'purchase.view',            icon: 'File' },
};

// Sidebar grouping policy — see docs/architecture/sidebar-forms-grouping.md
//   - native forms       → static `Forms` group declared in moduleMenuMap
//   - accounting forms   → `Vouchers` group (defaults AND clones, unless the
//                          user explicitly assigned a different group)
//   - default forms (sales/purchases) → `Default Forms` group
//   - cloned forms (sales/purchases, no explicit group) → root of the module
//                          sidebar (top-level leaves, not nested)
//   - explicit user group → honored verbatim
//
// The literal `"Documents"` value is treated as an unset placeholder because
// the system seed sets every voucher type to `sidebarGroup: "Documents"`
// regardless of module — see backend/src/seeder/seedSystemVoucherTypes.ts.
const DEFAULT_FORMS_GROUP = 'Default Forms';
const NATIVE_FORMS_GROUP = 'Forms';
const VOUCHERS_GROUP = 'Vouchers';
const SEED_PLACEHOLDER_GROUP = 'Documents';

// Order of form-related groups within a module section. `Forms` (native) is
// already declared in moduleMenuMap; the rest are inserted right after it.
const FORM_GROUP_RANK: Record<string, number> = {
  [NATIVE_FORMS_GROUP]: 0,
  [DEFAULT_FORMS_GROUP]: 1,
  [VOUCHERS_GROUP]: 2,
  // user-named custom groups land at rank 3.
};
const USER_GROUP_RANK = 3;
// Root-level leaves (groupless clones) sort between Default Forms and Vouchers.
const ROOT_LEAF_RANK = 1.5;

const isSystemDefaultForm = (form: SidebarFormEntry): boolean =>
  !!(form.isDefault || form.isSystemGenerated || form.isLocked);

export const useSidebarConfig = () => {
  const { isSuperAdmin, moduleBundles, resolvedPermissions, loading: accessLoading, permissionsLoaded } = useCompanyAccess();
  const { hasPermission } = useRBAC();
  const { voucherTypes, allModuleForms } = useVoucherTypes();
  const { showPurchaseOperationalDocs, showSalesOperationalDocs } = useDocumentPolicies();
  const { t } = useTranslation('common');
  const showDevNavigation =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && window.localStorage.getItem('erp_show_dev_navigation') === 'true');

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
    Forms: 'sidebar.forms',
    'Default Forms': 'sidebar.defaultForms',
    'Other Forms': 'sidebar.otherForms',
    Tools: 'sidebar.tools',
    'All Vouchers': 'sidebar.allVouchers',
    'Forms Designer': 'sidebar.formsDesigner',
    'Forms Management': 'sidebar.formsManagement',
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
    Shortcuts: 'sidebar.shortcuts',
    Shift: 'sidebar.shift',
    Returns: 'sidebar.returns',
    Registers: 'sidebar.registers',
    Sessions: 'sidebar.sessions',
    'Work Orders': 'sidebar.workOrders',
    BOM: 'sidebar.bom',
    'General Settings': 'sidebar.generalSettings',
    Overview: 'sidebar.overview',
    Users: 'sidebar.users',
    Roles: 'sidebar.roles',
    Modules: 'sidebar.modules',
    Features: 'sidebar.features',
    Bundles: 'sidebar.bundles',
    'AI Assistant': 'sidebar.aiAssistant',
    Chat: 'sidebar.chat',
    'AI Proposals': 'sidebar.aiProposals',
    'AI Usage': 'sidebar.aiUsage',
    'Dev': 'sidebar.dev',
    'DataTable Demo': 'sidebar.dataTableDemo',
    'Voucher List Demo': 'sidebar.voucherListDemo',
    'Smart Voucher List': 'sidebar.smartVoucherList',
    'Tailwind Play Demo': 'sidebar.tailwindPlayDemo',
    'UI Lab': 'sidebar.uiLab',
    'UI Lab 🎨': 'sidebar.uiLab',
    'Demo': 'sidebar.demo',
    'New': 'sidebar.new',
    'Home': 'sidebar.home',
    // Sales items
    'Products & Services': 'sidebar.productsAndServices',
    'Sales Orders': 'sidebar.salesOrders',
    'Delivery Notes': 'sidebar.deliveryNotes',
    'Sales Invoices': 'sidebar.salesInvoices',
    'Sales Returns': 'sidebar.salesReturns',
    'AR Aging': 'sidebar.arAging',
    'Customer Statement': 'sidebar.customerStatement',
    'Sales Analytics': 'sidebar.salesAnalytics',
    'Aged Backlog': 'sidebar.agedBacklog',
    'Customer Groups': 'sidebar.customerGroups',
    'Price Lists': 'sidebar.priceLists',
    Salespersons: 'sidebar.salespersons',
    Promotions: 'sidebar.promotions',
    // Purchases items
    'Goods Receipts': 'sidebar.goodsReceipts',
    'Purchase Invoices': 'sidebar.purchaseInvoices',
    'Purchase Returns': 'sidebar.purchaseReturns',
    'AP Aging': 'sidebar.apAging',
    'Vendor Statement': 'sidebar.vendorStatement',
    'Purchases Analytics': 'sidebar.purchasesAnalytics',
    'Vendor Groups': 'sidebar.vendorGroups',
    // Inventory items
    'Opening Stock Documents': 'sidebar.openingStock',
    Adjustments: 'sidebar.adjustments',
    Transfers: 'sidebar.transfers',
    'Stock Levels': 'sidebar.stockLevels',
    Movements: 'sidebar.movements',
    'Low Stock Alerts': 'sidebar.lowStockAlerts',
    'Unsettled Costs': 'sidebar.unsettledCosts',
    'Inventory Valuation': 'sidebar.inventoryValuation',
    Categories: 'sidebar.categories',
    'UOM Master': 'sidebar.uomMaster',
    // Accounting tools
    Budgets: 'sidebar.budgets',
    'Consolidated TB': 'sidebar.consolidatedTB',
    'Z Report (by shift)': 'sidebar.posZReport',
    'Daily Summary': 'sidebar.posDailySummary',
    'Payment Methods': 'sidebar.posPaymentMethods',
    'Cashier Sales': 'sidebar.posCashierSales',
    'Cash Over/Short': 'sidebar.posCashOverShort',
    'Receipt History': 'sidebar.posReceiptHistory',
    'Cancelled Receipts': 'sidebar.posCancelledReceipts',
    'Top Selling Items': 'sidebar.posTopSellingItems',
    'Override Audit': 'sidebar.posOverrideAudit',
    'Reprint Audit': 'sidebar.posReprintAudit',
  };

  const translateLabel = (label: string) => t(labelKeyMap[label] || label, { defaultValue: label });

  const isDevPath = (path?: string) =>
    !!path && (path === '/canvas-dev' || path.startsWith('/dev'));

  const filterProductionSidebarItems = (items: SidebarItem[]): SidebarItem[] => {
    if (showDevNavigation) return items;

    return items.reduce<SidebarItem[]>((acc, item) => {
      if (isDevPath(item.path)) return acc;

      const children = item.children ? filterProductionSidebarItems(item.children) : undefined;
      if (item.children && (!children || children.length === 0) && !item.path) return acc;

      acc.push({
        ...item,
        children
      });
      return acc;
    }, []);
  };

  /**
   * Build dynamic form groups for a given module from allModuleForms.
   * Groups forms by their sidebarGroup. If sidebarGroup is null, they become top-level items.
   */
  const buildDynamicFormGroups = (moduleId: string): SidebarItem[] => {
    const moduleKey = moduleId.toUpperCase();
    const moduleForms = allModuleForms.filter((form) => {
      if (form.module !== moduleKey || !form.enabled) return false;
      if (moduleId === 'sales' && !showSalesOperationalDocs && isOperationalSalesDocument(form)) return false;
      if (moduleId === 'purchase' && !showPurchaseOperationalDocs && isOperationalPurchaseDocument(form)) return false;
      return true;
    });
    if (moduleForms.length === 0) return [];

    const routeConfig = MODULE_ROUTE_MAP[moduleId];
    if (!routeConfig) return [];

    // Per-module defaulting — see docs/architecture/sidebar-forms-grouping.md.
    // Returns the effective sidebar group for a form, or `null` to emit the
    // form as a top-level leaf at the module root.
    const effectiveGroup = (form: SidebarFormEntry): string | null => {
      const explicit = (form.sidebarGroup || '').trim();
      if (explicit && explicit !== SEED_PLACEHOLDER_GROUP) return explicit;
      if (moduleId === 'accounting') return VOUCHERS_GROUP;
      if (isSystemDefaultForm(form)) return DEFAULT_FORMS_GROUP;
      return null; // sales/purchases clone with no explicit group → root
    };

    const groups = new Map<string, SidebarFormEntry[]>();
    const rootLeaves: SidebarFormEntry[] = [];

    moduleForms.forEach(form => {
      const groupName = effectiveGroup(form);
      if (groupName === null) {
        rootLeaves.push(form);
        return;
      }
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)!.push(form);
    });

    const formPath = (form: SidebarFormEntry) =>
      moduleId === 'accounting'
        ? `${routeConfig.baseRoute}?type=${form.id}`
        : `${routeConfig.baseRoute}/${encodeURIComponent(form.id)}`;

    const groupIcon = (groupName: string): string => {
      if (groupName === DEFAULT_FORMS_GROUP) return 'Layers';
      if (groupName === VOUCHERS_GROUP) return 'FileText';
      return 'FolderOpen';
    };

    const result: SidebarItem[] = [];

    groups.forEach((forms, groupName) => {
      const children: SidebarItem[] = [];

      // Accounting's Vouchers group gets an "All Vouchers" entry up front so
      // users can reach the unified list without scanning the per-type entries.
      if (moduleId === 'accounting' && groupName === VOUCHERS_GROUP) {
        children.push({
          label: translateLabel('All Vouchers'),
          path: '/accounting/vouchers',
          permission: routeConfig.permission,
          icon: 'FileSearch',
        });
      }

      forms.forEach(form => {
        children.push({
          label: form.name,
          path: formPath(form),
          permission: routeConfig.permission,
          icon: routeConfig.icon,
        });
      });

      result.push({
        label: translateLabel(groupName),
        icon: groupIcon(groupName),
        children,
      });
    });

    // Groupless clones render as top-level sidebar leaves at the module root.
    rootLeaves.forEach(form => {
      result.push({
        label: form.name,
        path: formPath(form),
        permission: routeConfig.permission,
        icon: routeConfig.icon,
      });
    });

    return result;
  };

  // Rank used to position dynamic form groups and root-level form leaves
  // right after the static `Forms` group within a module section. Lower rank
  // → earlier in the sidebar. Items without a known label rank as user groups.
  const dynamicGroupRank = (item: SidebarItem): number => {
    // Root-level leaves (no children) — groupless clones rendered flat.
    if (!item.children) return ROOT_LEAF_RANK;
    const label = item.label;
    if (FORM_GROUP_RANK[label] !== undefined) return FORM_GROUP_RANK[label];
    if (translateLabel(DEFAULT_FORMS_GROUP) === label) return FORM_GROUP_RANK[DEFAULT_FORMS_GROUP];
    if (translateLabel(VOUCHERS_GROUP) === label) return FORM_GROUP_RANK[VOUCHERS_GROUP];
    if (translateLabel(NATIVE_FORMS_GROUP) === label) return FORM_GROUP_RANK[NATIVE_FORMS_GROUP];
    return USER_GROUP_RANK;
  };

  const filterSidebarItems = (items: SidebarItem[]): SidebarItem[] => {
    return items.reduce<SidebarItem[]>((visibleItems, item) => {
      const children = item.children ? filterSidebarItems(item.children) : undefined;
      const hasAllowedOwnRoute = !!item.path && hasPermission(item.permission);
      const hasVisibleChildren = !!children && children.length > 0;
      const isAllowedGroup = !item.path && hasVisibleChildren && hasPermission(item.permission);

      if (!hasAllowedOwnRoute && !hasVisibleChildren && !isAllowedGroup) {
        return visibleItems;
      }

      visibleItems.push({
        ...item,
        children: hasVisibleChildren ? children : undefined,
      });

      return visibleItems;
    }, []);
  };

  const applyWorkflowVisibility = (moduleId: string, items: SidebarItem[]): SidebarItem[] => {
    return items.reduce<SidebarItem[]>((visibleItems, item) => {
      const hiddenForCurrentMode =
        !!(item as any).hideInSimpleMode
        && (
          (moduleId === 'sales' && !showSalesOperationalDocs)
          || (moduleId === 'purchase' && !showPurchaseOperationalDocs)
        );

      if (hiddenForCurrentMode) {
        return visibleItems;
      }

      const children = item.children
        ? applyWorkflowVisibility(moduleId, item.children)
        : undefined;

      visibleItems.push({
        ...item,
        children,
      });

      return visibleItems;
    }, []);
  };

  const sidebarSections = useMemo(() => {
    const sections: Record<string, { icon: string; items: SidebarItem[]; path?: string }> = {};

    if (isSuperAdmin) {
      return {
        'System': {
          icon: 'Settings',
          items: [
            { label: translateLabel('System Overview'), path: '/super-admin/overview' },
            { label: translateLabel('Appearance Lab'), path: '/super-admin/appearance' },
            { label: translateLabel('System Forms'), path: '/super-admin/system-forms' },
            { label: translateLabel('Voucher Templates'), path: '/super-admin/voucher-templates' },
            { label: translateLabel('Field Library'), path: '/super-admin/field-library' }
          ]
        },
        'Companies': {
          icon: 'Building2',
          items: [
            { label: translateLabel('All Companies'), path: '/super-admin/companies' },
            { label: translateLabel('Business Domains'), path: '/super-admin/business-domains' },
            { label: translateLabel('Plans'), path: '/super-admin/plans' },
            { label: translateLabel('Bundles'), path: '/super-admin/bundles-manager' }
          ]
        },
        'Permissions': {
          icon: 'Shield',
          items: [
            { label: translateLabel('Users Management'), path: '/super-admin/users' },
            { label: translateLabel('Modules Registry'), path: '/super-admin/modules-registry' },
            { label: translateLabel('Permissions Registry'), path: '/super-admin/permissions-registry' }
          ]
        },
        'AI Management': {
          icon: 'Bot',
          items: [
            { label: translateLabel('Overview'), path: '/super-admin/ai-management' },
            {
              label: translateLabel('Configuration'),
              children: [
                { label: translateLabel('Providers'), path: '/super-admin/ai-providers' },
                { label: translateLabel('Model Profiles'), path: '/super-admin/ai-models' },
                { label: translateLabel('Runtime Profiles'), path: '/super-admin/ai-runtime-profiles' }
              ]
            },
            {
              label: translateLabel('Governance'),
              children: [
                { label: translateLabel('Tool Catalog'), path: '/super-admin/ai-tools' },
                { label: translateLabel('Proposal Policies'), path: '/super-admin/ai-proposal-policies' }
              ]
            }
          ]
        }
      };
    }

    // Add Home section at the very top of tenant navigation
    sections[translateLabel('Home')] = {
      icon: 'Home',
      items: [],
      path: '/'
    };

    const normalizedBundles = (moduleBundles || [])
      .map((moduleId) => String(moduleId || '').trim().toLowerCase())
      .filter(Boolean);

    const bundleList =
      !accessLoading && permissionsLoaded
        ? normalizedBundles
        : [];

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
      let items = applyWorkflowVisibility(moduleId, def.items as SidebarItem[]);
      items = filterSidebarItems(items);
      
      // === DYNAMIC FORM INJECTION ===
      // Insertion order within a module section:
      //   Forms (static)        — native list pages + clones tagged "Forms"
      //   Default Forms         — all default forms
      //   [user-named groups]   — clones tagged with a custom sidebarGroup
      //   Other Forms           — clones with blank sidebarGroup
      //   (then Reports, Tools, Settings as declared in moduleMenuMap)
      //
      // Dynamic groups are inserted right after the static `Forms` group, in
      // ascending FORM_GROUP_RANK order, instead of being appended at the end
      // (which would push them past Reports / Tools / Settings).
      const dynamicModuleId = moduleId;

      if (MODULE_ROUTE_MAP[dynamicModuleId]) {
        const dynamicGroups = buildDynamicFormGroups(dynamicModuleId);

        if (dynamicGroups.length > 0) {
          const findFormsIndex = () =>
            items.findIndex((item) =>
              (item.label === NATIVE_FORMS_GROUP || item.label === translateLabel(NATIVE_FORMS_GROUP))
              && Array.isArray(item.children)
            );

          const toInsert: SidebarItem[] = [];

          for (const dynGroup of dynamicGroups) {
            const matchesNativeForms =
              dynGroup.label === NATIVE_FORMS_GROUP
              || translateLabel(NATIVE_FORMS_GROUP) === dynGroup.label;

            if (matchesNativeForms) {
              // Clone tagged sidebarGroup="Forms" → fold into the static Forms group.
              const formsIdx = findFormsIndex();
              if (formsIdx >= 0) {
                const existing = items[formsIdx];
                items[formsIdx] = {
                  ...existing,
                  children: [
                    ...(existing.children || []),
                    ...((dynGroup as any).children || []),
                  ],
                } as any;
                continue;
              }
            }
            toInsert.push(dynGroup);
          }

          // Sort dynamic groups by rank: Default Forms → user-named → Other Forms.
          toInsert.sort((a, b) => dynamicGroupRank(a) - dynamicGroupRank(b));

          // Insert right after the static Forms group (or at the end if missing).
          const anchorIdx = findFormsIndex();
          const insertAt = anchorIdx >= 0 ? anchorIdx + 1 : items.length;
          items.splice(insertAt, 0, ...toInsert);
        }
      }

      items = filterSidebarItems(items);
      items = filterProductionSidebarItems(items);
      
      if (items.length > 0) {
        sections[translateLabel(def.label)] = {
          icon: def.icon || 'LayoutGrid',
          items: items.map(i => ({
            label: translateLabel(i.label),
            path: i.path,
            permission: i.permission,
            badge: (i as any).badge,
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

    if (showDevNavigation) {
      sections[translateLabel('Dev')] = {
        icon: 'Code',
        items: [
          { 
            label: translateLabel('DataTable Demo'), 
            path: '/dev/data-table',
            icon: 'Table',
            badge: 'Demo'
          },
          { 
            label: translateLabel('Voucher List Demo'), 
            path: '/dev/voucher-list',
            icon: 'FileText',
            badge: 'Demo'
          },
          { 
            label: translateLabel('Smart Voucher List'), 
            path: '/dev/smart-vouchers',
            icon: 'Brain',
            badge: 'New'
          },
          { 
            label: translateLabel('Tailwind Play Demo'), 
            path: '/dev/tailwind-play-demo',
            icon: 'Layout',
            badge: 'New'
          },
          { 
            label: translateLabel('UI Lab'), 
            path: '/dev/ui-lab',
            icon: 'Sparkles',
            badge: 'New'
          },
          { 
            label: translateLabel('Icons Comparison'), 
            path: '/dev/icons-comparison',
            icon: 'Layers',
            badge: 'New'
          },
          { 
            label: translateLabel('Report Demo'), 
            path: '/dev/report-table-demo',
            icon: 'FlaskConical',
            badge: 'New'
          }
        ]
      };
    }

    return sections;
  }, [
    hasPermission,
    isSuperAdmin,
    accessLoading,
    permissionsLoaded,
    moduleBundles,
    resolvedPermissions,
    allModuleForms,
    voucherTypes,
    t,
    showDevNavigation,
    showPurchaseOperationalDocs,
    showSalesOperationalDocs,
  ]);

  return sidebarSections;
};
