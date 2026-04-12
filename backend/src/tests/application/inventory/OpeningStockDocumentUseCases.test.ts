import { OpeningStockDocument } from '../../../domain/inventory/entities/OpeningStockDocument';
import { PostOpeningStockDocumentUseCase } from '../../../application/inventory/use-cases/OpeningStockDocumentUseCases';

describe('PostOpeningStockDocumentUseCase', () => {
  const COMPANY_ID = 'cmp-1';
  const USER_ID = 'u-1';

  const makeDocument = (overrides: Partial<OpeningStockDocument> = {}) =>
    new OpeningStockDocument({
      id: 'osd-1',
      companyId: COMPANY_ID,
      warehouseId: 'wh-1',
      date: '2026-04-10',
      notes: 'migration batch',
      lines: [
        {
          lineId: 'line-1',
          itemId: 'item-1',
          quantity: 5,
          unitCostInMoveCurrency: 10,
          moveCurrency: 'USD',
          fxRateMovToBase: 1,
          fxRateCCYToBase: 1,
          unitCostBase: 10,
          totalValueBase: 50,
        },
      ],
      status: 'DRAFT',
      createAccountingEffect: true,
      openingBalanceAccountId: 'OPEN-100',
      totalValueBase: 50,
      createdBy: USER_ID,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      ...((overrides as any) || {}),
    });

  it('posts inventory and accounting in one transaction context', async () => {
    const document = makeDocument();
    const posted = makeDocument({
      status: 'POSTED',
      voucherId: 'vch-1',
      postedAt: new Date('2026-04-10T01:00:00.000Z'),
    });

    const documentRepo = {
      getDocument: jest.fn().mockResolvedValueOnce(document).mockResolvedValueOnce(posted),
      updateDocument: jest.fn(async () => undefined),
    };
    const itemRepo = {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        companyId: COMPANY_ID,
        code: 'ITEM-1',
        name: 'Tracked Item',
        type: 'PRODUCT',
        trackInventory: true,
        active: true,
        inventoryAssetAccountId: 'INV-100',
      })),
    };
    const itemCategoryRepo = {
      getCompanyCategories: jest.fn(async () => []),
    };
    const warehouseRepo = {
      getWarehouse: jest.fn(async () => ({
        id: 'wh-1',
        companyId: COMPANY_ID,
        code: 'MAIN',
        active: true,
      })),
    };
    const inventorySettingsRepo = {
      getSettings: jest.fn(async () => ({
        defaultInventoryAssetAccountId: 'INV-999',
      })),
    };
    const companyRepo = {
      findById: jest.fn(async () => ({
        id: COMPANY_ID,
        baseCurrency: 'USD',
      })),
    };
    const companyModuleRepo = {
      get: jest.fn(async () => ({
        initialized: true,
      })),
    };
    const accountRepo = {
      getById: jest.fn(async (_companyId: string, accountId: string) => ({
        id: accountId,
        accountRole: 'POSTING',
        status: 'ACTIVE',
      })),
    };
    const movementUseCase = {
      processIN: jest.fn(async () => undefined),
    };
    const accountingPostingService = {
      postInTransaction: jest.fn(async () => ({ id: 'vch-1' })),
    };
    const txn = { id: 'txn-1' };
    const transactionManager = {
      runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation(txn)),
    };

    const useCase = new PostOpeningStockDocumentUseCase(
      documentRepo as any,
      itemRepo as any,
      itemCategoryRepo as any,
      warehouseRepo as any,
      inventorySettingsRepo as any,
      companyRepo as any,
      companyModuleRepo as any,
      accountRepo as any,
      movementUseCase as any,
      accountingPostingService as any,
      transactionManager as any
    );

    const result = await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(result.status).toBe('POSTED');
    expect(transactionManager.runTransaction).toHaveBeenCalledTimes(1);
    expect(movementUseCase.processIN).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_ID,
        refs: expect.objectContaining({ type: 'OPENING', docId: document.id, lineId: 'line-1' }),
        transaction: txn,
      })
    );
    expect(accountingPostingService.postInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        voucherType: 'opening_balance',
        strategyPayload: expect.objectContaining({
          balances: expect.arrayContaining([
            expect.objectContaining({ accountId: 'INV-100', debitBalance: 50 }),
            expect.objectContaining({ accountId: 'OPEN-100', creditBalance: 50 }),
          ]),
        }),
      }),
      txn
    );
    expect(documentRepo.updateDocument).toHaveBeenCalledWith(
      COMPANY_ID,
      document.id,
      expect.objectContaining({ status: 'POSTED', voucherId: 'vch-1' }),
      txn
    );
  });

  it('posts inventory only when accounting effect is disabled', async () => {
    const document = makeDocument({
      createAccountingEffect: false,
      openingBalanceAccountId: undefined,
    });
    const posted = makeDocument({
      createAccountingEffect: false,
      openingBalanceAccountId: undefined,
      status: 'POSTED',
      postedAt: new Date('2026-04-10T01:00:00.000Z'),
    });

    const documentRepo = {
      getDocument: jest.fn().mockResolvedValueOnce(document).mockResolvedValueOnce(posted),
      updateDocument: jest.fn(async () => undefined),
    };
    const itemRepo = {
      getItem: jest.fn(async () => ({
        id: 'item-1',
        companyId: COMPANY_ID,
        code: 'ITEM-1',
        name: 'Tracked Item',
        type: 'PRODUCT',
        trackInventory: true,
        active: true,
      })),
    };
    const warehouseRepo = {
      getWarehouse: jest.fn(async () => ({
        id: 'wh-1',
        companyId: COMPANY_ID,
        code: 'MAIN',
        active: true,
      })),
    };
    const useCase = new PostOpeningStockDocumentUseCase(
      documentRepo as any,
      itemRepo as any,
      { getCompanyCategories: jest.fn(async () => []) } as any,
      warehouseRepo as any,
      { getSettings: jest.fn(async () => null) } as any,
      { findById: jest.fn(async () => ({ id: COMPANY_ID, baseCurrency: 'USD' })) } as any,
      { get: jest.fn(async () => ({ initialized: false })) } as any,
      { getById: jest.fn(async () => null) } as any,
      { processIN: jest.fn(async () => undefined) } as any,
      { postInTransaction: jest.fn(async () => ({ id: 'vch-1' })) } as any,
      { runTransaction: jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) => operation({ id: 'txn-2' })) } as any
    );

    const result = await useCase.execute(COMPANY_ID, document.id, USER_ID);

    expect(result.status).toBe('POSTED');
    expect(result.voucherId).toBeUndefined();
  });
});
