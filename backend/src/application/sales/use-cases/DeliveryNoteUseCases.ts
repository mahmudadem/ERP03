import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { DeliveryNote, DeliveryNoteLine } from '../../../domain/sales/entities/DeliveryNote';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { Item } from '../../../domain/inventory/entities/Item';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IAccountRepository, ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { SubledgerVoucherPostingService } from '../../accounting/services/SubledgerVoucherPostingService';
import {
  convertItemQtyToBaseUomDetailed,
} from '../../inventory/services/UomResolutionService';
import { generateUniqueDocumentNumber } from './SalesOrderUseCases';
import { roundMoney, updateSOStatus } from './SalesPostingHelpers';

export interface DeliveryNoteLineInput {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  itemId?: string;
  deliveredQty: number;
  uomId?: string;
  uom?: string;
  description?: string;
}

export interface CreateDeliveryNoteInput {
  companyId: string;
  salesOrderId?: string;
  customerId?: string;
  deliveryDate: string;
  warehouseId: string;
  lines?: DeliveryNoteLineInput[];
  notes?: string;
  createdBy: string;
}

export interface ListDeliveryNotesFilters {
  salesOrderId?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELLED';
  limit?: number;
}

interface AccumulatedCOGS {
  cogsAccountId: string;
  inventoryAccountId: string;
  amountBase: number;
}

const findSOLine = (so: SalesOrder, soLineId?: string, itemId?: string) => {
  if (soLineId) {
    return so.lines.find((line) => line.lineId === soLineId) || null;
  }
  if (itemId) {
    return so.lines.find((line) => line.itemId === itemId) || null;
  }
  return null;
};

export class CreateDeliveryNoteUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly partyRepo: IPartyRepository,
    private readonly itemRepo: IItemRepository
  ) {}

  async execute(input: CreateDeliveryNoteInput): Promise<DeliveryNote> {
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) {
      throw new Error('Sales module is not initialized');
    }

    if (settings.requireSOForStockItems && !input.salesOrderId) {
      throw new Error('A Sales Order reference is required to create a delivery note.');
    }

    let so: SalesOrder | null = null;
    if (input.salesOrderId) {
      so = await this.salesOrderRepo.getById(input.companyId, input.salesOrderId);
      if (!so) throw new Error(`Sales order not found: ${input.salesOrderId}`);
      if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
        throw new Error(`Sales order must be CONFIRMED or PARTIALLY_DELIVERED. Current: ${so.status}`);
      }
    }

    let customerId = input.customerId || '';
    let customerName = '';

    if (so) {
      customerId = so.customerId;
      customerName = so.customerName;
    } else {
      if (!customerId) throw new Error('customerId is required for standalone delivery note');
      const customer = await this.partyRepo.getById(input.companyId, customerId);
      if (!customer) throw new Error(`Customer not found: ${customerId}`);
      if (!customer.roles.includes('CUSTOMER')) throw new Error(`Party is not a customer: ${customerId}`);
      customerName = customer.displayName;
    }

    const sourceLines = this.resolveSourceLines(input.lines, so);
    const lines: DeliveryNoteLine[] = [];

    for (let i = 0; i < sourceLines.length; i += 1) {
      const line = sourceLines[i];
      const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
      const itemId = line.itemId || soLine?.itemId;
      if (!itemId) {
        throw new Error(`Line ${i + 1}: itemId is required`);
      }

      const item = await this.itemRepo.getItem(itemId);
      if (!item || item.companyId !== input.companyId) {
        throw new Error(`Item not found: ${itemId}`);
      }

      const deliveredQty = line.deliveredQty ?? (soLine ? Math.max(soLine.orderedQty - soLine.deliveredQty, 0) : 0);

      lines.push({
        lineId: line.lineId || randomUUID(),
        lineNo: line.lineNo ?? i + 1,
        soLineId: line.soLineId || soLine?.lineId,
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        deliveredQty,
        uomId: line.uomId || soLine?.uomId || item.salesUomId || item.baseUomId,
        uom: line.uom || soLine?.uom || item.salesUom || item.baseUom,
        unitCostBase: 0,
        lineCostBase: 0,
        moveCurrency: so?.currency || 'USD',
        fxRateMovToBase: so?.exchangeRate || 1,
        fxRateCCYToBase: so?.exchangeRate || 1,
        stockMovementId: null,
        description: line.description,
      });
    }

    const now = new Date();
    const dnNumber = await generateUniqueDocumentNumber(
      settings,
      'DN',
      async (candidate) => !!(await this.deliveryNoteRepo.getByNumber(input.companyId, candidate))
    );
    const dn = new DeliveryNote({
      id: randomUUID(),
      companyId: input.companyId,
      dnNumber,
      salesOrderId: so?.id,
      customerId,
      customerName,
      deliveryDate: input.deliveryDate,
      warehouseId: input.warehouseId,
      lines,
      status: 'DRAFT',
      notes: input.notes,
      cogsVoucherId: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    await this.deliveryNoteRepo.create(dn);
    await this.settingsRepo.saveSettings(settings);
    return dn;
  }

  private resolveSourceLines(lines: DeliveryNoteLineInput[] | undefined, so: SalesOrder | null): DeliveryNoteLineInput[] {
    if (Array.isArray(lines) && lines.length > 0) {
      return lines;
    }

    if (!so) {
      throw new Error('At least one line is required');
    }

    return so.lines
      .filter((line) => line.trackInventory && line.orderedQty - line.deliveredQty > 0)
      .map((line) => ({
        soLineId: line.lineId,
        itemId: line.itemId,
        deliveredQty: roundMoney(line.orderedQty - line.deliveredQty),
        uomId: line.uomId,
        uom: line.uom,
        description: line.description,
      }));
  }
}

export class PostDeliveryNoteUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly inventorySettingsRepo: IInventorySettingsRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: ISalesInventoryService,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly accountRepo: IAccountRepository | undefined,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string, createAccountingEffect: boolean = true): Promise<DeliveryNote> {
    // ===================================================================
    // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
    // We pre-fetch ALL data here. The postingLogic callback only writes.
    // ===================================================================

    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');
    const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(invSettings);
    const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
    const shouldPostDeliveryNoteAccounting =
      shouldPostAccounting && DocumentPolicyResolver.shouldPostDeliveryNoteAccounting(accountingMode);

    const dn = await this.deliveryNoteRepo.getById(companyId, id);
    if (!dn) throw new Error(`Delivery note not found: ${id}`);
    if (dn.status !== 'DRAFT') throw new Error('Only DRAFT delivery notes can be posted');

    const warehouse = await this.warehouseRepo.getWarehouse(dn.warehouseId);
    if (!warehouse || warehouse.companyId !== companyId) {
      throw new Error(`Warehouse not found: ${dn.warehouseId}`);
    }

    let so: SalesOrder | null = null;
    if (dn.salesOrderId) {
      so = await this.salesOrderRepo.getById(companyId, dn.salesOrderId);
      if (!so) throw new Error(`Sales order not found: ${dn.salesOrderId}`);
      if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
        throw new Error(`Sales order must be CONFIRMED or PARTIALLY_DELIVERED. Current: ${so.status}`);
      }
    }

    const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || dn.lines[0]?.moveCurrency || 'USD';

    // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads before transaction)
    const distinctItemIds = [...new Set(dn.lines.map(l => l.itemId))];
    const [itemsMap, categoriesMap] = await Promise.all([
      Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res =>
        new Map(res.filter((i): i is Item => !!i && i.companyId === companyId).map(i => [i.id, i]))
      ),
      this.itemCategoryRepo.getCompanyCategories(companyId).then(res =>
        new Map(res.map(c => [c.id, c]))
      ),
    ]);

    // Validate all items and track inventory requirement
    for (const line of dn.lines) {
      const item = itemsMap.get(line.itemId);
      if (!item || item.companyId !== companyId) throw new Error(`Item not found: ${line.itemId}`);
      if (!item.trackInventory) throw new Error(`Delivery note line item must track inventory: ${item.code}`);
    }

    // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
    const stockLevelMap = new Map<string, StockLevel>();
    for (const line of dn.lines) {
      const key = `${line.itemId}|${dn.warehouseId}`;
      if (!stockLevelMap.has(key)) {
        const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, dn.warehouseId);
        stockLevelMap.set(key, existing ?? StockLevel.createNew(companyId, line.itemId, dn.warehouseId));
      }
    }

    // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
    const uomConversionMap = new Map<string, any>();
    for (const itemId of distinctItemIds) {
      const item = itemsMap.get(itemId);
      if (item && !uomConversionMap.has(item.id)) {
        const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
        uomConversionMap.set(item.id, convs);
      }
    }

    // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION (pure computation)
    const inventoryMovements = new Map<string, { movement: StockMovement; updatedLevel: StockLevel; qtyInBaseUom: number }>();
    const cogsBucket = new Map<string, AccumulatedCOGS>();

    for (const line of dn.lines) {
      const item = itemsMap.get(line.itemId)!;

      const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
      if (so && !soLine) {
        throw new Error(`SO line not found for DN line ${line.lineId}`);
      }

      if (soLine) {
        const openQty = soLine.orderedQty - soLine.deliveredQty;
        if (!settings.allowOverDelivery) {
          if (line.deliveredQty > openQty + 0.000001) {
            throw new Error(`Delivered qty exceeds open qty for item ${line.itemName || soLine.itemName}`);
          }
        } else {
          const maxQty = openQty * (1 + settings.overDeliveryTolerancePct / 100);
          if (line.deliveredQty > maxQty + 0.000001) {
            throw new Error(`Delivered qty exceeds tolerance for item ${line.itemName || soLine.itemName}`);
          }
        }
      }

      const convs = uomConversionMap.get(item.id) || [];
      const conversionResult = convertItemQtyToBaseUomDetailed({
        qty: line.deliveredQty,
        item,
        conversions: convs,
        fromUomId: line.uomId,
        fromUom: line.uom,
        round: roundMoney,
        itemCode: item.code,
      });
      const qtyInBaseUom = conversionResult.qtyInBaseUom;

      const stockLevelKey = `${item.id}|${dn.warehouseId}`;
      const level = stockLevelMap.get(stockLevelKey);
      if (!level) throw new Error(`Stock level not pre-fetched for item ${item.code}`);

      const qtyBefore = level.qtyOnHand;
      const oldMaxBusinessDate = level.maxBusinessDate;
      let issueCostBase = 0;
      let issueCostCCY = 0;
      let costBasis: 'AVG' | 'LAST_KNOWN' | 'MISSING' = 'MISSING';
      if (qtyBefore > 0) {
        issueCostBase = level.avgCostBase;
        issueCostCCY = level.avgCostCCY;
        costBasis = 'AVG';
      } else if (level.lastCostBase > 0) {
        issueCostBase = level.lastCostBase;
        issueCostCCY = level.lastCostCCY;
        costBasis = 'LAST_KNOWN';
      }

      const settledQty = Math.min(qtyInBaseUom, Math.max(qtyBefore, 0));
      const unsettledQty = qtyInBaseUom - settledQty;
      const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;

      const movement = new StockMovement({
        id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        companyId,
        date: dn.deliveryDate,
        postingSeq: level.postingSeq + 1,
        createdAt: new Date(),
        createdBy: dn.createdBy,
        postedAt: new Date(),
        itemId: item.id,
        warehouseId: dn.warehouseId,
        direction: 'OUT',
        movementType: 'SALES_DELIVERY',
        qty: qtyInBaseUom,
        uom: item.baseUom,
        referenceType: 'DELIVERY_NOTE',
        referenceId: dn.id,
        referenceLineId: line.lineId,
        reversesMovementId: undefined,
        transferPairId: undefined,
        unitCostBase: issueCostBase,
        totalCostBase: roundMoney(issueCostBase * qtyInBaseUom),
        unitCostCCY: issueCostCCY,
        totalCostCCY: roundMoney(issueCostCCY * qtyInBaseUom),
        movementCurrency: item.costCurrency,
        fxRateMovToBase: effectiveFxCCYToBase,
        fxRateCCYToBase: effectiveFxCCYToBase,
        fxRateKind: 'EFFECTIVE',
        avgCostBaseAfter: level.avgCostBase,
        avgCostCCYAfter: level.avgCostCCY,
        qtyBefore,
        qtyAfter: qtyBefore - qtyInBaseUom,
        settledQty,
        unsettledQty,
        unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
        negativeQtyAtPosting: (qtyBefore - qtyInBaseUom) < 0,
        costSettled: unsettledQty === 0,
        isBackdated: dn.deliveryDate < oldMaxBusinessDate,
        costSource: 'PURCHASE',
        metadata: {
          uomConversion: {
            conversionId: conversionResult.trace.conversionId,
            mode: conversionResult.trace.mode,
            appliedFactor: conversionResult.trace.factor,
            sourceQty: line.deliveredQty,
            sourceUomId: line.uomId,
            sourceUom: line.uom,
            baseUomId: item.baseUomId,
            baseUom: item.baseUom,
          },
        },
      });

      level.qtyOnHand -= qtyInBaseUom;
      level.postingSeq += 1;
      level.version += 1;
      level.totalMovements += 1;
      level.maxBusinessDate = dn.deliveryDate > oldMaxBusinessDate ? dn.deliveryDate : oldMaxBusinessDate;
      level.updatedAt = new Date();
      level.lastMovementId = movement.id;

      line.stockMovementId = movement.id;
      line.unitCostBase = roundMoney(movement.unitCostBase || 0);
      line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);
      if (accountingMode === 'PERPETUAL') {
        this.assertPositiveTrackedCost(qtyInBaseUom, line.unitCostBase, line.itemName || item.name, `delivery note ${dn.dnNumber}`);
      }
      line.moveCurrency = movement.movementCurrency;
      line.fxRateMovToBase = movement.fxRateMovToBase;
      line.fxRateCCYToBase = movement.fxRateCCYToBase;

      inventoryMovements.set(line.lineId, { movement, updatedLevel: level, qtyInBaseUom });

      // PHASE 1E: PRE-RESOLVE COGS ACCOUNTS (bare reads before transaction)
      if (shouldPostDeliveryNoteAccounting) {
        const cogsAccountId = item.cogsAccountId
          || (item.categoryId ? categoriesMap.get(item.categoryId)?.defaultCogsAccountId : null)
          || invSettings?.defaultCOGSAccountId
          || settings.defaultCOGSAccountId;
        const inventoryAccountId = item.inventoryAssetAccountId
          || (item.categoryId ? categoriesMap.get(item.categoryId)?.defaultInventoryAssetAccountId : null)
          || invSettings?.defaultInventoryAssetAccountId
          || settings.defaultInventoryAccountId;

        if (!cogsAccountId) throw new Error(`No COGS account configured for item ${item.code}`);
        if (!inventoryAccountId) throw new Error(`No inventory account configured for item ${item.code}`);

        // Resolve account IDs through account repo (cache for duplicates)
        const resolvedCogsId = await this.resolveAccountId(companyId, cogsAccountId);
        const resolvedInventoryId = await this.resolveAccountId(companyId, inventoryAccountId);

        if (resolvedCogsId && resolvedInventoryId && line.lineCostBase > 0) {
          const key = `${resolvedCogsId}|${resolvedInventoryId}`;
          const existing = cogsBucket.get(key);
          if (existing) {
            existing.amountBase = roundMoney(existing.amountBase + line.lineCostBase);
          } else {
            cogsBucket.set(key, {
              cogsAccountId: resolvedCogsId,
              inventoryAccountId: resolvedInventoryId,
              amountBase: roundMoney(line.lineCostBase),
            });
          }
        }
      }

      if (soLine) {
        soLine.deliveredQty = roundMoney(soLine.deliveredQty + line.deliveredQty);
      }
    }

    // Pre-resolve base currency for voucher
    const resolvedBaseCurrency = (baseCurrency || dn.lines[0]?.moveCurrency || 'USD').toUpperCase();

    // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
    await this.transactionManager.runTransaction(async (transaction) => {
      // Write inventory movements and stock levels
      for (const [, { movement, updatedLevel }] of inventoryMovements) {
        await this.inventoryService.writeStockMovement(movement, transaction);
        await this.inventoryService.writeStockLevel(updatedLevel, transaction);
      }

      // Create COGS voucher if needed
      if (shouldPostDeliveryNoteAccounting && cogsBucket.size > 0) {
        const cogsVoucherLines: Array<Record<string, any>> = [];
        for (const entry of Array.from(cogsBucket.values())) {
          const amount = roundMoney(entry.amountBase);
          cogsVoucherLines.push({
            accountId: entry.cogsAccountId,
            side: 'Debit',
            amount,
            baseAmount: amount,
            docAmount: amount,
          });
          cogsVoucherLines.push({
            accountId: entry.inventoryAccountId,
            side: 'Credit',
            amount,
            baseAmount: amount,
            docAmount: amount,
          });
        }

        const voucher = await this.accountingPostingService.postInTransaction(
          {
            companyId,
            voucherType: VoucherType.JOURNAL_ENTRY,
            voucherNo: `DN-${dn.dnNumber}`,
            date: dn.deliveryDate,
            description: `Delivery Note ${dn.dnNumber} COGS`,
            currency: resolvedBaseCurrency,
            exchangeRate: 1,
            lines: cogsVoucherLines,
            metadata: {
              sourceModule: 'sales',
              sourceType: 'DELIVERY_NOTE',
              sourceId: dn.id,
              referenceType: 'DELIVERY_NOTE',
              referenceId: dn.id,
            },
            createdBy: dn.createdBy,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: dn.dnNumber,
            baseCurrencyOverride: resolvedBaseCurrency,
          },
          transaction
        );
        dn.cogsVoucherId = voucher.id;
      } else {
        dn.cogsVoucherId = null;
      }

      if (so) {
        so.status = updateSOStatus(so);
        so.updatedAt = new Date();
        await this.salesOrderRepo.update(so, transaction);
      }

      dn.status = 'POSTED';
      dn.postedAt = new Date();
      dn.updatedAt = new Date();
      await this.deliveryNoteRepo.update(dn, transaction);
    });

    const posted = await this.deliveryNoteRepo.getById(companyId, id);
    if (!posted) throw new Error(`Delivery note not found after posting: ${id}`);
    return posted;
  }

  private async resolveAccountId(companyId: string, idOrCode: string): Promise<string> {
    if (!idOrCode) return '';
    if (!this.accountRepo) return idOrCode;
    const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
    return acc ? acc.id : idOrCode;
  }

  private async isAccountingEnabled(companyId: string): Promise<boolean> {
    const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
    return !!accountingModule?.initialized;
  }

  private assertPositiveTrackedCost(qty: number, unitCostBase: number, itemName: string, documentLabel: string): void {
    if (qty > 0 && !(unitCostBase > 0)) {
      throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
    }
  }
}

export class GetDeliveryNoteUseCase {
  constructor(private readonly deliveryNoteRepo: IDeliveryNoteRepository) {}

  async execute(companyId: string, id: string): Promise<DeliveryNote> {
    const dn = await this.deliveryNoteRepo.getById(companyId, id);
    if (!dn) throw new Error(`Delivery note not found: ${id}`);
    return dn;
  }
}

export class ListDeliveryNotesUseCase {
  constructor(private readonly deliveryNoteRepo: IDeliveryNoteRepository) {}

  async execute(companyId: string, filters: ListDeliveryNotesFilters = {}): Promise<DeliveryNote[]> {
    return this.deliveryNoteRepo.list(companyId, {
      salesOrderId: filters.salesOrderId,
      status: filters.status,
      limit: filters.limit,
    });
  }
}

export interface UpdateDeliveryNoteInput {
  companyId: string;
  id: string;
  customerId?: string;
  deliveryDate?: string;
  warehouseId?: string;
  lines?: DeliveryNoteLineInput[];
  notes?: string;
}

export class UpdateDeliveryNoteUseCase {
  constructor(private readonly deliveryNoteRepo: IDeliveryNoteRepository, private readonly partyRepo: IPartyRepository) {}

  async execute(input: UpdateDeliveryNoteInput): Promise<DeliveryNote> {
    const current = await this.deliveryNoteRepo.getById(input.companyId, input.id);
    if (!current) throw new Error(`Delivery note not found: ${input.id}`);
    if (current.status !== 'DRAFT') {
      throw new Error('Only draft delivery notes can be updated');
    }

    if (input.customerId !== undefined) {
      if (!input.customerId) throw new Error('customerId is required');
      const customer = await this.partyRepo.getById(input.companyId, input.customerId);
      if (!customer) throw new Error(`Customer not found: ${input.customerId}`);
      if (!customer.roles.includes('CUSTOMER')) throw new Error(`Party is not a customer: ${input.customerId}`);
      current.customerId = customer.id;
      current.customerName = customer.displayName;
    }

    if (input.deliveryDate !== undefined) current.deliveryDate = input.deliveryDate;
    if (input.warehouseId !== undefined) current.warehouseId = input.warehouseId;
    if (input.notes !== undefined) current.notes = input.notes;

    if (input.lines) {
      const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
      const mappedLines: DeliveryNoteLine[] = input.lines.map((line, index) => {
        const existing = line.lineId ? existingById.get(line.lineId) : undefined;
        return {
          lineId: line.lineId || randomUUID(),
          lineNo: line.lineNo ?? existing?.lineNo ?? index + 1,
          soLineId: line.soLineId ?? existing?.soLineId,
          itemId: line.itemId || existing?.itemId || '',
          itemCode: existing?.itemCode || '',
          itemName: existing?.itemName || '',
          deliveredQty: line.deliveredQty,
          uomId: line.uomId ?? existing?.uomId,
          uom: line.uom || existing?.uom || 'EA',
          unitCostBase: existing?.unitCostBase ?? 0,
          lineCostBase: existing?.lineCostBase ?? 0,
          moveCurrency: existing?.moveCurrency || 'USD',
          fxRateMovToBase: existing?.fxRateMovToBase ?? 1,
          fxRateCCYToBase: existing?.fxRateCCYToBase ?? 1,
          stockMovementId: existing?.stockMovementId ?? null,
          description: line.description ?? existing?.description,
        };
      });
      current.lines = mappedLines;
    }

    current.updatedAt = new Date();
    const updated = new DeliveryNote(current.toJSON() as any);
    await this.deliveryNoteRepo.update(updated);
    return updated;
  }
}
