import { ReconcileInventoryGLUseCase } from '../../../application/inventory/use-cases/ReconcileInventoryGLUseCase';

describe('ReconcileInventoryGLUseCase', () => {
  const COMPANY_ID = 'cmp-1';

  const build = () => {
    const stockLevelRepo = {
      getAllLevels: jest.fn(async () => [
        { itemId: 'item-A', warehouseId: 'wh-1', qtyOnHand: 10, avgCostBase: 10 }, // 100 → INV-100
        { itemId: 'item-B', warehouseId: 'wh-1', qtyOnHand: 5, avgCostBase: 4 }, // 20 → fallback INV-200
        { itemId: 'item-C', warehouseId: 'wh-1', qtyOnHand: 3, avgCostBase: 7 }, // 21 → unmapped
      ]),
    };
    const inventorySettingsRepo = {
      getSettings: jest.fn(async () => ({ defaultInventoryAssetAccountId: 'INV-200' })),
    };
    const itemRepo = {
      getCompanyItems: jest.fn(async () => [
        { id: 'item-A', inventoryAssetAccountId: 'INV-100' },
        { id: 'item-B' }, // no account → falls back to settings default INV-200
        { id: 'item-C', inventoryAssetAccountId: undefined }, // unmapped (settings default still applies though)
      ]),
    };
    // INV-100 GL balance 100 (matches stock); INV-200 GL balance 15 (stock 20 → drift -5).
    const glBalanceProvider = {
      getAccountBalances: jest.fn(async () => [
        { accountId: 'INV-100', balanceBase: 100 },
        { accountId: 'INV-200', balanceBase: 15 },
      ]),
    };
    const accountRepo = {
      list: jest.fn(async () => [
        { id: 'INV-100', userCode: '1300', name: 'Inventory A' },
        { id: 'INV-200', userCode: '1310', name: 'Inventory B' },
      ]),
    };

    const useCase = new ReconcileInventoryGLUseCase(
      stockLevelRepo as any,
      itemRepo as any,
      inventorySettingsRepo as any,
      glBalanceProvider as any,
      accountRepo as any
    );
    return { useCase };
  };

  it('matches accounts that tie out and flags drift, with item-level fallback to the settings default account', async () => {
    const { useCase } = build();
    const result = await useCase.execute(COMPANY_ID, '2026-06-13');

    // item-C has no account but settings default INV-200 applies → it is NOT unmapped here.
    const inv100 = result.lines.find((l) => l.accountId === 'INV-100')!;
    const inv200 = result.lines.find((l) => l.accountId === 'INV-200')!;

    expect(inv100.stockValueBase).toBe(100);
    expect(inv100.glBalanceBase).toBe(100);
    expect(inv100.matched).toBe(true);

    // INV-200 collects item-B (20) + item-C fallback (21) = 41 stock vs 15 GL → drift.
    expect(inv200.stockValueBase).toBe(41);
    expect(inv200.glBalanceBase).toBe(15);
    expect(inv200.differenceBase).toBe(-26);
    expect(inv200.matched).toBe(false);

    expect(result.isReconciled).toBe(false);
  });

  it('reports unmapped stock value when no account resolves and there is no settings default', async () => {
    const stockLevelRepo = {
      getAllLevels: jest.fn(async () => [{ itemId: 'item-X', warehouseId: 'wh-1', qtyOnHand: 2, avgCostBase: 9 }]),
    };
    const inventorySettingsRepo = { getSettings: jest.fn(async () => ({})) }; // no default
    const itemRepo = { getCompanyItems: jest.fn(async () => [{ id: 'item-X' }]) };
    const glBalanceProvider = { getAccountBalances: jest.fn(async () => []) };
    const accountRepo = { list: jest.fn(async () => []) };

    const useCase = new ReconcileInventoryGLUseCase(
      stockLevelRepo as any,
      itemRepo as any,
      inventorySettingsRepo as any,
      glBalanceProvider as any,
      accountRepo as any
    );

    const result = await useCase.execute(COMPANY_ID);
    expect(result.unmappedStockValueBase).toBe(18);
    expect(result.lines).toHaveLength(0);
    expect(result.isReconciled).toBe(false);
  });
});
