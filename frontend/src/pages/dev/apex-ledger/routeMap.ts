export const APEX_ROOT = '/dev/apex-ledger';

type SplitPath = {
  pathname: string;
  suffix: string;
};

const splitPath = (path: string): SplitPath => {
  const match = path.match(/^([^?#]*)([?#].*)?$/);
  return {
    pathname: match?.[1] || '/',
    suffix: match?.[2] || '',
  };
};

const normalizePathname = (pathname: string): string => {
  if (!pathname) return '/';
  const withSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
};

const accountingReportAliases: Record<string, string> = {
  '/accounting/reports/trial-balance': '/reports/trial-balance',
  '/accounting/reports/account-statement': '/reports/account-statement',
  '/accounting/reports/balance-sheet': '/reports/balance-sheet',
  '/accounting/reports/ledger': '/reports/ledger',
  '/accounting/reports/profit-loss': '/reports/profit-loss',
  '/accounting/reports/trading-account': '/reports/trading-account',
  '/accounting/reports/cash-flow': '/reports/cash-flow',
  '/accounting/reports/journal': '/reports/journal',
  '/accounting/reports/aging': '/reports/aging',
  '/accounting/reports/bank-reconciliation': '/reports/bank-reconciliation',
  '/accounting/reports/cost-center-summary': '/reports/cost-center-summary',
  '/accounting/reports/budget-vs-actual': '/reports/budget-vs-actual',
  '/accounting/reports/consolidated-trial-balance': '/reports/consolidated-tb',
};

const accountingAliases: Record<string, string> = {
  '/': '',
  '/accounting': '/accounting',
  '/accounting/accounts': '/coa',
  '/accounting/approvals': '/approvals',
  '/accounting/vouchers': '/vouchers',
  '/accounting/settings': '/settings/accounting',
  '/accounting/tools/voucher-designer': '/accounting/tools/forms',
  '/accounting/settings/voucher-types': '/accounting/tools/forms',
  '/accounting/forms-designer': '/accounting/tools/forms',
  '/accounting/budgets': '/accounting/tools/budgets',
  '/accounting/settings/subgroup-tagging': '/accounting/tools/subgroup-tagging',
  '/tools/forms-designer': '/tools/forms',
  '/ai-assistant': '/ai',
};

const tenantPrefixAliases: Array<[string, string]> = [
  ['/accounting/vouchers/', '/vouchers/'],
  ['/ai-assistant/', '/ai/'],
];

const apexToTenantAliases: Record<string, string> = {
  [`${APEX_ROOT}`]: '/',
  [`${APEX_ROOT}/accounting`]: '/accounting',
  [`${APEX_ROOT}/coa`]: '/accounting/accounts',
  [`${APEX_ROOT}/approvals`]: '/accounting/approvals',
  [`${APEX_ROOT}/vouchers`]: '/accounting/vouchers',
  [`${APEX_ROOT}/settings/accounting`]: '/accounting/settings',
  [`${APEX_ROOT}/accounting/tools/forms`]: '/accounting/tools/voucher-designer',
  [`${APEX_ROOT}/accounting/tools/budgets`]: '/accounting/budgets',
  [`${APEX_ROOT}/accounting/tools/subgroup-tagging`]: '/accounting/settings/subgroup-tagging',
  [`${APEX_ROOT}/tools/forms`]: '/tools/forms-designer',
  [`${APEX_ROOT}/reports/consolidated-tb`]: '/accounting/reports/consolidated-trial-balance',
  [`${APEX_ROOT}/ai`]: '/ai-assistant',
};

const apexPrefixAliases: Array<[string, string]> = [
  [`${APEX_ROOT}/vouchers/`, '/accounting/vouchers/'],
  [`${APEX_ROOT}/ai/`, '/ai-assistant/'],
];

Object.entries(accountingReportAliases).forEach(([tenantPath, apexPath]) => {
  apexToTenantAliases[`${APEX_ROOT}${apexPath}`] = tenantPath;
});

export const tenantPathToApexPath = (path?: string): string | undefined => {
  if (!path) return undefined;

  const { pathname, suffix } = splitPath(path);
  const normalized = normalizePathname(pathname);

  if (normalized === APEX_ROOT || normalized.startsWith(`${APEX_ROOT}/`)) {
    return `${normalized}${suffix}`;
  }

  const alias = accountingReportAliases[normalized] || accountingAliases[normalized];
  if (alias !== undefined) {
    return `${APEX_ROOT}${alias}${suffix}`;
  }

  const prefixAlias = tenantPrefixAliases.find(([tenantPrefix]) => normalized.startsWith(tenantPrefix));
  if (prefixAlias) {
    const [tenantPrefix, apexPrefix] = prefixAlias;
    return `${APEX_ROOT}${apexPrefix}${normalized.slice(tenantPrefix.length)}${suffix}`;
  }

  return `${APEX_ROOT}${normalized}${suffix}`;
};

export const apexPathToTenantPath = (path?: string): string | undefined => {
  if (!path) return undefined;

  const { pathname, suffix } = splitPath(path);
  const normalized = normalizePathname(pathname);

  if (apexToTenantAliases[normalized]) {
    return `${apexToTenantAliases[normalized]}${suffix}`;
  }

  const prefixAlias = apexPrefixAliases.find(([apexPrefix]) => normalized.startsWith(apexPrefix));
  if (prefixAlias) {
    const [apexPrefix, tenantPrefix] = prefixAlias;
    return `${tenantPrefix}${normalized.slice(apexPrefix.length)}${suffix}`;
  }

  if (normalized.startsWith(APEX_ROOT)) {
    const tenantPath = normalized.slice(APEX_ROOT.length) || '/';
    return `${tenantPath}${suffix}`;
  }

  return `${normalized}${suffix}`;
};
