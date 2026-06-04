export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type AccountClassification = 'Header' | 'Posting' | 'Reconciliation';

export interface COAAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  classification: AccountClassification;
  currency: string;
  parentId: string | null;
  balance: number;
  isActive: boolean;
  notes?: string;
}

export interface LineItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  items: LineItem[];
  taxAmount: number;
  totalAmount: number;
  status: 'Draft' | 'Approved' | 'Invoiced' | 'Cancelled';
  currency: string;
  exchangeRate?: number;
  notes?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  date: string;
  dueDate: string;
  items: LineItem[];
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: 'Draft' | 'Approved' | 'Posted' | 'Paid' | 'Overdue';
  currency: string;
  exchangeRate?: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  balance: number;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  balance: number;
}

export interface PurchaseBill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  dueDate: string;
  items: LineItem[];
  taxAmount: number;
  totalAmount: number;
  status: 'Draft' | 'Approved' | 'Paid' | 'Overdue';
  currency: string;
  exchangeRate?: number;
  notes?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  qtyOnHand: number;
  avgCost: number;
  salePrice: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  debitTotal: number;
  creditTotal: number;
  lines: JournalLine[];
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  debit: number;
  credit: number;
}
