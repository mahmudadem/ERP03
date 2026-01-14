/**
 * AccountingDTOs.ts
 * 
 * Data Transfer Objects for the Accounting API.
 * Includes full Account DTO with new specification fields.
 */

import { Account } from '../../domain/accounting/entities/Account';
import { VoucherEntity } from '../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../domain/accounting/entities/VoucherLineEntity';

// ============================================================================
// ACCOUNT DTOs
// ============================================================================

export interface AccountDTO {
  // Identity
  id: string;
  systemCode: string;
  userCode: string;
  name: string;
  description?: string | null;
  
  // Accounting semantics
  accountRole: string;
  classification: string;
  balanceNature: string;
  balanceEnforcement: string;
  
  // Hierarchy
  parentId?: string | null;
  
  // Currency
  currencyPolicy: string;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  
  // Lifecycle
  status: string;
  isProtected: boolean;
  replacedByAccountId?: string | null;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  
  // Computed flags
  canPost?: boolean;
  hasChildren?: boolean;
  isUsed?: boolean;
  
  // Legacy compat fields
  code?: string;             // Alias for userCode
  type?: string;             // Alias for classification
  currency?: string;         // Alias for fixedCurrencyCode
  active?: boolean;          // Alias for status === 'ACTIVE'
  requiresApproval?: boolean;
  requiresCustodyConfirmation?: boolean;
  custodianUserId?: string | null;
}

export interface CreateAccountRequest {
  userCode: string;
  name: string;
  classification: string;
  
  // Optional
  description?: string;
  accountRole?: string;
  balanceNature?: string;
  balanceEnforcement?: string;
  parentId?: string | null;
  currencyPolicy?: string;
  fixedCurrencyCode?: string;
  allowedCurrencyCodes?: string[];
  isProtected?: boolean;
  
  // Legacy compat
  code?: string;
  type?: string;
  currency?: string;
}

export interface UpdateAccountRequest {
  userCode?: string;
  name?: string;
  description?: string | null;
  status?: string;
  replacedByAccountId?: string | null;
  
  // Conditionally editable
  accountRole?: string;
  classification?: string;
  balanceNature?: string;
  balanceEnforcement?: string;
  currencyPolicy?: string;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  
  // Hierarchy
  parentId?: string | null;
  
  // System
  isProtected?: boolean;
  
  // Legacy compat
  code?: string;
  type?: string;
  isActive?: boolean;
  currency?: string;
}

// ============================================================================
// VOUCHER DTOs
// ============================================================================

export interface VoucherLineDTO {
  id: number;
  accountId: string;
  side: 'Debit' | 'Credit';
  amount: number;
  baseAmount: number;
  currency: string;
  baseCurrency: string;
  exchangeRate: number;
  notes?: string | null;
  costCenterId?: string | null;
  metadata?: Record<string, any>;
}

export interface VoucherDTO {
  id: string;
  companyId: string;
  voucherNo: string;
  type: string;
  date: string;
  description: string;
  currency: string;
  baseCurrency: string;
  exchangeRate: number;
  status: string;
  totalDebit: number;
  totalCredit: number;
  reference?: string | null;
  lines: VoucherLineDTO[];
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, any>;
  sourceModule?: string | null;
  formId?: string | null;
  prefix?: string | null;
  reversalOfVoucherId?: string | null;
}

export interface CreateVoucherRequest {
  type: string;
  date: string;
  description?: string;
  currency?: string;
  baseCurrency?: string;
  exchangeRate?: number;
  reference?: string;
  lines: {
    accountId: string;
    side: 'Debit' | 'Credit';
    amount: number;
    currency?: string;
    baseCurrency?: string;
    exchangeRate?: number;
    notes?: string;
    costCenterId?: string;
    metadata?: Record<string, any>;
  }[];
  metadata?: Record<string, any>;
}

export interface UpdateVoucherRequest {
  date?: string;
  description?: string;
  reference?: string;
  lines?: {
    id?: number;
    accountId: string;
    side: 'Debit' | 'Credit';
    amount: number;
    currency?: string;
    exchangeRate?: number;
    notes?: string;
    costCenterId?: string;
    metadata?: Record<string, any>;
  }[];
  metadata?: Record<string, any>;
}

// ============================================================================
// DTO MAPPERS
// ============================================================================

export class AccountingDTOMapper {
  static toAccountDTO(account: Account): AccountDTO {
    return {
      // Identity
      id: account.id,
      systemCode: account.systemCode,
      userCode: account.userCode,
      name: account.name,
      description: account.description,
      
      // Accounting semantics
      accountRole: account.accountRole,
      classification: account.classification,
      balanceNature: account.balanceNature,
      balanceEnforcement: account.balanceEnforcement,
      
      // Hierarchy
      parentId: account.parentId,
      
      // Currency
      currencyPolicy: account.currencyPolicy,
      fixedCurrencyCode: account.fixedCurrencyCode,
      allowedCurrencyCodes: account.allowedCurrencyCodes,
      
      // Lifecycle
      status: account.status,
      isProtected: account.isProtected,
      replacedByAccountId: account.replacedByAccountId,
      
      // Audit
      createdAt: account.createdAt.toISOString(),
      createdBy: account.createdBy,
      updatedAt: account.updatedAt.toISOString(),
      updatedBy: account.updatedBy,
      
      // Computed flags
      canPost: account.canPost(),
      hasChildren: account.hasChildren,
      isUsed: account.isUsed,
      
      // Legacy compat
      code: account.userCode,
      type: account.classification,
      currency: account.fixedCurrencyCode || '',
      active: account.status === 'ACTIVE',
      requiresApproval: account.requiresApproval,
      requiresCustodyConfirmation: account.requiresCustodyConfirmation,
      custodianUserId: account.custodianUserId
    };
  }

  static toVoucherDTO(voucher: VoucherEntity): VoucherDTO {
    return {
      id: voucher.id,
      companyId: voucher.companyId,
      voucherNo: voucher.voucherNo,
      type: voucher.type,
      date: voucher.date,
      description: voucher.description,
      currency: voucher.currency,
      baseCurrency: voucher.baseCurrency,
      exchangeRate: voucher.exchangeRate,
      status: voucher.status,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      reference: voucher.reference,
      createdBy: voucher.createdBy,
      createdAt: voucher.createdAt.toISOString(),
      metadata: voucher.metadata,
      sourceModule: voucher.sourceModule,
      formId: voucher.formId,
      prefix: voucher.prefix,
      reversalOfVoucherId: voucher.reversalOfVoucherId,
      lines: voucher.lines.map(line => AccountingDTOMapper.toVoucherLineDTO(line))
    };
  }

  static toVoucherLineDTO(line: VoucherLineEntity): VoucherLineDTO {
    return {
      id: line.id,
      accountId: line.accountId,
      side: line.side,
      amount: line.amount,
      baseAmount: line.baseAmount,
      currency: line.currency,
      baseCurrency: line.baseCurrency,
      exchangeRate: line.exchangeRate,
      notes: line.notes,
      costCenterId: line.costCenterId,
      metadata: line.metadata
    };
  }
}
