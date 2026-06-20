import { randomUUID } from 'crypto';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';

export interface UpsertPosRegisterInput {
  id?: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  cashDrawerAccountId: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export class CreatePosRegisterUseCase {
  constructor(private readonly repo: IPosRegisterRepository) {}

  async execute(input: UpsertPosRegisterInput): Promise<PosRegister> {
    const now = new Date();
    const register = new PosRegister({
      id: input.id || `reg_${randomUUID()}`,
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      cashDrawerAccountId: input.cashDrawerAccountId,
      status: input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.create(register);
    return register;
  }
}

export class UpdatePosRegisterUseCase {
  constructor(private readonly repo: IPosRegisterRepository) {}

  async execute(companyId: string, id: string, patch: Partial<UpsertPosRegisterInput>): Promise<PosRegister> {
    const existing = await this.repo.getById(companyId, id);
    if (!existing) throw new Error(`POS register not found: ${id}`);
    if (patch.code !== undefined) existing.code = patch.code;
    if (patch.name !== undefined) existing.name = patch.name;
    if (patch.branchId !== undefined) existing.branchId = patch.branchId?.trim() || undefined;
    if (patch.warehouseId !== undefined) existing.warehouseId = patch.warehouseId;
    if (patch.cashDrawerAccountId !== undefined) existing.cashDrawerAccountId = patch.cashDrawerAccountId;
    if (patch.status !== undefined) existing.status = patch.status;
    existing.updatedAt = new Date();
    await this.repo.update(existing);
    return existing;
  }
}

export class ListPosRegistersUseCase {
  constructor(private readonly repo: IPosRegisterRepository) {}
  async execute(companyId: string): Promise<PosRegister[]> {
    return this.repo.list(companyId);
  }
}

export class GetPosRegisterUseCase {
  constructor(private readonly repo: IPosRegisterRepository) {}
  async execute(companyId: string, id: string): Promise<PosRegister | null> {
    return this.repo.getById(companyId, id);
  }
}
