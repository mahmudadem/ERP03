import { randomUUID } from 'crypto';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { DeliveryNote, DeliveryNoteLine } from '../../../domain/sales/entities/DeliveryNote';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
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
  ItemQtyToBaseUomResult,
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
    private readonly accountingPostingService: SubledgerVoucherPostingService,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<DeliveryNote> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');
    const inventorySettings = await this.inventorySettingsRepo.getSettings(companyId);
    const accountingMode = DocumentPolicyResolver.resolveAccountingMode(inventorySettings);

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
    const cogsBucket = new Map<string, AccumulatedCOGS>();

    await this.transactionManager.runTransaction(async (transaction) => {
      for (const line of dn.lines) {
        const item = await this.itemRepo.getItem(line.itemId);
        if (!item || item.companyId !== companyId) {
          throw new Error(`Item not found: ${line.itemId}`);
        }
        if (!item.trackInventory) {
          throw new Error(`Delivery note line item must track inventory: ${item.code}`);
        }

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

        const conversionResult = await this.convertToBaseUom(
          companyId,
          line.deliveredQty,
          line.uomId,
          line.uom,
          item
        );
        const qtyInBaseUom = conversionResult.qtyInBaseUom;

        const movement = await this.inventoryService.processOUT({
          companyId,
          itemId: line.itemId,
          warehouseId: dn.warehouseId,
          qty: qtyInBaseUom,
          date: dn.deliveryDate,
          movementType: 'SALES_DELIVERY',
          refs: {
            type: 'DELIVERY_NOTE',
            docId: dn.id,
            lineId: line.lineId,
          },
          currentUser: dn.createdBy,
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
          transaction,
        });

        line.stockMovementId = movement.id;
        line.unitCostBase = roundMoney(movement.unitCostBase || 0);
        line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);
        this.assertPositiveTrackedCost(qtyInBaseUom, line.unitCostBase, line.itemName || item.name, `delivery note ${dn.dnNumber}`);
        line.moveCurrency = movement.movementCurrency;
        line.fxRateMovToBase = movement.fxRateMovToBase;
        line.fxRateCCYToBase = movement.fxRateCCYToBase;

        const accounts = await this.resolveCOGSAccounts(
          companyId,
          item.id,
          settings.defaultCOGSAccountId,
          settings.defaultInventoryAccountId
        );
        if (accounts.cogsAccountId && accounts.inventoryAccountId && line.lineCostBase > 0) {
          const key = `${accounts.cogsAccountId}|${accounts.inventoryAccountId}`;
          const existing = cogsBucket.get(key);
          if (existing) {
            existing.amountBase = roundMoney(existing.amountBase + line.lineCostBase);
          } else {
            cogsBucket.set(key, {
              cogsAccountId: accounts.cogsAccountId,
              inventoryAccountId: accounts.inventoryAccountId,
              amountBase: roundMoney(line.lineCostBase),
            });
          }
        }

        if (soLine) {
          soLine.deliveredQty = roundMoney(soLine.deliveredQty + line.deliveredQty);
        }
      }

      if (DocumentPolicyResolver.shouldPostDeliveryNoteAccounting(accountingMode) && cogsBucket.size > 0) {
        const cogsVoucherLines: Array<Record<string, any>> = [];
        for (const line of Array.from(cogsBucket.values())) {
          const amount = roundMoney(line.amountBase);
          cogsVoucherLines.push({
            accountId: line.cogsAccountId,
            side: 'Debit',
            amount,
            baseAmount: amount,
            docAmount: amount,
          });
          cogsVoucherLines.push({
            accountId: line.inventoryAccountId,
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
            currency: baseCurrency,
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

  private async resolveCOGSAccounts(
    companyId: string,
    itemId: string,
    defaultCOGSAccountId?: string,
    defaultInventoryAccountId?: string
  ): Promise<{ cogsAccountId: string; inventoryAccountId: string }> {
    const item = await this.itemRepo.getItem(itemId);
    if (!item) throw new Error(`Item not found while resolving COGS accounts: ${itemId}`);

    let category: any = null;
    if (item.categoryId) {
      category = await this.itemCategoryRepo.getCategory(item.categoryId);
      if (category?.companyId !== companyId) {
        category = null;
      }
    }

    const cogsAccountId =
      item.cogsAccountId
      || category?.defaultCogsAccountId
      || defaultCOGSAccountId;

    const inventoryAccountId =
      item.inventoryAssetAccountId
      || category?.defaultInventoryAssetAccountId
      || defaultInventoryAccountId;

    if (!cogsAccountId) {
      throw new Error(`No COGS account configured for item ${item.code}`);
    }
    if (!inventoryAccountId) {
      throw new Error(`No inventory account configured for item ${item.code}`);
    }

    return { cogsAccountId, inventoryAccountId };
  }

  private async convertToBaseUom(
    companyId: string,
    qty: number,
    uomId: string | undefined,
    uom: string,
    item: NonNullable<Awaited<ReturnType<IItemRepository['getItem']>>>
  ): Promise<ItemQtyToBaseUomResult> {
    const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
    return convertItemQtyToBaseUomDetailed({
      qty,
      item,
      conversions,
      fromUomId: uomId,
      fromUom: uom,
      round: roundMoney,
      itemCode: item.code,
    });
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
