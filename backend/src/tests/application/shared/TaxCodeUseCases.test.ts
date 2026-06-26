import { describe, expect, it } from '@jest/globals';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';
import {
  ListTaxCodesUseCase,
  UpdateTaxCodeUseCase,
} from '../../../application/shared/use-cases/TaxCodeUseCases';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';

const COMPANY_ID = 'cmp-tax-lock';

const makeTaxCode = (overrides: Partial<ConstructorParameters<typeof TaxCode>[0]> = {}) =>
  new TaxCode({
    id: 'tax-10',
    companyId: COMPANY_ID,
    code: 'VAT10',
    name: 'VAT 10%',
    rate: 0.1,
    taxType: 'VAT',
    scope: 'BOTH',
    purchaseTaxAccountId: 'tax-purchase',
    salesTaxAccountId: 'tax-sales',
    priceIsInclusive: false,
    active: true,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

class FakeTaxCodeRepository implements ITaxCodeRepository {
  constructor(private taxCodes: TaxCode[]) {}

  async create(taxCode: TaxCode): Promise<void> {
    this.taxCodes.push(taxCode);
  }

  async update(taxCode: TaxCode): Promise<void> {
    const index = this.taxCodes.findIndex((candidate) => candidate.id === taxCode.id);
    if (index >= 0) this.taxCodes[index] = taxCode;
  }

  async getById(companyId: string, id: string): Promise<TaxCode | null> {
    return this.taxCodes.find((taxCode) => taxCode.companyId === companyId && taxCode.id === id) || null;
  }

  async getByCode(companyId: string, code: string): Promise<TaxCode | null> {
    return this.taxCodes.find((taxCode) => taxCode.companyId === companyId && taxCode.code === code) || null;
  }

  async list(companyId: string): Promise<TaxCode[]> {
    return this.taxCodes.filter((taxCode) => taxCode.companyId === companyId);
  }
}

const postedDocumentRepo = (documents: any[]) => ({
  list: async (_companyId: string, opts?: { status?: string }) =>
    documents.filter((document) => !opts?.status || document.status === opts.status),
});

describe('TaxCodeUseCases accounting locks', () => {
  it('allows unused tax code rate and price-basis changes', async () => {
    const repo = new FakeTaxCodeRepository([makeTaxCode()]);
    const useCase = new UpdateTaxCodeUseCase(repo, {
      salesInvoiceRepo: postedDocumentRepo([]) as any,
      purchaseInvoiceRepo: postedDocumentRepo([]) as any,
    });

    const updated = await useCase.execute({
      companyId: COMPANY_ID,
      id: 'tax-10',
      rate: 0.2,
      priceIsInclusive: true,
    });

    expect(updated.rate).toBe(0.2);
    expect(updated.priceIsInclusive).toBe(true);
  });

  it('rejects rate changes when a posted sales invoice references the tax code', async () => {
    const repo = new FakeTaxCodeRepository([makeTaxCode()]);
    const useCase = new UpdateTaxCodeUseCase(repo, {
      salesInvoiceRepo: postedDocumentRepo([
        { status: 'POSTED', lines: [{ taxCodeId: 'tax-10' }] },
      ]) as any,
    });

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        id: 'tax-10',
        rate: 0.2,
      })
    ).rejects.toThrow('This tax code is used in posted documents');
  });

  it('rejects price-basis changes when a posted purchase invoice references the tax code', async () => {
    const repo = new FakeTaxCodeRepository([makeTaxCode()]);
    const useCase = new UpdateTaxCodeUseCase(repo, {
      purchaseInvoiceRepo: postedDocumentRepo([
        { status: 'POSTED', lines: [{ taxCodeId: 'tax-10' }] },
      ]) as any,
    });

    await expect(
      useCase.execute({
        companyId: COMPANY_ID,
        id: 'tax-10',
        priceIsInclusive: true,
      })
    ).rejects.toThrow('This tax code is used in posted documents');
  });

  it('allows safe display/status changes when a posted document references the tax code', async () => {
    const repo = new FakeTaxCodeRepository([makeTaxCode()]);
    const useCase = new UpdateTaxCodeUseCase(repo, {
      salesReturnRepo: postedDocumentRepo([
        { status: 'POSTED', lines: [{ taxCodeId: 'tax-10' }] },
      ]) as any,
    });

    const updated = await useCase.execute({
      companyId: COMPANY_ID,
      id: 'tax-10',
      name: 'VAT 10% archived',
      active: false,
    });

    expect(updated.name).toBe('VAT 10% archived');
    expect(updated.active).toBe(false);
    expect(updated.rate).toBe(0.1);
  });

  it('marks listed tax codes as locked when posted usage exists', async () => {
    const repo = new FakeTaxCodeRepository([makeTaxCode()]);
    const useCase = new ListTaxCodesUseCase(repo, {
      purchaseReturnRepo: postedDocumentRepo([
        { status: 'POSTED', lines: [{ taxCodeId: 'tax-10' }] },
      ]) as any,
    });

    const [result] = await useCase.execute(COMPANY_ID);

    expect(result.usedInPostedDocuments).toBe(true);
    expect(result.lockedFields).toEqual(expect.arrayContaining(['rate', 'priceIsInclusive']));
  });
});
