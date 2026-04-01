import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { DeliveryNote, DeliveryNoteLine } from '../../../domain/sales/entities/DeliveryNote';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { ISalesInventoryService } from '../../inventory/contracts/InventoryIntegrationContracts';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { ICompanyCurrencyRepository } from '../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IItemCategoryRepository } from '../../../repository/interfaces/inventory/IItemCategoryRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { generateDocumentNumber } from './SalesOrderUseCases';
import { roundMoney, updateSOStatus } from './SalesPostingHelpers';

export interface DeliveryNoteLineInput {
  lineId?: string;
  lineNo?: number;
  soLineId?: string;
  itemId?: string;
  deliveredQty: number;
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

    if (settings.salesControlMode === 'CONTROLLED' && !input.salesOrderId) {
      throw new Error('salesOrderId is required in CONTROLLED mode');
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
    const dn = new DeliveryNote({
      id: randomUUID(),
      companyId: input.companyId,
      dnNumber: generateDocumentNumber(settings, 'DN'),
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
        uom: line.uom,
        description: line.description,
      }));
  }
}

export class PostDeliveryNoteUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly itemRepo: IItemRepository,
    private readonly itemCategoryRepo: IItemCategoryRepository,
    private readonly warehouseRepo: IWarehouseRepository,
    private readonly uomConversionRepo: IUomConversionRepository,
    private readonly companyCurrencyRepo: ICompanyCurrencyRepository,
    private readonly inventoryService: ISalesInventoryService,
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(companyId: string, id: string): Promise<DeliveryNote> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) throw new Error('Sales module is not initialized');

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

        const qtyInBaseUom = await this.convertToBaseUom(companyId, line.deliveredQty, line.uom, item.baseUom, item.id, item.code);

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
          transaction,
        });

        line.stockMovementId = movement.id;
        line.unitCostBase = roundMoney(movement.unitCostBase || 0);
        line.lineCostBase = roundMoney(qtyInBaseUom * line.unitCostBase);
        line.moveCurrency = movement.movementCurrency;
        line.fxRateMovToBase = movement.fxRateMovToBase;
        line.fxRateCCYToBase = movement.fxRateCCYToBase;

        const accounts = await this.resolveCOGSAccounts(companyId, item.id, settings.defaultCOGSAccountId);
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

      if (cogsBucket.size > 0) {
        const voucher = await this.createCOGSVoucherInTransaction(transaction, dn, baseCurrency, Array.from(cogsBucket.values()));
        dn.cogsVoucherId = voucher.id;
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
    defaultCOGSAccountId?: string
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
      || category?.defaultInventoryAssetAccountId;

    if (!cogsAccountId) {
      throw new Error(`No COGS account configured for item ${item.code}`);
    }
    if (!inventoryAccountId) {
      throw new Error(`No inventory account configured for item ${item.code}`);
    }

    return { cogsAccountId, inventoryAccountId };
  }

  private async createCOGSVoucherInTransaction(
    transaction: unknown,
    dn: DeliveryNote,
    baseCurrency: string,
    lines: AccumulatedCOGS[]
  ): Promise<VoucherEntity> {
    const now = new Date();
    const voucherLines: VoucherLineEntity[] = [];

    let seq = 1;
    for (const line of lines) {
      const amount = roundMoney(line.amountBase);
      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.cogsAccountId,
          'Debit',
          amount,
          baseCurrency,
          amount,
          baseCurrency,
          1,
          `COGS - DN ${dn.dnNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'DELIVERY_NOTE',
            sourceId: dn.id,
          }
        )
      );

      voucherLines.push(
        new VoucherLineEntity(
          seq++,
          line.inventoryAccountId,
          'Credit',
          amount,
          baseCurrency,
          amount,
          baseCurrency,
          1,
          `Inventory reduction - DN ${dn.dnNumber}`,
          undefined,
          {
            sourceModule: 'sales',
            sourceType: 'DELIVERY_NOTE',
            sourceId: dn.id,
          }
        )
      );
    }

    const totalDebit = roundMoney(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = roundMoney(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));

    const voucher = new VoucherEntity(
      randomUUID(),
      dn.companyId,
      `DN-${dn.dnNumber}`,
      VoucherType.JOURNAL_ENTRY,
      dn.deliveryDate,
      `Delivery Note ${dn.dnNumber} COGS`,
      baseCurrency,
      baseCurrency,
      1,
      voucherLines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      {
        sourceModule: 'sales',
        sourceType: 'DELIVERY_NOTE',
        sourceId: dn.id,
        referenceType: 'DELIVERY_NOTE',
        referenceId: dn.id,
      },
      dn.createdBy,
      now,
      dn.createdBy,
      now
    );

    const postedVoucher = voucher.post(dn.createdBy, now, PostingLockPolicy.FLEXIBLE_LOCKED);
    await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
    await this.voucherRepo.save(postedVoucher, transaction);
    return postedVoucher;
  }

  private async convertToBaseUom(
    companyId: string,
    qty: number,
    uom: string,
    baseUom: string,
    itemId: string,
    itemCode: string
  ): Promise<number> {
    if (uom.toUpperCase() === baseUom.toUpperCase()) {
      return qty;
    }

    const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, itemId, { active: true });
    const normalizedFrom = uom.toUpperCase();
    const normalizedTo = baseUom.toUpperCase();

    const direct = conversions.find(
      (conversion) =>
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedFrom &&
        conversion.toUom.toUpperCase() === normalizedTo
    );
    if (direct) return roundMoney(qty * direct.factor);

    const reverse = conversions.find(
      (conversion) =>
        conversion.active &&
        conversion.fromUom.toUpperCase() === normalizedTo &&
        conversion.toUom.toUpperCase() === normalizedFrom
    );
    if (reverse) return roundMoney(qty / reverse.factor);

    throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
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
