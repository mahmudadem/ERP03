import { Company } from '../../../domain/core/entities/Company';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IStockLevelRepository } from '../../../repository/interfaces/inventory/IStockLevelRepository';
import { IStockMovementRepository } from '../../../repository/interfaces/inventory/IStockMovementRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { describe, it, expect, beforeEach } from '@jest/globals';

class InMemoryCompanyRepository implements ICompanyRepository {
  private readonly companies = new Map<string, Company>();

  add(company: Company): void {
    this.companies.set(company.id, company);
  }

  async save(company: Company): Promise<void> {
    this.companies.set(company.id, company);
  }

  async findById(id: string): Promise<Company | null> {
    return this.companies.get(id) || null;
  }

  async findByTaxId(taxId: string): Promise<Company | null> {
    return Array.from(this.companies.values()).find((company) => company.taxId === taxId) || null;
  }

  async findByNameAndOwner(name: string, ownerId: string): Promise<Company | null> {
    return Array.from(this.companies.values()).find((company) => company.name === name && company.ownerId === ownerId) || null;
  }

  async getUserCompanies(userId: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter((company) => company.ownerId === userId);
  }

  async enableModule(companyId: string, moduleName: string): Promise<void> {
    const company = this.companies.get(companyId);
    if (!company) return;
    if (!company.modules.includes(moduleName)) company.modules.push(moduleName);
  }

  async update(companyId: string, updates: Partial<Company>): Promise<Company> {
    const company = this.companies.get(companyId);
    if (!company) throw new Error('Company not found');
    Object.assign(company, updates);
    return company;
  }

  async disableModule(companyId: string, moduleName: string): Promise<void> {
    const company = this.companies.get(companyId);
    if (!company) return;
    company.modules = company.modules.filter((moduleId) => moduleId !== moduleName);
  }

  async updateBundle(companyId: string, bundleId: string): Promise<Company> {
    const company = this.companies.get(companyId);
    if (!company) throw new Error('Company not found');
    company.subscriptionPlan = bundleId;
    return company;
  }

  async updateFeatures(companyId: string, features: string[]): Promise<void> {
    const company = this.companies.get(companyId);
    if (!company) return;
    company.features = [...features];
  }

  async listAll(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async delete(companyId: string): Promise<void> {
    this.companies.delete(companyId);
  }
}

class InMemoryItemRepository implements IItemRepository {
  private readonly items = new Map<string, Item>();

  async createItem(item: Item): Promise<void> {
    this.items.set(item.id, item);
  }

  async updateItem(id: string, data: Partial<Item>): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;
    Object.assign(item, data);
  }

  async setItemActive(id: string, active: boolean): Promise<void> {
    const item = this.items.get(id);
    if (!item) return;
    item.active = active;
  }

  async getItem(id: string): Promise<Item | null> {
    return this.items.get(id) || null;
  }

  async getCompanyItems(companyId: string): Promise<Item[]> {
    return Array.from(this.items.values()).filter((item) => item.companyId === companyId);
  }

  async getItemByCode(companyId: string, code: string): Promise<Item | null> {
    return Array.from(this.items.values()).find((item) => item.companyId === companyId && item.code === code) || null;
  }

  async getItemsByCategory(companyId: string, categoryId: string): Promise<Item[]> {
    return Array.from(this.items.values()).filter((item) => item.companyId === companyId && item.categoryId === categoryId);
  }

  async searchItems(companyId: string, query: string): Promise<Item[]> {
    const normalized = query.toLowerCase();
    return Array.from(this.items.values()).filter((item) =>
      item.companyId === companyId &&
      (item.code.toLowerCase().includes(normalized) || item.name.toLowerCase().includes(normalized))
    );
  }

  async deleteItem(id: string): Promise<void> {
    this.items.delete(id);
  }

  async hasMovements(): Promise<boolean> {
    return false;
  }
}

class InMemoryWarehouseRepository implements IWarehouseRepository {
  private readonly warehouses = new Map<string, Warehouse>();

  async createWarehouse(warehouse: Warehouse): Promise<void> {
    this.warehouses.set(warehouse.id, warehouse);
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> {
    const warehouse = this.warehouses.get(id);
    if (!warehouse) return;
    Object.assign(warehouse, data);
  }

  async getWarehouse(id: string): Promise<Warehouse | null> {
    return this.warehouses.get(id) || null;
  }

  async getCompanyWarehouses(companyId: string): Promise<Warehouse[]> {
    return Array.from(this.warehouses.values()).filter((warehouse) => warehouse.companyId === companyId);
  }

  async getWarehouseByCode(companyId: string, code: string): Promise<Warehouse | null> {
    return Array.from(this.warehouses.values()).find((warehouse) => warehouse.companyId === companyId && warehouse.code === code) || null;
  }
}

class InMemoryStockMovementRepository implements IStockMovementRepository {
  readonly movements: StockMovement[] = [];

  async recordMovement(movement: StockMovement): Promise<void> {
    this.movements.push(movement);
  }

  async getItemMovements(companyId: string, itemId: string): Promise<StockMovement[]> {
    return this.movements.filter((movement) => movement.companyId === companyId && movement.itemId === itemId);
  }

  async getWarehouseMovements(companyId: string, warehouseId: string): Promise<StockMovement[]> {
    return this.movements.filter((movement) => movement.companyId === companyId && movement.warehouseId === warehouseId);
  }

  async getMovementsByReference(companyId: string, referenceType: any, referenceId: string): Promise<StockMovement[]> {
    return this.movements.filter((movement) =>
      movement.companyId === companyId &&
      movement.referenceType === referenceType &&
      movement.referenceId === referenceId
    );
  }

  async getMovementByReference(
    companyId: string,
    referenceType: any,
    referenceId: string,
    referenceLineId?: string
  ): Promise<StockMovement | null> {
    return (
      this.movements.find((movement) =>
        movement.companyId === companyId &&
        movement.referenceType === referenceType &&
        movement.referenceId === referenceId &&
        (referenceLineId === undefined || movement.referenceLineId === referenceLineId)
      ) || null
    );
  }

  async getMovementsByDateRange(companyId: string, from: string, to: string): Promise<StockMovement[]> {
    return this.movements.filter((movement) => movement.companyId === companyId && movement.date >= from && movement.date <= to);
  }

  async getUnsettledMovements(companyId: string): Promise<StockMovement[]> {
    return this.movements.filter((movement) => movement.companyId === companyId && !movement.costSettled);
  }

  async getMovement(id: string): Promise<StockMovement | null> {
    return this.movements.find((movement) => movement.id === id) || null;
  }

  async deleteMovement(companyId: string, id: string): Promise<void> {
    const index = this.movements.findIndex((movement) => movement.companyId === companyId && movement.id === id);
    if (index >= 0) {
      this.movements.splice(index, 1);
    }
  }
}

class InMemoryStockLevelRepository implements IStockLevelRepository {
  private readonly levels = new Map<string, StockLevel>();

  add(level: StockLevel): void {
    this.levels.set(level.id, level);
  }

  async getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    const id = StockLevel.compositeId(itemId, warehouseId);
    const level = this.levels.get(id);
    if (!level || level.companyId !== companyId) return null;
    return level;
  }

  async getLevelsByItem(companyId: string, itemId: string): Promise<StockLevel[]> {
    return Array.from(this.levels.values()).filter((level) => level.companyId === companyId && level.itemId === itemId);
  }

  async getLevelsByWarehouse(companyId: string, warehouseId: string): Promise<StockLevel[]> {
    return Array.from(this.levels.values()).filter((level) => level.companyId === companyId && level.warehouseId === warehouseId);
  }

  async getAllLevels(companyId: string): Promise<StockLevel[]> {
    return Array.from(this.levels.values()).filter((level) => level.companyId === companyId);
  }

  async upsertLevel(level: StockLevel): Promise<void> {
    this.levels.set(level.id, level);
  }

  async getLevelInTransaction(_transaction: unknown, companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    return this.getLevel(companyId, itemId, warehouseId);
  }

  async upsertLevelInTransaction(_transaction: unknown, level: StockLevel): Promise<void> {
    this.levels.set(level.id, level);
  }
}

class InMemoryTransactionManager implements ITransactionManager {
  async runTransaction<T>(operation: (transaction: any) => Promise<T>): Promise<T> {
    return operation({});
  }
}

const createCompany = (companyId: string, baseCurrency: string): Company => new Company(
  companyId,
  'Demo Company',
  'owner-1',
  new Date(),
  new Date(),
  baseCurrency,
  new Date(),
  new Date(),
  ['inventory'],
  []
);

const createItem = (companyId: string, itemId: string, costCurrency: string): Item => new Item({
  id: itemId,
  companyId,
  code: `ITM-${itemId}`,
  name: `Item ${itemId}`,
  type: 'PRODUCT',
  baseUom: 'pcs',
  costCurrency,
  costingMethod: 'MOVING_AVG',
  trackInventory: true,
  active: true,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createWarehouse = (companyId: string, warehouseId: string, code: string): Warehouse => new Warehouse({
  id: warehouseId,
  companyId,
  name: warehouseId,
  code,
  active: true,
  isDefault: code === 'WH-A',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('RecordStockMovementUseCase', () => {
  const companyId = 'cmp-1';
  const itemId = 'item-1';
  const whA = 'wh-a';
  const whB = 'wh-b';

  let companyRepo: InMemoryCompanyRepository;
  let itemRepo: InMemoryItemRepository;
  let warehouseRepo: InMemoryWarehouseRepository;
  let movementRepo: InMemoryStockMovementRepository;
  let levelRepo: InMemoryStockLevelRepository;
  let useCase: RecordStockMovementUseCase;

  const addDefaultContext = (costCurrency: string = 'USD') => {
    companyRepo.add(createCompany(companyId, 'TRY'));
    itemRepo.createItem(createItem(companyId, itemId, costCurrency));
    warehouseRepo.createWarehouse(createWarehouse(companyId, whA, 'WH-A'));
    warehouseRepo.createWarehouse(createWarehouse(companyId, whB, 'WH-B'));
  };

  beforeEach(() => {
    companyRepo = new InMemoryCompanyRepository();
    itemRepo = new InMemoryItemRepository();
    warehouseRepo = new InMemoryWarehouseRepository();
    movementRepo = new InMemoryStockMovementRepository();
    levelRepo = new InMemoryStockLevelRepository();

    useCase = new RecordStockMovementUseCase({
      companyRepository: companyRepo,
      itemRepository: itemRepo,
      warehouseRepository: warehouseRepo,
      stockMovementRepository: movementRepo,
      stockLevelRepository: levelRepo,
      transactionManager: new InMemoryTransactionManager(),
    });
  });

  it('IN #1: IN 10 at cost 5 creates avgCost=5 qty=10', async () => {
    addDefaultContext('USD');

    const movement = await useCase.processIN({
      companyId,
      itemId,
      warehouseId: whA,
      qty: 10,
      date: '2026-01-10',
      movementType: 'OPENING_STOCK',
      refs: { type: 'OPENING', docId: 'opn-1' },
      currentUser: 'user-1',
      unitCostInMoveCurrency: 5,
      moveCurrency: 'USD',
      fxRateMovToBase: 32,
      fxRateCCYToBase: 32,
    });

    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.qtyOnHand).toBe(10);
    expect(level?.avgCostCCY).toBe(5);
    expect(movement.unitCostCCY).toBe(5);
  });

  it('IN #2: second IN uses weighted average', async () => {
    addDefaultContext('USD');

    await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 10, date: '2026-01-10',
      movementType: 'OPENING_STOCK', refs: { type: 'OPENING', docId: 'opn-1' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 5, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 10, date: '2026-01-11',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-1' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 7, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.qtyOnHand).toBe(20);
    expect(level?.avgCostCCY).toBe(6);
  });

  it('IN #3: negative -3 then IN 10 settles 3 and newPositive 7', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: -3, reservedQty: 0,
      avgCostBase: 11, avgCostCCY: 11,
      lastCostBase: 12, lastCostCCY: 12,
      postingSeq: 5, maxBusinessDate: '2026-01-05', totalMovements: 5, lastMovementId: 'm5', version: 5, updatedAt: new Date(),
    }));

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 10, date: '2026-01-10',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-2' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 8, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    expect(movement.settlesNegativeQty).toBe(3);
    expect(movement.newPositiveQty).toBe(7);
    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.avgCostCCY).toBe(8);
  });

  it('IN #4: negative -10 then IN 5 keeps negative and avg resets', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: -10, reservedQty: 0,
      avgCostBase: 20, avgCostCCY: 20,
      lastCostBase: 20, lastCostCCY: 20,
      postingSeq: 1, maxBusinessDate: '2026-01-05', totalMovements: 1, lastMovementId: 'm1', version: 1, updatedAt: new Date(),
    }));

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 5, date: '2026-01-10',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-3' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 9, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    expect(movement.settlesNegativeQty).toBe(5);
    expect(movement.newPositiveQty).toBe(0);
    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.qtyOnHand).toBe(-5);
    expect(level?.avgCostCCY).toBe(9);
  });

  it('OUT #5: positive stock OUT is fully settled', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 20, reservedQty: 0,
      avgCostBase: 100, avgCostCCY: 5,
      lastCostBase: 100, lastCostCCY: 5,
      postingSeq: 2, maxBusinessDate: '2026-01-10', totalMovements: 2, lastMovementId: 'm2', version: 2, updatedAt: new Date(),
    }));

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 5, date: '2026-01-11',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-1' }, currentUser: 'user-1',
    });

    expect(movement.settledQty).toBe(5);
    expect(movement.unsettledQty).toBe(0);
    expect(movement.costSettled).toBe(true);
  });

  it('OUT #6: average cost remains unchanged after OUT', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 20, reservedQty: 0,
      avgCostBase: 96, avgCostCCY: 3,
      lastCostBase: 96, lastCostCCY: 3,
      postingSeq: 3, maxBusinessDate: '2026-01-10', totalMovements: 3, lastMovementId: 'm3', version: 3, updatedAt: new Date(),
    }));

    await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 5, date: '2026-01-11',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-2' }, currentUser: 'user-1',
    });

    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.avgCostCCY).toBe(3);
    expect(level?.avgCostBase).toBe(96);
  });

  it('OUT #7: crossing zero stores partial settlement', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 2, reservedQty: 0,
      avgCostBase: 64, avgCostCCY: 2,
      lastCostBase: 64, lastCostCCY: 2,
      postingSeq: 2, maxBusinessDate: '2026-01-09', totalMovements: 2, lastMovementId: 'm2', version: 2, updatedAt: new Date(),
    }));

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 5, date: '2026-01-11',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-3' }, currentUser: 'user-1',
    });

    expect(movement.settledQty).toBe(2);
    expect(movement.unsettledQty).toBe(3);
    expect(movement.costSettled).toBe(false);
    expect(movement.qtyAfter).toBe(-3);
  });

  it('OUT #8: already negative uses last known cost', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: -3, reservedQty: 0,
      avgCostBase: 0, avgCostCCY: 0,
      lastCostBase: 320, lastCostCCY: 10,
      postingSeq: 1, maxBusinessDate: '2026-01-09', totalMovements: 1, lastMovementId: 'm1', version: 1, updatedAt: new Date(),
    }));

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 2, date: '2026-01-10',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-4' }, currentUser: 'user-1',
    });

    expect(movement.settledQty).toBe(0);
    expect(movement.unsettledQty).toBe(2);
    expect(movement.unitCostBase).toBe(320);
    expect(movement.costSettled).toBe(false);
  });

  it('OUT #9: first ever OUT flags MISSING cost basis', async () => {
    addDefaultContext('USD');

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-10',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-5' }, currentUser: 'user-1',
    });

    expect(movement.unsettledCostBasis).toBe('MISSING');
    expect(movement.unitCostBase).toBe(0);
    expect(movement.fxRateCCYToBase).toBe(1);
  });

  it('Backdating #10: older date than maxBusinessDate sets isBackdated=true', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 5, reservedQty: 0,
      avgCostBase: 64, avgCostCCY: 2,
      lastCostBase: 64, lastCostCCY: 2,
      postingSeq: 1, maxBusinessDate: '2026-01-15', totalMovements: 1, lastMovementId: 'm1', version: 1, updatedAt: new Date(),
    }));

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-10',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-6' }, currentUser: 'user-1',
    });

    expect(movement.isBackdated).toBe(true);
  });

  it('Backdating #11: newer date than maxBusinessDate sets isBackdated=false', async () => {
    addDefaultContext('USD');
    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 5, reservedQty: 0,
      avgCostBase: 64, avgCostCCY: 2,
      lastCostBase: 64, lastCostCCY: 2,
      postingSeq: 1, maxBusinessDate: '2026-01-15', totalMovements: 1, lastMovementId: 'm1', version: 1, updatedAt: new Date(),
    }));

    const movement = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-20',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-7' }, currentUser: 'user-1',
    });

    expect(movement.isBackdated).toBe(false);
  });

  it('Multi-currency #12: move USD, base TRY, costCurrency USD', async () => {
    addDefaultContext('USD');

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-10',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-usd' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 10, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    expect(movement.unitCostCCY).toBe(10);
    expect(movement.unitCostBase).toBe(320);
  });

  it('Multi-currency #13: cross-rate through base (USD -> EUR via TRY)', async () => {
    addDefaultContext('EUR');

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-10',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-eur' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 10, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 35,
    });

    expect(movement.unitCostBase).toBe(320);
    expect(movement.unitCostCCY).toBeCloseTo(9.14, 2);
  });

  it('Multi-currency #14: move TRY (base), costCurrency USD', async () => {
    addDefaultContext('USD');

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 1, date: '2026-01-10',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-try' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 320, moveCurrency: 'TRY', fxRateMovToBase: 1, fxRateCCYToBase: 32,
    });

    expect(movement.unitCostBase).toBe(320);
    expect(movement.unitCostCCY).toBe(10);
  });

  it('Transfer #15: paired movements with same carried cost and balanced levels', async () => {
    addDefaultContext('USD');

    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 20, reservedQty: 0,
      avgCostBase: 320, avgCostCCY: 10,
      lastCostBase: 320, lastCostCCY: 10,
      postingSeq: 4, maxBusinessDate: '2026-01-10', totalMovements: 4, lastMovementId: 'm4', version: 4, updatedAt: new Date(),
    }));

    const result = await useCase.processTRANSFER({
      companyId,
      itemId,
      sourceWarehouseId: whA,
      destinationWarehouseId: whB,
      qty: 5,
      date: '2026-01-12',
      transferDocId: 'trf-1',
      currentUser: 'user-1',
    });

    expect(result.outMov.unitCostBase).toBe(result.inMov.unitCostBase);
    const src = await levelRepo.getLevel(companyId, itemId, whA);
    const dst = await levelRepo.getLevel(companyId, itemId, whB);
    expect(src?.qtyOnHand).toBe(15);
    expect(dst?.qtyOnHand).toBe(5);
  });

  it('Transfer #16: empty source with lastCost uses lastCost', async () => {
    addDefaultContext('USD');

    levelRepo.add(new StockLevel({
      id: StockLevel.compositeId(itemId, whA),
      companyId, itemId, warehouseId: whA,
      qtyOnHand: 0, reservedQty: 0,
      avgCostBase: 0, avgCostCCY: 0,
      lastCostBase: 320, lastCostCCY: 10,
      postingSeq: 2, maxBusinessDate: '2026-01-10', totalMovements: 2, lastMovementId: 'm2', version: 2, updatedAt: new Date(),
    }));

    const result = await useCase.processTRANSFER({
      companyId,
      itemId,
      sourceWarehouseId: whA,
      destinationWarehouseId: whB,
      qty: 5,
      date: '2026-01-12',
      transferDocId: 'trf-2',
      currentUser: 'user-1',
    });

    expect(result.outMov.unitCostBase).toBe(320);
    expect(result.outMov.unsettledCostBasis).toBe('LAST_KNOWN');
  });

  it('Delete #17: deleting an inbound movement rebuilds qty, avg cost, and movement metadata', async () => {
    addDefaultContext('USD');

    await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 10, date: '2026-01-10',
      movementType: 'OPENING_STOCK', refs: { type: 'OPENING', docId: 'opn-del-1' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 5, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    const secondIn = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 10, date: '2026-01-11',
      movementType: 'PURCHASE_RECEIPT', refs: { type: 'PURCHASE_INVOICE', docId: 'pinv-del-1' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 7, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    const out = await useCase.processOUT({
      companyId, itemId, warehouseId: whA, qty: 5, date: '2026-01-12',
      movementType: 'SALES_DELIVERY', refs: { type: 'SALES_INVOICE', docId: 'sinv-del-1' }, currentUser: 'user-1',
    });

    await useCase.deleteMovement(companyId, secondIn.id);

    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.qtyOnHand).toBe(5);
    expect(level?.avgCostCCY).toBe(5);
    expect(level?.avgCostBase).toBe(160);
    expect(level?.lastCostCCY).toBe(5);
    expect(level?.lastCostBase).toBe(160);
    expect(level?.totalMovements).toBe(2);
    expect(level?.lastMovementId).toBe(out.id);
    expect(level?.maxBusinessDate).toBe('2026-01-12');
    expect(level?.postingSeq).toBe(4);
    expect(level?.version).toBe(4);
    expect(await movementRepo.getMovement(secondIn.id)).toBeNull();
  });

  it('Delete #18: deleting the last remaining movement resets stock cost metadata', async () => {
    addDefaultContext('USD');

    const movement = await useCase.processIN({
      companyId, itemId, warehouseId: whA, qty: 3, date: '2026-01-10',
      movementType: 'OPENING_STOCK', refs: { type: 'OPENING', docId: 'opn-del-2' }, currentUser: 'user-1',
      unitCostInMoveCurrency: 4, moveCurrency: 'USD', fxRateMovToBase: 32, fxRateCCYToBase: 32,
    });

    await useCase.deleteMovement(companyId, movement.id);

    const level = await levelRepo.getLevel(companyId, itemId, whA);
    expect(level?.qtyOnHand).toBe(0);
    expect(level?.avgCostCCY).toBe(0);
    expect(level?.avgCostBase).toBe(0);
    expect(level?.lastCostCCY).toBe(0);
    expect(level?.lastCostBase).toBe(0);
    expect(level?.totalMovements).toBe(0);
    expect(level?.lastMovementId).toBe('');
    expect(level?.maxBusinessDate).toBe('1970-01-01');
    expect(level?.postingSeq).toBe(2);
    expect(level?.version).toBe(2);
  });
});
