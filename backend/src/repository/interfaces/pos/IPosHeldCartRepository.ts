import { PosHeldCart, PosHeldCartStatus } from '../../../domain/pos/entities/PosHeldCart';

export interface IPosHeldCartRepository {
  create(cart: PosHeldCart, tx?: unknown): Promise<void>;
  update(cart: PosHeldCart, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosHeldCart | null>;
  list(companyId: string, filters?: {
    registerId?: string;
    shiftId?: string;
    cashierUserId?: string;
    status?: PosHeldCartStatus;
    limit?: number;
  }): Promise<PosHeldCart[]>;
}
