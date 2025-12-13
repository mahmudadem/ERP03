import { AccountType } from '../../../domain/accounting/entities/Account';

export interface TemplateAccount {
  code: string;
  name: string;
  type: AccountType;
  isProtected: boolean;
  parentId?: string; // Code of the parent account (optional)
}

export const StandardCOA: TemplateAccount[] = [
  // ASSETS
  { code: '1000', name: 'Assets', type: 'ASSET', isProtected: true },
  { code: '1100', name: 'Current Assets', type: 'ASSET', isProtected: true, parentId: '1000' },
  { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', isProtected: false, parentId: '1100' },
  { code: '1200', name: 'Accounts Receivable', type: 'ASSET', isProtected: true, parentId: '1100' },
  { code: '1300', name: 'Inventory', type: 'ASSET', isProtected: true, parentId: '1100' },
  
  // LIABILITIES
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', isProtected: true },
  { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', isProtected: true, parentId: '2000' },
  { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', isProtected: true, parentId: '2100' },
  { code: '2120', name: 'Tax Payable', type: 'LIABILITY', isProtected: true, parentId: '2100' },

  // EQUITY
  { code: '3000', name: 'Equity', type: 'EQUITY', isProtected: true },
  { code: '3100', name: 'Retained Earnings', type: 'EQUITY', isProtected: true, parentId: '3000' },
  { code: '3200', name: 'Capital', type: 'EQUITY', isProtected: true, parentId: '3000' },

  // INCOME
  { code: '4000', name: 'Revenue', type: 'INCOME', isProtected: true },
  { code: '4100', name: 'Sales Revenue', type: 'INCOME', isProtected: false, parentId: '4000' },
  
  // EXPENSES
  { code: '5000', name: 'Expenses', type: 'EXPENSE', isProtected: true },
  { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', isProtected: true, parentId: '5000' },
  { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', isProtected: true, parentId: '5000' },
  { code: '6100', name: 'Salaries and Wages', type: 'EXPENSE', isProtected: false, parentId: '6000' },
  { code: '6200', name: 'Rent', type: 'EXPENSE', isProtected: false, parentId: '6000' },
];

export const SimplifiedCOA: TemplateAccount[] = [
  { code: '1000', name: 'Assets', type: 'ASSET', isProtected: true },
  { code: '1100', name: 'Cash', type: 'ASSET', isProtected: false, parentId: '1000' },
  { code: '2000', name: 'Liabilities', type: 'LIABILITY', isProtected: true },
  { code: '3000', name: 'Equity', type: 'EQUITY', isProtected: true },
  { code: '4000', name: 'Income', type: 'INCOME', isProtected: true },
  { code: '5000', name: 'Expenses', type: 'EXPENSE', isProtected: true },
];
