/**
 * AccountingDTOs.ts
 * 
 * V2 Only - Uses VoucherEntity and VoucherLineEntity
 */
import { Account } from '../../domain/accounting/entities/Account';
import { VoucherEntity } from '../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../domain/accounting/entities/VoucherLineEntity';

export interface AccountDTO {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  active: boolean;
  // Approval Policy V1 fields
  requiresApproval?: boolean;
  requiresCustodyConfirmation?: boolean;
  custodianUserId?: string | null;
}

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
  // Computed/legacy compatibility
  sourceModule?: string | null;
  formId?: string | null;
  prefix?: string | null;
}

export interface CreateVoucherRequest {
  type: string; // VoucherType
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

export class AccountingDTOMapper {
  static toAccountDTO(account: Account): AccountDTO {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      currency: account.currency,
      active: account.active,
      // Approval Policy V1 fields
      requiresApproval: account.requiresApproval,
      requiresCustodyConfirmation: account.requiresCustodyConfirmation,
      custodianUserId: account.custodianUserId,
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
