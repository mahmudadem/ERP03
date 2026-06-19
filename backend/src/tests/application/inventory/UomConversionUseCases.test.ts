import { Uom } from '../../../domain/inventory/entities/Uom';
import { UomConversion } from '../../../domain/inventory/entities/UomConversion';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IUomRepository } from '../../../repository/interfaces/inventory/IUomRepository';
import { ManageUomConversionsUseCase } from '../../../application/inventory/use-cases/UomConversionUseCases';

const companyId = 'company-1';
const itemId = 'item-1';

const makeUom = (id: string, code: string): Uom => new Uom({
  id,
  companyId,
  code,
  name: code,
  dimension: 'COUNT',
  decimalPlaces: 0,
  active: true,
  isSystem: false,
  createdBy: 'test',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

const makeConversion = (overrides: Partial<UomConversion> = {}): UomConversion => new UomConversion({
  id: overrides.id || 'conversion-1',
  companyId: overrides.companyId || companyId,
  itemId: overrides.itemId || itemId,
  fromUomId: overrides.fromUomId || 'uom-box',
  fromUom: overrides.fromUom || 'BOX',
  toUomId: overrides.toUomId || 'uom-pcs',
  toUom: overrides.toUom || 'PCS',
  factor: overrides.factor || 12,
  active: overrides.active ?? true,
});

const buildUseCase = (conversions: UomConversion[] = []) => {
  const uoms = new Map([
    ['uom-box', makeUom('uom-box', 'BOX')],
    ['uom-pcs', makeUom('uom-pcs', 'PCS')],
    ['uom-case', makeUom('uom-case', 'CASE')],
  ]);

  const repo: jest.Mocked<IUomConversionRepository> = {
    createConversion: jest.fn(),
    updateConversion: jest.fn(),
    getConversion: jest.fn(async (id: string) => conversions.find((entry) => entry.id === id) || null),
    getConversionsForItem: jest.fn(async (_companyId: string, _itemId: string, opts?: { active?: boolean }) => (
      conversions.filter((entry) => opts?.active === undefined || entry.active === opts.active)
    )),
    getCompanyConversions: jest.fn(),
    deleteConversion: jest.fn(),
  };

  const uomRepo: jest.Mocked<IUomRepository> = {
    createUom: jest.fn(),
    updateUom: jest.fn(),
    getUom: jest.fn(async (id: string) => uoms.get(id) || null),
    getCompanyUoms: jest.fn(),
    getUomByCode: jest.fn(async (_companyId: string, code: string) => (
      Array.from(uoms.values()).find((uom) => uom.code === code.toUpperCase()) || null
    )),
  };

  return {
    repo,
    useCase: new ManageUomConversionsUseCase(repo, uomRepo),
  };
};

describe('ManageUomConversionsUseCase', () => {
  it('blocks creating a second active conversion for the same item From-To pair', async () => {
    const { repo, useCase } = buildUseCase([makeConversion()]);

    await expect(useCase.create({
      companyId,
      itemId,
      fromUomId: 'uom-box',
      fromUom: 'BOX',
      toUomId: 'uom-pcs',
      toUom: 'PCS',
      factor: 24,
    })).rejects.toThrow('already exists');

    expect(repo.createConversion).not.toHaveBeenCalled();
  });

  it('allows recreating a pair after the previous conversion was deactivated', async () => {
    const { repo, useCase } = buildUseCase([makeConversion({ active: false })]);

    const created = await useCase.create({
      companyId,
      itemId,
      fromUomId: 'uom-box',
      fromUom: 'BOX',
      toUomId: 'uom-pcs',
      toUom: 'PCS',
      factor: 24,
    });

    expect(created.factor).toBe(24);
    expect(repo.createConversion).toHaveBeenCalledTimes(1);
  });

  it('blocks updating a conversion into another active pair on the same item', async () => {
    const current = makeConversion({
      id: 'conversion-1',
      fromUomId: 'uom-case',
      fromUom: 'CASE',
      toUomId: 'uom-pcs',
      toUom: 'PCS',
      factor: 6,
    });
    const existing = makeConversion({ id: 'conversion-2' });
    const { repo, useCase } = buildUseCase([current, existing]);

    await expect(useCase.update('conversion-1', {
      fromUomId: 'uom-box',
      fromUom: 'BOX',
      toUomId: 'uom-pcs',
      toUom: 'PCS',
    } as Partial<UomConversion>)).rejects.toThrow('already exists');

    expect(repo.updateConversion).not.toHaveBeenCalled();
  });
});
