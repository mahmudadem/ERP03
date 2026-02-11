import { VoucherSequence } from '../../../domain/accounting/entities/VoucherSequence';

export interface IVoucherSequenceRepository {
  getNextNumber(companyId: string, prefix: string, year?: number, format?: string): Promise<string>;
  getCurrentSequence(companyId: string, prefix: string, year?: number): Promise<VoucherSequence | null>;
  setNextNumber(companyId: string, prefix: string, nextNumber: number, year?: number, format?: string): Promise<void>;
  listSequences(companyId: string): Promise<VoucherSequence[]>;
}
