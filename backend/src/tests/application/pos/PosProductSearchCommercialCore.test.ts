import { SearchPosProductsUseCase } from '../../../application/pos/use-cases/PosBootstrapUseCase';

const item = {
  id: 'item_1',
  code: 'SKU-1',
  barcode: '123',
  name: 'Item One',
  type: 'PRODUCT',
  trackInventory: true,
  baseUom: 'EA',
  salesUomId: 'uom_ea',
  defaultSalesTaxCodeId: 'tax_1',
  salePrice: 10,
};

describe('SearchPosProductsUseCase commercial pricing', () => {
  it('250l-1 uses Commercial Core resolved price for POS product search', async () => {
    const itemRepo = {
      searchItems: jest.fn().mockResolvedValue([item]),
    };
    const commercialCore = {
      resolvePrice: jest.fn().mockResolvedValue(8.5),
    };
    const useCase = new SearchPosProductsUseCase(itemRepo as any, commercialCore as any);

    const result = await useCase.execute({ companyId: 'cmp_1', query: 'SKU' });

    expect(commercialCore.resolvePrice).toHaveBeenCalledWith({
      companyId: 'cmp_1',
      itemId: 'item_1',
      channel: 'pos',
      uomId: 'uom_ea',
    });
    expect(result.items[0].salePrice).toBe(8.5);
  });

  it('250l-1 falls back to item salePrice when Commercial Core has no price', async () => {
    const itemRepo = {
      searchItems: jest.fn().mockResolvedValue([item]),
    };
    const commercialCore = {
      resolvePrice: jest.fn().mockResolvedValue(null),
    };
    const useCase = new SearchPosProductsUseCase(itemRepo as any, commercialCore as any);

    const result = await useCase.execute({ companyId: 'cmp_1', query: 'SKU' });

    expect(result.items[0].salePrice).toBe(10);
  });
});
