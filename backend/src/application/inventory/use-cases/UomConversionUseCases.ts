import { randomUUID } from 'crypto';
import { UomConversion } from '../../../domain/inventory/entities/UomConversion';
import { IUomRepository } from '../../../repository/interfaces/inventory/IUomRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';

export interface CreateUomConversionInput {
  companyId: string;
  itemId: string;
  fromUomId?: string;
  fromUom: string;
  toUomId?: string;
  toUom: string;
  factor: number;
}

const trimOrUndefined = (value: any): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const stripUndefined = <T extends Record<string, any>>(value: T): T => {
  Object.keys(value).forEach((key) => {
    if (value[key] === undefined) {
      delete value[key];
    }
  });
  return value;
};

const resolveConversionUom = async (
  companyId: string,
  repo: IUomRepository | undefined,
  fieldName: string,
  uomId?: string,
  uomCode?: string
): Promise<{ uomId?: string; uom: string }> => {
  const normalizedId = trimOrUndefined(uomId);
  const normalizedCode = trimOrUndefined(uomCode)?.toUpperCase();

  if (repo) {
    if (normalizedId) {
      const uom = await repo.getUom(normalizedId);
      if (!uom || uom.companyId !== companyId) {
        throw new Error(`${fieldName} UOM not found: ${normalizedId}`);
      }
      return { uomId: uom.id, uom: uom.code };
    }

    if (normalizedCode) {
      const uom = await repo.getUomByCode(companyId, normalizedCode);
      if (!uom) {
        throw new Error(`${fieldName} UOM not found: ${normalizedCode}`);
      }
      return { uomId: uom.id, uom: uom.code };
    }
  }

  if (!normalizedCode) {
    throw new Error(`${fieldName} UOM is required`);
  }

  return { uomId: normalizedId, uom: normalizedCode };
};

export class ManageUomConversionsUseCase {
  constructor(
    private readonly repo: IUomConversionRepository,
    private readonly uomRepo?: IUomRepository
  ) {}

  async create(input: CreateUomConversionInput): Promise<UomConversion> {
    const from = await resolveConversionUom(input.companyId, this.uomRepo, 'from', input.fromUomId, input.fromUom);
    const to = await resolveConversionUom(input.companyId, this.uomRepo, 'to', input.toUomId, input.toUom);

    const conversion = new UomConversion({
      id: randomUUID(),
      companyId: input.companyId,
      itemId: input.itemId,
      fromUomId: from.uomId,
      fromUom: from.uom,
      toUomId: to.uomId,
      toUom: to.uom,
      factor: input.factor,
      active: true,
    });

    await this.repo.createConversion(conversion);
    return conversion;
  }

  async update(id: string, data: Partial<UomConversion>): Promise<UomConversion> {
    const current = await this.repo.getConversion(id);
    if (!current) throw new Error(`UoM conversion not found: ${id}`);

    const from = (data.fromUom !== undefined || data.fromUomId !== undefined)
      ? await resolveConversionUom(current.companyId, this.uomRepo, 'from', data.fromUomId, data.fromUom)
      : { uomId: current.fromUomId, uom: current.fromUom };
    const to = (data.toUom !== undefined || data.toUomId !== undefined)
      ? await resolveConversionUom(current.companyId, this.uomRepo, 'to', data.toUomId, data.toUom)
      : { uomId: current.toUomId, uom: current.toUom };

    await this.repo.updateConversion(id, stripUndefined({
      ...data,
      fromUomId: from.uomId,
      fromUom: from.uom,
      toUomId: to.uomId,
      toUom: to.uom,
    }));
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
