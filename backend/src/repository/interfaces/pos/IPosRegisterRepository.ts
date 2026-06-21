import { PosRegister } from '../../../domain/pos/entities/PosRegister';

/**
 * Persistence contract for POS registers (till definitions).
 * All reads are tenant-scoped by `(companyId, id)`.
 */
export interface IPosRegisterRepository {
  create(register: PosRegister, tx?: unknown): Promise<void>;
  update(register: PosRegister, tx?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PosRegister | null>;
  list(companyId: string): Promise<PosRegister[]>;
}
