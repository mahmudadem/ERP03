import { randomUUID } from 'crypto';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import {
  OpeningStockDocument,
  OpeningStockDocumentLine,
} from '../../../domain/inventory/entities/OpeningStockDocument';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IOpeningStockDocumentRepository } from '../../../repository/interfaces/inventory/IOpeningStockDocumentRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import { ProcessINInput, RecordStockMovementUseCase } from './RecordStockMovementUseCase';

export interface CreateOpeningStockDocumentInput {
  companyId: string;
  warehouseId: string;
  date: string;
  notes?: string;
  createAccountingEffect?: boolean;
  openingBalanceAccountId?: string;
  lines: Array<{
    itemId: string;
    quantity: number;
    unitCostInMoveCurrency: number;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
  }>;
  createdBy: string;
}

export interface UpdateOpeningStockDocumentInput {
  companyId: string;
  documentId: string;
  warehouseId: string;
  date: string;
  notes?: string;
  createAccountingEffect?: boolean;
  openingBalanceAccountId?: string;
  lines: Array<{
    itemId: string;
    quantity: number;
    unitCostInMoveCurrency: number;
    moveCurrency: string;
    fxRateMovToBase: number;
    fxRateCCYToBase: number;
  }>;
}

const isStockEligibleItem = (item: { type?: string; trackInventory?: boolean; active?: boolean }): boolean =>
  !!item &&
  item.active !== false &&
  item.trackInventory === true &&
  item.type !== 'SERVICE';

const computeUnitCostBase = (
  unitCostInMoveCurrency: number,
  moveCurrency: string,
  baseCurrency: string,
  itemCostCurrency: string,
  fxRateMovToBase: number,
  fxRateCCYToBase: number
): number => {
  const move = (moveCurrency || '').toUpperCase();
  const base = (baseCurrency || '').toUpperCase();
  const cost = (itemCostCurrency || '').toUpperCase();

  if (move === base) {
    return roundMoney(unitCostInMoveCurrency);
  }

  if (move === cost) {
    return roundMoney(unitCostInMoveCurrency * fxRateCCYToBase);
  }

  return roundMoney(unitCostInMoveCurrency * fxRateMovToBase);
};

const prepareDraftDocumentState = async (
  deps: {
    itemRepo: IItemRepository;
    warehouseRepo: IWarehouseRepository;
    companyRepo: ICompanyRepository;
    companyModuleRepo: ICompanyModuleRepository;
    accountRepo: IAccountRepository;
  },
  input: Omit<CreateOpeningStockDocumentInput, 'createdBy'>
): Promise<{
  createAccountingEffect: boolean;
  openingBalanceAccountId?: string;
  lines: OpeningStockDocumentLine[];
  totalValueBase: number;
}> => {
  const createAccountingEffect = input.createAccountingEffect ?? false;

  const [company, warehouse, accountingModule] = await Promise.all([
    deps.companyRepo.findById(input.companyId),
    deps.warehouseRepo.getWarehouse(input.warehouseId),
    createAccountingEffect
      ? deps.companyModuleRepo.get(input.companyId, 'accounting')
      : Promise.resolve(null),
  ]);

  if (!company) throw new Error(`Company not found: ${input.companyId}`);
  if (!warehouse || warehouse.companyId !== input.companyId) {
    throw new Error(`Warehouse not found: ${input.warehouseId}`);
  }
  if (warehouse.active === false) {
    throw new Error(`Warehouse is inactive: ${warehouse.code || warehouse.id}`);
  }

  if (createAccountingEffect) {
    if (!accountingModule?.initialized) {
      throw new Error(
        'Accounting module is not enabled. Opening Stock Documents can only be posted as inventory-only until Accounting is initialized.'
      );
    }

    if (!input.openingBalanceAccountId?.trim()) {
      throw new Error('openingBalanceAccountId is required when createAccountingEffect is enabled');
    }

    const account = await deps.accountRepo.getById(input.companyId, input.openingBalanceAccountId);
    if (!account) {
      throw new Error('Opening Stock Clearing / Opening Balance account does not exist');
    }
    if (account.accountRole !== 'POSTING') {
      throw new Error('Opening Stock Clearing / Opening Balance account must be a POSTING account');
    }
    if (account.status !== 'ACTIVE') {
      throw new Error('Opening Stock Clearing / Opening Balance account must be ACTIVE');
    }
  }

  const itemIds = [...new Set((input.lines || []).map((line) => line.itemId))];
  const itemEntries = await Promise.all(itemIds.map((itemId) => deps.itemRepo.getItem(itemId)));
  const itemsById = new Map(
    itemEntries
      .filter((item): item is NonNullable<typeof item> => !!item && item.companyId === input.companyId)
      .map((item) => [item.id, item])
  );

  const lines: OpeningStockDocumentLine[] = input.lines.map((line, index) => {
    const item = itemsById.get(line.itemId);
    if (!item) {
      throw new Error(`Line ${index + 1}: item not found (${line.itemId})`);
    }
    if (!isStockEligibleItem(item)) {
      throw new Error(
        `Line ${index + 1}: item "${item.code} - ${item.name}" is not eligible for Opening Stock. Only active stock-tracked items are allowed.`
      );
    }

    const unitCostBase = computeUnitCostBase(
      line.unitCostInMoveCurrency,
      line.moveCurrency,
      company.baseCurrency,
      item.costCurrency,
      line.fxRateMovToBase,
      line.fxRateCCYToBase
    );

    return {
      lineId: randomUUID(),
      itemId: line.itemId,
      quantity: line.quantity,
      unitCostInMoveCurrency: line.unitCostInMoveCurrency,
      moveCurrency: line.moveCurrency.toUpperCase(),
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      unitCostBase,
      totalValueBase: roundMoney(line.quantity * unitCostBase),
    };
  });

  return {
    createAccountingEffect,
    openingBalanceAccountId: createAccountingEffect ? input.openingBalanceAccountId?.trim() : undefined,
    lines,
    totalValueBase: roundMoney(lines.reduce((sum, line) => sum + line.totalValueBase, 0)),
  };
};

export class CreateOpeningStockDocumentUseCase {
  constructor(
    private readonly documentRepo: IOpeningStockDocumentRepository,
    private readonly itemRepo: IItemRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: CreateOpeningStockDocumentInput): Promise<OpeningStockDocument> {
    const prepared = await prepareDraftDocumentState(
      {
        itemRepo: this.itemRepo,
        warehouseRepo: this.warehouseRepo,
        companyRepo: this.companyRepo,
        companyModuleRepo: this.companyModuleRepo,
        accountRepo: this.accountRepo,
      },
      input
    );

    const document = new OpeningStockDocument({
      id: randomUUID(),
      companyId: input.companyId,
      warehouseId: input.warehouseId,
      date: input.date,
      notes: input.notes,
      lines: prepared.lines,
      status: 'DRAFT',
      createAccountingEffect: prepared.createAccountingEffect,
      openingBalanceAccountId: prepared.openingBalanceAccountId,
      totalValueBase: prepared.totalValueBase,
      createdBy: input.createdBy,
      createdAt: new Date(),
    });

    await this.documentRepo.createDocument(document);
    return document;
  }
}

export class UpdateOpeningStockDocumentUseCase {
  constructor(
    private readonly documentRepo: IOpeningStockDocumentRepository,
    private readonly itemRepo: IItemRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: UpdateOpeningStockDocumentInput): Promise<OpeningStockDocument> {
    const existing = await this.documentRepo.getDocument(input.documentId);
    if (!existing || existing.companyId !== input.companyId) {
      throw new Error(`Opening Stock Document not found: ${input.documentId}`);
    }
    if (existing.status !== 'DRAFT') {
      throw new Error('Only DRAFT Opening Stock Documents can be edited');
    }

    const prepared = await prepareDraftDocumentState(
      {
        itemRepo: this.itemRepo,
        warehouseRepo: this.warehouseRepo,
        companyRepo: this.companyRepo,
        companyModuleRepo: this.companyModuleRepo,
        accountRepo: this.accountRepo,
      },
      {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        date: input.date,
        notes: input.notes,
        createAccountingEffect: input.createAccountingEffect,
        openingBalanceAccountId: input.openingBalanceAccountId,
        lines: input.lines,
      }
    );

    await this.documentRepo.updateDocument(input.companyId, input.documentId, {
      warehouseId: input.warehouseId,
      date: input.date,
      notes: input.notes,
      lines: prepared.lines,
      createAccountingEffect: prepared.createAccountingEffect,
      openingBalanceAccountId: prepared.openingBalanceAccountId,
      totalValueBase: prepared.totalValueBase,
    });

    const updated = await this.documentRepo.getDocument(input.documentId);
    if (!updated) {
      throw new Error(`Opening Stock Document not found after update: ${input.documentId}`);
    }

    return updated;
  }
}

export class ListOpeningStockDocumentsUseCase {
  constructor(private readonly documentRepo: IOpeningStockDocumentRepository) {}

  async execute(
    companyId: string,
    status?: 'DRAFT' | 'POSTED'
  ): Promise<OpeningStockDocument[]> {
    if (status) {
      return this.documentRepo.getByStatus(companyId, status);
    }

    return this.documentRepo.getCompanyDocuments(companyId);
  }
}

export class DeleteOpeningStockDocumentUseCase {
  constructor(private readonly documentRepo: IOpeningStockDocumentRepository) {}

  async execute(companyId: string, documentId: string): Promise<void> {
    const existing = await this.documentRepo.getDocument(documentId);
    if (!existing || existing.companyId !== companyId) {
      throw new Error(`Opening Stock Document not found: ${documentId}`);
    }
    if (existing.status !== 'DRAFT') {
      throw new Error('Only DRAFT Opening Stock Documents can be deleted');
    }

    await this.documentRepo.deleteDocument(documentId);
  }
}

export class PostOpeningStockDocumentUseCase {
  constructor(
    private readonly documentRepo: IOpeningStockDocumentRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly movementUseCase: RecordStockMovementUseCase,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, documentId: string, userId: string): Promise<OpeningStockDocument> {
    const document = await this.documentRepo.getDocument(documentId);
    if (!document || document.companyId !== companyId) {
      throw new Error(`Opening Stock Document not found: ${documentId}`);
    }
    if (document.status !== 'DRAFT') {
      throw new Error('Only DRAFT Opening Stock Documents can be posted');
    }

    const [company, warehouse, inventorySettings, accountingModule] = await Promise.all([
      this.companyRepo.findById(companyId),
      this.warehouseRepo.getWarehouse(document.warehouseId),
      this.inventorySettingsRepo.getSettings(companyId),
      this.companyModuleRepo.get(companyId, 'accounting'),
    ]);

    if (!company) throw new Error(`Company not found: ${companyId}`);
    if (!warehouse || warehouse.companyId !== companyId) {
      throw new Error(`Warehouse not found: ${document.warehouseId}`);
    }
    if (warehouse.active === false) {
      throw new Error(`Warehouse is inactive: ${warehouse.code || warehouse.id}`);
    }

    const distinctItemIds = [...new Set(document.lines.map((line) => line.itemId))];
    const [items, categories] = await Promise.all([
      Promise.all(distinctItemIds.map((itemId) => this.itemRepo.getItem(itemId))),
      this.itemCategoryRepo.getCompanyCategories(companyId),
    ]);

    const itemsById = new Map(
      items
        .filter((item): item is NonNullable<typeof item> => !!item && item.companyId === companyId)
        .map((item) => [item.id, item])
    );
    const categoriesById = new Map(categories.map((category) => [category.id, category]));

    const accountBuckets = new Map<string, number>();

    if (document.createAccountingEffect) {
      if (!accountingModule?.initialized) {
        throw new Error(
          'Accounting module is not enabled. This Opening Stock Document can only be posted as inventory-only.'
        );
      }

      if (!document.openingBalanceAccountId?.trim()) {
        throw new Error(
          'Opening Stock Clearing / Opening Balance account is required when createAccountingEffect is enabled'
        );
      }

      await this.assertPostingAccount(
        companyId,
        document.openingBalanceAccountId,
        'Opening Stock Clearing / Opening Balance account'
      );

      for (const [index, line] of document.lines.entries()) {
        const item = itemsById.get(line.itemId);
        if (!item) {
          throw new Error(`Line ${index + 1}: item not found (${line.itemId})`);
        }
        if (!isStockEligibleItem(item)) {
          throw new Error(
            `Line ${index + 1}: item "${item.code} - ${item.name}" is not eligible for Opening Stock posting`
          );
        }

        const inventoryAssetAccountId =
          item.inventoryAssetAccountId ||
          (item.categoryId ? categoriesById.get(item.categoryId)?.defaultInventoryAssetAccountId : undefined) ||
          inventorySettings?.defaultInventoryAssetAccountId;

        if (!inventoryAssetAccountId) {
          throw new Error(
            `Line ${index + 1}: item "${item.code} - ${item.name}" is missing an Inventory Asset account. Configure it on the item, category, or Inventory Settings before posting accounting effect.`
          );
        }

        await this.assertPostingAccount(
          companyId,
          inventoryAssetAccountId,
          `Inventory Asset account for item "${item.code} - ${item.name}"`
        );

        if (line.totalValueBase > 0) {
          const existing = accountBuckets.get(inventoryAssetAccountId) || 0;
          accountBuckets.set(
            inventoryAssetAccountId,
            roundMoney(existing + line.totalValueBase)
          );
        }
      }

      if (accountBuckets.size === 0) {
        throw new Error(
          'Accounting effect requires a positive opening stock value. At least one line must have a positive total value.'
        );
      }
    }

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of document.lines) {
        const inInput: ProcessINInput = {
          companyId,
          itemId: line.itemId,
          warehouseId: document.warehouseId,
          qty: line.quantity,
          date: document.date,
          movementType: 'OPENING_STOCK',
          refs: {
            type: 'OPENING',
            docId: document.id,
            lineId: line.lineId,
          },
          currentUser: userId,
          notes: document.notes,
          metadata: {
            source: 'opening-stock-document',
            openingStockDocumentId: document.id,
            createAccountingEffect: document.createAccountingEffect,
          },
          unitCostInMoveCurrency: line.unitCostInMoveCurrency,
          moveCurrency: line.moveCurrency,
          fxRateMovToBase: line.fxRateMovToBase,
          fxRateCCYToBase: line.fxRateCCYToBase,
          transaction,
        };

        await this.movementUseCase.processIN(inInput);
      }

      let voucherId: string | undefined;
      if (document.createAccountingEffect) {
        const balances: Array<Record<string, any>> = Array.from(accountBuckets.entries()).map(([accountId, amount]) => ({
          accountId,
          debitBalance: roundMoney(amount),
          creditBalance: 0,
          currency: company.baseCurrency,
          exchangeRate: 1,
          metadata: {
            source: 'opening-stock-document',
            openingStockDocumentId: document.id,
          },
        }));

        balances.push({
          accountId: document.openingBalanceAccountId!,
          debitBalance: 0,
          creditBalance: roundMoney(document.totalValueBase),
          currency: company.baseCurrency,
          exchangeRate: 1,
          metadata: {
            source: 'opening-stock-document',
            openingStockDocumentId: document.id,
            role: 'opening-balance-offset',
          },
        });

        const voucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.OPENING_BALANCE,
            voucherNo: `OS-${document.id}`,
            date: document.date,
            description: `Opening Stock Document ${document.id}`,
            currency: company.baseCurrency,
            exchangeRate: 1,
            lines: [],
            strategyPayload: {
              balances,
            },
            metadata: {
              sourceModule: 'inventory',
              sourceType: 'OPENING_STOCK_DOCUMENT',
              sourceId: document.id,
              warehouseId: document.warehouseId,
            },
            createdBy: userId,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: document.id,
          },
          transaction
        );

        voucherId = voucher.id;
      }

      const updatePatch: Partial<OpeningStockDocument> = {
        status: 'POSTED',
        postedAt: new Date(),
      };

      if (voucherId) {
        updatePatch.voucherId = voucherId;
      }

      await this.documentRepo.updateDocument(companyId, document.id, updatePatch, transaction);
    });

    const posted = await this.documentRepo.getDocument(document.id);
    if (!posted) {
      throw new Error(`Opening Stock Document not found after posting: ${document.id}`);
    }

    return posted;
  }

  private async assertPostingAccount(
    companyId: string,
    accountId: string,
    label: string
  ): Promise<void> {
    const account = await this.accountRepo.getById(companyId, accountId);
    if (!account) {
      throw new Error(`${label} does not exist`);
    }
    if (account.accountRole !== 'POSTING') {
      throw new Error(`${label} must be a POSTING account`);
    }
    if (account.status !== 'ACTIVE') {
      throw new Error(`${label} must be ACTIVE`);
    }
  }
}
