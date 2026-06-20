import { PosReturn } from '../../../domain/pos/entities/PosReturn';

export interface IPosReturnRepository {
  create(returnDoc: PosReturn, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosReturn | null>;
  list(companyId: string, filters?: { shiftId?: string; originalReceiptId?: string; limit?: number }): Promise<PosReturn[]>;
}
