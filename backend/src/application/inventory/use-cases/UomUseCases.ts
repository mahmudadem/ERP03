import { randomUUID } from 'crypto';
import { Uom, UomDimension } from '../../../domain/inventory/entities/Uom';
import { IUomRepository, UomListOptions } from '../../../repository/interfaces/inventory/IUomRepository';

export interface CreateUomInput {
  companyId: string;
  code: string;
  name: string;
  dimension: UomDimension;
  decimalPlaces?: number;
  active?: boolean;
  createdBy: string;
}

export class CreateUomUseCase {
  constructor(private readonly repo: IUomRepository) {}

  async execute(input: CreateUomInput): Promise<Uom> {
    const existing = await this.repo.getUomByCode(input.companyId, input.code);
    if (existing) {
      throw new Error(`UOM code already exists: ${input.code}`);
    }

    const now = new Date();
    const uom = new Uom({
      id: randomUUID(),
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      dimension: input.dimension,
      decimalPlaces: input.decimalPlaces ?? 0,
      active: input.active ?? true,
      isSystem: false,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.createUom(uom);
    return uom;
  }
}

export class UpdateUomUseCase {
  constructor(private readonly repo: IUomRepository) {}

  async execute(id: string, data: Partial<Uom>): Promise<Uom> {
    const current = await this.repo.getUom(id);
    if (!current) throw new Error(`UOM not found: ${id}`);

    if (data.code && data.code.toUpperCase().trim() !== current.code) {
      const existing = await this.repo.getUomByCode(current.companyId, data.code);
      if (existing && existing.id !== id) {
        throw new Error(`UOM code already exists: ${data.code}`);
      }
    }

    await this.repo.updateUom(id, {
      ...data,
      updatedAt: new Date(),
    });

    const updated = await this.repo.getUom(id);
    if (!updated) throw new Error(`UOM not found after update: ${id}`);
    return updated;
  }
}

export class GetUomUseCase {
  constructor(private readonly repo: IUomRepository) {}

  async execute(id: string): Promise<Uom | null> {
    return this.repo.getUom(id);
  }
}

export class ListUomsUseCase {
  constructor(private readonly repo: IUomRepository) {}

  async execute(companyId: string, filters: UomListOptions = {}): Promise<Uom[]> {
    return this.repo.getCompanyUoms(companyId, filters);
  }
}
