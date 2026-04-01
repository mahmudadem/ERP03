import { randomUUID } from 'crypto';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { TaxCode, TaxScope, TaxType } from '../../../domain/shared/entities/TaxCode';

export interface CreateTaxCodeInput {
  companyId: string;
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId?: string;
  salesTaxAccountId?: string;
  createdBy: string;
}

export interface UpdateTaxCodeInput {
  companyId: string;
  id: string;
  code?: string;
  name?: string;
  rate?: number;
  taxType?: TaxType;
  scope?: TaxScope;
  purchaseTaxAccountId?: string;
  salesTaxAccountId?: string;
  active?: boolean;
}

export interface ListTaxCodesFilters {
  scope?: TaxScope;
  active?: boolean;
  limit?: number;
  offset?: number;
}

const validateRateConsistency = (taxType: TaxType, rate: number) => {
  if (rate < 0 || Number.isNaN(rate)) {
    throw new Error('TaxCode rate must be greater than or equal to 0');
  }

  if ((taxType === 'EXEMPT' || taxType === 'ZERO_RATED') && rate !== 0) {
    throw new Error(`TaxCode rate must be 0 when taxType is ${taxType}`);
  }
};

const applyOffsetLimit = <T>(list: T[], offset?: number, limit?: number): T[] => {
  const from = Math.max(0, offset || 0);
  const sliced = list.slice(from);
  if (!limit || limit < 0) return sliced;
  return sliced.slice(0, limit);
};

export class CreateTaxCodeUseCase {
  constructor(
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: CreateTaxCodeInput): Promise<TaxCode> {
    const existing = await this.taxCodeRepo.getByCode(input.companyId, input.code);
    if (existing) {
      throw new Error(`TaxCode code already exists: ${input.code}`);
    }

    validateRateConsistency(input.taxType, input.rate);

    if (input.purchaseTaxAccountId) {
      const purchaseTaxAccount = await this.accountRepo.getById(input.companyId, input.purchaseTaxAccountId);
      if (!purchaseTaxAccount) {
        throw new Error(`Purchase tax account not found: ${input.purchaseTaxAccountId}`);
      }
    }

    if (input.salesTaxAccountId) {
      const salesTaxAccount = await this.accountRepo.getById(input.companyId, input.salesTaxAccountId);
      if (!salesTaxAccount) {
        throw new Error(`Sales tax account not found: ${input.salesTaxAccountId}`);
      }
    }

    const now = new Date();
    const taxCode = new TaxCode({
      id: randomUUID(),
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      rate: input.rate,
      taxType: input.taxType,
      scope: input.scope,
      purchaseTaxAccountId: input.purchaseTaxAccountId,
      salesTaxAccountId: input.salesTaxAccountId,
      active: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.taxCodeRepo.create(taxCode);
    return taxCode;
  }
}

export class UpdateTaxCodeUseCase {
  constructor(private readonly taxCodeRepo: ITaxCodeRepository) {}

  async execute(input: UpdateTaxCodeInput): Promise<TaxCode> {
    const existing = await this.taxCodeRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`TaxCode not found: ${input.id}`);
    }

    const taxType = input.taxType ?? existing.taxType;
    const rate = input.rate ?? existing.rate;
    validateRateConsistency(taxType, rate);

    const updated = new TaxCode({
      id: existing.id,
      companyId: existing.companyId,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      rate,
      taxType,
      scope: input.scope ?? existing.scope,
      purchaseTaxAccountId: input.purchaseTaxAccountId ?? existing.purchaseTaxAccountId,
      salesTaxAccountId: input.salesTaxAccountId ?? existing.salesTaxAccountId,
      active: input.active ?? existing.active,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    await this.taxCodeRepo.update(updated);
    return updated;
  }
}

export class ListTaxCodesUseCase {
  constructor(private readonly taxCodeRepo: ITaxCodeRepository) {}

  async execute(companyId: string, filters: ListTaxCodesFilters = {}): Promise<TaxCode[]> {
    if (filters.scope === 'PURCHASE') {
      const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
      const filtered = all.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH');
      return applyOffsetLimit(filtered, filters.offset, filters.limit);
    }

    if (filters.scope === 'SALES') {
      const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
      const filtered = all.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH');
      return applyOffsetLimit(filtered, filters.offset, filters.limit);
    }

    return this.taxCodeRepo.list(companyId, {
      scope: filters.scope,
      active: filters.active,
      limit: filters.limit,
      offset: filters.offset,
    });
  }
}

export class GetTaxCodeUseCase {
  constructor(private readonly taxCodeRepo: ITaxCodeRepository) {}

  async execute(companyId: string, id: string): Promise<TaxCode> {
    const taxCode = await this.taxCodeRepo.getById(companyId, id);
    if (!taxCode) {
      throw new Error(`TaxCode not found: ${id}`);
    }

    return taxCode;
  }
}
