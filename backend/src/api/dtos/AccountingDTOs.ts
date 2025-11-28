/**
 * AccountingDTOs.ts
 */
import { Account } from '../../domain/accounting/entities/Account';
import { Voucher } from '../../domain/accounting/entities/Voucher';
import { VoucherLine } from '../../domain/accounting/entities/VoucherLine';

export interface AccountDTO {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  active: boolean;
}

export interface VoucherLineDTO {
  id: string;
  accountId: string;
  description: string;
  fxAmount: number;
  baseAmount: number;
  costCenterId?: string;
}

export interface VoucherDTO {
  id: string;
  companyId: string;
  type: string;
  date: string;
  currency: string;
  exchangeRate: number;
  status: string;
  totalDebit: number;
  totalCredit: number;
  reference?: string;
  lines?: VoucherLineDTO[]; // Optional in list view, required in detail
  createdBy: string;
}

export interface CreateVoucherRequest {
  companyId: string;
  type: string; // VoucherType
  date: string;
  currency: string;
  exchangeRate?: number;
  reference?: string;
  lines: {
    accountId: string;
    description: string;
    fxAmount: number;
    costCenterId?: string;
  }[];
}

export interface UpdateVoucherRequest {
  date?: string;
  reference?: string;
  lines?: {
    id?: string; // If present, update; else create
    accountId: string;
    description: string;
    fxAmount: number;
    costCenterId?: string;
  }[];
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
    };
  }

  static toVoucherDTO(voucher: Voucher, lines: VoucherLine[] = []): VoucherDTO {
    return {
      id: voucher.id,
      companyId: voucher.companyId,
      type: voucher.type,
      date: voucher.date.toISOString(),
      currency: voucher.currency,
      exchangeRate: voucher.exchangeRate,
      status: voucher.status,
      totalDebit: voucher.totalDebit,
      totalCredit: voucher.totalCredit,
      reference: voucher.reference,
      createdBy: voucher.createdBy,
      lines: lines.map(line => ({
        id: line.id,
        accountId: line.accountId,
        description: line.description,
        fxAmount: line.fxAmount,
        baseAmount: line.baseAmount,
        costCenterId: line.costCenterId
      }))
    };
  }
}