import { PosShift } from '../../../domain/pos/entities/PosShift';

/**
 * Persistence contract for POS shifts (cashier sessions).
 * `getOpenShiftForRegister` is the gate that enforces "one OPEN shift per register".
 */
export interface IPosShiftRepository {
  create(shift: PosShift, tx?: unknown): Promise<void>;
  update(shift: PosShift, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosShift | null>;
  getOpenShiftForRegister(companyId: string, registerId: string): Promise<PosShift | null>;
  getOpenShiftForCashier(companyId: string, cashierUserId: string): Promise<PosShift | null>;
  list(companyId: string, filters?: { registerId?: string; status?: string; limit?: number }): Promise<PosShift[]>;
}
