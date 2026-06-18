import { describe, it, expect, jest } from '@jest/globals';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { NegativeStockError } from '../../../domain/inventory/errors/NegativeStockError';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';

const COMPANY_ID = 'cmp-neg-stock';
const ITEM_ID = 'item-1';
const WH_ID = 'wh-a';
const WH_DEST_ID = 'wh-b';

const makeItem = (): Item =>
  new Item({
    id: ITEM_ID,
    companyId: COMPANY_ID,
    code: 'ITM-1',
    name: 'Item 1',
    type: 'PRODUCT',
    baseUom: 'pcs',
    costCurrency: 'USD',
    costingMethod: 'MOVING_AVG',
    trackInventory: true,
    active: true,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const makeLevel = (qtyOnHand: number, warehouseId: string = WH_ID): StockLevel =>
  new StockLevel({
    id: `${ITEM_ID}-${warehouseId}`,
    companyId: COMPANY_ID,
    itemId: ITEM_ID,
    warehouseId,
    qtyOnHand,
    reservedQty: 0,
    avgCostBase: 10,
    avgCostCCY: 10,
    lastCostBase: 10,
    lastCostCCY: 10,
    postingSeq: 1,
    maxBusinessDate: '2026-01-01',
    totalMovements: 1,
    lastMovementId: '',
    version: 1,
    updatedAt: new Date(),
  });

const buildUseCase = (
  allowNegativeStock: boolean | null,
  costingBasis: 'WAREHOUSE' | 'GLOBAL' = 'WAREHOUSE',
  levelsForGlobal: StockLevel[] = []
) => {
  const writeMovement = jest.fn(async () => undefined);
  const writeLevel = jest.fn(async () => undefined);

  const stockMovementRepository = {
    recordMovement: writeMovement,
  } as any;

  const stockLevelRepository = {
    upsertLevelInTransaction: writeLevel,
    getLevelInTransaction: async () => null,
    getLevelsByItemInTransaction: async () => levelsForGlobal.map((l) => StockLevel.fromJSON(l.toJSON())),
  } as any;

  const inventorySettingsRepository = {
    getSettings: jest.fn(async () =>
      allowNegativeStock === null ? null : ({ allowNegativeStock, costingBasis } as any)
    ),
    saveSettings: jest.fn(),
  } as any;

  const transactionManager = {
    runTransaction: <T,>(fn: (txn: any) => Promise<T>) => fn({}),
  } as any;

  const useCase = new RecordStockMovementUseCase({
    itemRepository: { findById: async () => makeItem(), updateItemInTransaction: async () => {} } as any,
    warehouseRepository: { findById: async () => ({ id: WH_ID }) } as any,
    stockMovementRepository,
    stockLevelRepository,
    companyRepository: { findById: async () => ({ id: COMPANY_ID, baseCurrency: 'USD' }) } as any,
    inventorySettingsRepository,
    transactionManager,
  });

  return { useCase, inventorySettingsRepository, writeMovement, writeLevel };
};

describe('RecordStockMovementUseCase — allowNegativeStock enforcement', () => {
  it('throws NegativeStockError when allowNegativeStock=false and OUT would drive qty negative', async () => {
    const { useCase, inventorySettingsRepository, writeMovement, writeLevel } = buildUseCase(false);
    const preFetchedLevel = makeLevel(5);
    const preFetchedItem = makeItem();

    await expect(
      useCase.processOUT({
        companyId: COMPANY_ID,
        itemId: ITEM_ID,
        warehouseId: WH_ID,
        qty: 10,
        date: '2026-02-01',
        movementType: 'SALES_DELIVERY',
        refs: { type: 'SALES_INVOICE', docId: 'si-1' },
        currentUser: 'user-1',
        preFetchedLevel,
        preFetchedItem,
        skipWarehouseValidation: true,
      })
    ).rejects.toBeInstanceOf(NegativeStockError);

    expect(inventorySettingsRepository.getSettings).toHaveBeenCalledWith(COMPANY_ID);
    expect(writeMovement).not.toHaveBeenCalled();
    expect(writeLevel).not.toHaveBeenCalled();
    expect(preFetchedLevel.qtyOnHand).toBe(5);
  });

  it('allows OUT when allowNegativeStock=true even if it drives qty negative', async () => {
    const { useCase } = buildUseCase(true);
    const preFetchedLevel = makeLevel(5);
    const preFetchedItem = makeItem();

    const movement = await useCase.processOUT({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      warehouseId: WH_ID,
      qty: 10,
      date: '2026-02-01',
      movementType: 'SALES_DELIVERY',
      refs: { type: 'SALES_INVOICE', docId: 'si-1' },
      currentUser: 'user-1',
      preFetchedLevel,
      preFetchedItem,
      skipWarehouseValidation: true,
    });

    expect(movement.qtyAfter).toBe(-5);
    expect(movement.negativeQtyAtPosting).toBe(true);
  });

  it('reads settings exactly once per OUT (resolves costing basis and the negative guard from a single read)', async () => {
    const { useCase, inventorySettingsRepository } = buildUseCase(false);
    const preFetchedLevel = makeLevel(10);
    const preFetchedItem = makeItem();

    const movement = await useCase.processOUT({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      warehouseId: WH_ID,
      qty: 5,
      date: '2026-02-01',
      movementType: 'SALES_DELIVERY',
      refs: { type: 'SALES_INVOICE', docId: 'si-1' },
      currentUser: 'user-1',
      preFetchedLevel,
      preFetchedItem,
      skipWarehouseValidation: true,
    });

    expect(movement.qtyAfter).toBe(5);
    expect(movement.negativeQtyAtPosting).toBe(false);
    // The settings read now drives the costing basis too, so it always happens —
    // but exactly once (the negative-stock guard reuses the same read).
    expect(inventorySettingsRepository.getSettings).toHaveBeenCalledTimes(1);
  });

  it('allows OUT (and does not throw) when settings record is absent', async () => {
    const { useCase, inventorySettingsRepository } = buildUseCase(null);
    const preFetchedLevel = makeLevel(5);
    const preFetchedItem = makeItem();

    const movement = await useCase.processOUT({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      warehouseId: WH_ID,
      qty: 10,
      date: '2026-02-01',
      movementType: 'SALES_DELIVERY',
      refs: { type: 'SALES_INVOICE', docId: 'si-1' },
      currentUser: 'user-1',
      preFetchedLevel,
      preFetchedItem,
      skipWarehouseValidation: true,
    });

    expect(movement.qtyAfter).toBe(-5);
    expect(inventorySettingsRepository.getSettings).toHaveBeenCalledWith(COMPANY_ID);
  });

  // A stock transfer issues from the source warehouse exactly like an OUT, so it
  // must honor the same allowNegativeStock policy. Regression for GP02-step9: a
  // transfer drove the source warehouse to a huge negative while the policy was
  // off because processTRANSFER/processTRANSFERGlobal had no guard.
  it('throws NegativeStockError when a WAREHOUSE transfer would drive the source negative', async () => {
    const { useCase, writeMovement, writeLevel } = buildUseCase(false);
    const source = makeLevel(5, WH_ID);
    const destination = makeLevel(0, WH_DEST_ID);
    const preFetchedItem = makeItem();

    await expect(
      useCase.processTRANSFER({
        companyId: COMPANY_ID,
        itemId: ITEM_ID,
        sourceWarehouseId: WH_ID,
        destinationWarehouseId: WH_DEST_ID,
        qty: 10,
        date: '2026-02-01',
        transferDocId: 'trf-1',
        currentUser: 'user-1',
        preFetchedItem,
        preFetchedSourceLevel: source,
        preFetchedDestinationLevel: destination,
        skipWarehouseValidation: true,
      })
    ).rejects.toBeInstanceOf(NegativeStockError);

    expect(writeMovement).not.toHaveBeenCalled();
    expect(writeLevel).not.toHaveBeenCalled();
    expect(source.qtyOnHand).toBe(5);
  });

  it('allows a WAREHOUSE transfer to drive the source negative when allowNegativeStock=true', async () => {
    const { useCase } = buildUseCase(true);
    const source = makeLevel(5, WH_ID);
    const destination = makeLevel(0, WH_DEST_ID);
    const preFetchedItem = makeItem();

    const { outMov, inMov } = await useCase.processTRANSFER({
      companyId: COMPANY_ID,
      itemId: ITEM_ID,
      sourceWarehouseId: WH_ID,
      destinationWarehouseId: WH_DEST_ID,
      qty: 10,
      date: '2026-02-01',
      transferDocId: 'trf-1',
      currentUser: 'user-1',
      preFetchedItem,
      preFetchedSourceLevel: source,
      preFetchedDestinationLevel: destination,
      skipWarehouseValidation: true,
    });

    expect(outMov.qtyAfter).toBe(-5);
    expect(inMov.qtyAfter).toBe(10);
  });

  it('throws NegativeStockError when a GLOBAL transfer would drive the source negative', async () => {
    const source = makeLevel(5, WH_ID);
    const destination = makeLevel(0, WH_DEST_ID);
    const { useCase, writeMovement } = buildUseCase(false, 'GLOBAL', [source, destination]);
    const preFetchedItem = makeItem();

    await expect(
      useCase.processTRANSFER({
        companyId: COMPANY_ID,
        itemId: ITEM_ID,
        sourceWarehouseId: WH_ID,
        destinationWarehouseId: WH_DEST_ID,
        qty: 10,
        date: '2026-02-01',
        transferDocId: 'trf-1',
        currentUser: 'user-1',
        preFetchedItem,
        skipWarehouseValidation: true,
      })
    ).rejects.toBeInstanceOf(NegativeStockError);

    expect(writeMovement).not.toHaveBeenCalled();
  });
});
