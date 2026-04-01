import { randomUUID } from 'crypto';
import { UomConversion } from '../../../domain/inventory/entities/UomConversion';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';

export interface CreateUomConversionInput {
  companyId: string;
  itemId: string;
  fromUom: string;
  toUom: string;
  factor: number;
}

export class ManageUomConversionsUseCase {
  constructor(private readonly repo: IUomConversionRepository) {}

  async create(input: CreateUomConversionInput): Promise<UomConversion> {
    const conversion = new UomConversion({
      id: randomUUID(),
      companyId: input.companyId,
      itemId: input.itemId,
      fromUom: input.fromUom,
      toUom: input.toUom,
      factor: input.factor,
      active: true,
    });

    await this.repo.createConversion(conversion);
    return conversion;
  }

  async update(id: string, data: Partial<UomConversion>): Promise<UomConversion> {
    await this.repo.updateConversion(id, data);
    const updated = await this.repo.getConversion(id);
    if (!updated) throw new Error(`UoM conversion not found: ${id}`);
    return updated;
  }

  async listForItem(companyId: string, itemId: string): Promise<UomConversion[]> {
    return this.repo.getConversionsForItem(companyId, itemId);
  }

  async get(id: string): Promise<UomConversion | null> {
    return this.repo.getConversion(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.updateConversion(id, { active: false } as Partial<UomConversion>);
  }
}
