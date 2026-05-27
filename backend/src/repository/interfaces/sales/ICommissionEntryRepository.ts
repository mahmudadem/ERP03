import { CommissionEntry } from '../../../domain/sales/entities/CommissionEntry';

export interface CommissionEntryListOptions {
  salespersonId?: string;
  status?: 'ACCRUED' | 'PAID' | 'CANCELLED';
  sourceId?: string;
  /** YYYY-MM-DD inclusive */
  fromDate?: string;
  /** YYYY-MM-DD inclusive */
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface ICommissionEntryRepository {
  create(entry: CommissionEntry, transaction?: unknown): Promise<void>;
  update(entry: CommissionEntry, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<CommissionEntry | null>;
  list(companyId: string, opts?: CommissionEntryListOptions): Promise<CommissionEntry[]>;
  /** Find any existing accrual for a given source — idempotent re-accrual guard */
  findBySource(
    companyId: string,
    sourceType: string,
    sourceId: string
  ): Promise<CommissionEntry | null>;
  /** Sum of commissionAmountBase grouped by status for a salesperson */
  totalsBySalesperson(
    companyId: string,
    salespersonId: string
  ): Promise<{ accrued: number; paid: number; cancelled: number }>;
}
