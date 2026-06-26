import { randomUUID } from 'crypto';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseReturnRepository } from '../../../repository/interfaces/purchases/IPurchaseReturnRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesReturnRepository } from '../../../repository/interfaces/sales/ISalesReturnRepository';
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
  priceIsInclusive?: boolean;
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
  priceIsInclusive?: boolean;
  active?: boolean;
}

export interface ListTaxCodesFilters {
  scope?: TaxScope;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaxCodeUsageRepositories {
  salesInvoiceRepo?: ISalesInvoiceRepository;
  purchaseInvoiceRepo?: IPurchaseInvoiceRepository;
  salesReturnRepo?: ISalesReturnRepository;
  purchaseReturnRepo?: IPurchaseReturnRepository;
}

export interface TaxCodeWithUsage {
  taxCode: TaxCode;
  usedInPostedDocuments: boolean;
  lockedFields: string[];
}

const TAX_CODE_LOCKED_FIELDS = [
  'code',
  'rate',
  'taxType',
  'scope',
  'purchaseTaxAccountId',
  'salesTaxAccountId',
  'priceIsInclusive',
];

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

const documentUsesTaxCode = (document: any, taxCodeId: string): boolean => {
  const lines = Array.isArray(document?.lines) ? document.lines : [];
  const charges = Array.isArray(document?.charges) ? document.charges : [];
  return [...lines, ...charges].some((line) => line?.taxCodeId === taxCodeId);
};

const hasPostedTaxCodeUsage = async (
  companyId: string,
  taxCodeId: string,
  usageRepos?: TaxCodeUsageRepositories
): Promise<boolean> => {
  if (!usageRepos) return false;

  const [
    postedSalesInvoices,
    postedPurchaseInvoices,
    postedSalesReturns,
    postedPurchaseReturns,
  ] = await Promise.all([
    usageRepos.salesInvoiceRepo?.list(companyId, { status: 'POSTED' }) ?? Promise.resolve([]),
    usageRepos.purchaseInvoiceRepo?.list(companyId, { status: 'POSTED' }) ?? Promise.resolve([]),
    usageRepos.salesReturnRepo?.list(companyId, { status: 'POSTED' }) ?? Promise.resolve([]),
    usageRepos.purchaseReturnRepo?.list(companyId, { status: 'POSTED' }) ?? Promise.resolve([]),
  ]);

  return [
    ...postedSalesInvoices,
    ...postedPurchaseInvoices,
    ...postedSalesReturns,
    ...postedPurchaseReturns,
  ].some((document) => documentUsesTaxCode(document, taxCodeId));
};

const toUsageResult = (taxCode: TaxCode, usedInPostedDocuments: boolean): TaxCodeWithUsage => ({
  taxCode,
  usedInPostedDocuments,
  lockedFields: usedInPostedDocuments ? [...TAX_CODE_LOCKED_FIELDS] : [],
});

const fieldChanged = (next: unknown, current: unknown): boolean => {
  if (next === undefined) return false;
  return next !== current;
};

export class CreateTaxCodeUseCase {
  constructor(
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: CreateTaxCodeInput): Promise<TaxCode> {
    const existing = await this.taxCodeRepo.getByCode(input.companyId, input.code);
    if (existing) {
      throw new BusinessError(ErrorCode.VAL_DUPLICATE_ENTRY, `TaxCode code already exists: ${input.code}`, { field: 'code', code: input.code });
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
      priceIsInclusive: input.priceIsInclusive === true,
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
  constructor(
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly usageRepos?: TaxCodeUsageRepositories
  ) {}

  async execute(input: UpdateTaxCodeInput): Promise<TaxCode> {
    const existing = await this.taxCodeRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`TaxCode not found: ${input.id}`);
    }

    const taxType = input.taxType ?? existing.taxType;
    const rate = input.rate ?? existing.rate;
    validateRateConsistency(taxType, rate);

    const usedInPostedDocuments = await hasPostedTaxCodeUsage(input.companyId, existing.id, this.usageRepos);
    if (usedInPostedDocuments) {
      const lockedChanges = [
        fieldChanged(input.code, existing.code) ? 'code' : undefined,
        fieldChanged(input.rate, existing.rate) ? 'rate' : undefined,
        fieldChanged(input.taxType, existing.taxType) ? 'taxType' : undefined,
        fieldChanged(input.scope, existing.scope) ? 'scope' : undefined,
        fieldChanged(input.purchaseTaxAccountId, existing.purchaseTaxAccountId) ? 'purchaseTaxAccountId' : undefined,
        fieldChanged(input.salesTaxAccountId, existing.salesTaxAccountId) ? 'salesTaxAccountId' : undefined,
        fieldChanged(input.priceIsInclusive, existing.priceIsInclusive) ? 'priceIsInclusive' : undefined,
      ].filter(Boolean);

      if (lockedChanges.length > 0) {
        throw new BusinessError(
          ErrorCode.VAL_INVALID_TYPE,
          'This tax code is used in posted documents. Create a new tax code to change tax treatment.',
          { taxCodeId: existing.id, lockedFields: lockedChanges }
        );
      }
    }

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
      priceIsInclusive:
        input.priceIsInclusive !== undefined ? input.priceIsInclusive === true : existing.priceIsInclusive,
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
  constructor(
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly usageRepos?: TaxCodeUsageRepositories
  ) {}

  async execute(companyId: string, filters: ListTaxCodesFilters = {}): Promise<TaxCodeWithUsage[]> {
    let taxCodes: TaxCode[];
    if (filters.scope === 'PURCHASE') {
      const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
      const filtered = all.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH');
      taxCodes = applyOffsetLimit(filtered, filters.offset, filters.limit);
    } else if (filters.scope === 'SALES') {
      const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
      const filtered = all.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH');
      taxCodes = applyOffsetLimit(filtered, filters.offset, filters.limit);
    } else {
      taxCodes = await this.taxCodeRepo.list(companyId, {
        scope: filters.scope,
        active: filters.active,
        limit: filters.limit,
        offset: filters.offset,
      });
    }

    return Promise.all(
      taxCodes.map(async (taxCode) =>
        toUsageResult(taxCode, await hasPostedTaxCodeUsage(companyId, taxCode.id, this.usageRepos))
      )
    );
  }
}

export class GetTaxCodeUseCase {
  constructor(
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly usageRepos?: TaxCodeUsageRepositories
  ) {}

  async execute(companyId: string, id: string): Promise<TaxCodeWithUsage> {
    const taxCode = await this.taxCodeRepo.getById(companyId, id);
    if (!taxCode) {
      throw new Error(`TaxCode not found: ${id}`);
    }

    return toUsageResult(taxCode, await hasPostedTaxCodeUsage(companyId, taxCode.id, this.usageRepos));
  }
}
