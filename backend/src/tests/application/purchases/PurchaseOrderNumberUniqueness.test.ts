import { CreatePurchaseOrderUseCase } from '../../../application/purchases/use-cases/PurchaseOrderUseCases';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';

describe('CreatePurchaseOrderUseCase - order number uniqueness', () => {
  it('skips an already-used order number and reserves the next one', async () => {
    const companyId = 'company-1';
    const settings = PurchaseSettings.createDefault(companyId);
    settings.poNumberPrefix = 'PO';
    settings.poNumberNextSeq = 1;

    const settingsRepo = {
      getSettings: jest.fn(async () => settings),
      saveSettings: jest.fn(async () => undefined),
    } as any;

    const createdOrders: any[] = [];
    const purchaseOrderRepo = {
      create: jest.fn(async (po: any) => {
        createdOrders.push(po);
      }),
      update: jest.fn(),
      getById: jest.fn(),
      getByNumber: jest
        .fn()
        .mockResolvedValueOnce({ id: 'existing-po-1' })
        .mockResolvedValueOnce(null),
      list: jest.fn(),
      delete: jest.fn(),
    } as any;

    const partyRepo = {
      getById: jest.fn(async () => ({
        id: 'vendor-1',
        displayName: 'Vendor 1',
        roles: ['VENDOR'],
      })),
    } as any;

    const itemRepo = {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        code: 'IT-1',
        name: 'Item 1',
        type: 'PRODUCT',
        trackInventory: true,
        purchaseUom: 'PCS',
        baseUom: 'PCS',
      })),
    } as any;

    const taxCodeRepo = {
      getById: jest.fn(),
    } as any;

    const companyCurrencyRepo = {
      isEnabled: jest.fn(async () => true),
    } as any;

    const useCase = new CreatePurchaseOrderUseCase(
      settingsRepo,
      purchaseOrderRepo,
      partyRepo,
      itemRepo,
      taxCodeRepo,
      companyCurrencyRepo
    );

    await useCase.execute({
      companyId,
      vendorId: 'vendor-1',
      orderDate: '2026-04-07',
      currency: 'USD',
      exchangeRate: 800,
      lines: [
        {
          itemId: 'item-1',
          orderedQty: 1,
          unitPriceDoc: 100,
        },
      ],
      createdBy: 'tester',
    });

    expect(purchaseOrderRepo.getByNumber).toHaveBeenNthCalledWith(1, companyId, 'PO-00001');
    expect(purchaseOrderRepo.getByNumber).toHaveBeenNthCalledWith(2, companyId, 'PO-00002');
    expect(createdOrders).toHaveLength(1);
    expect(createdOrders[0].orderNumber).toBe('PO-00002');
    expect(settings.poNumberNextSeq).toBe(3);
  });
});

