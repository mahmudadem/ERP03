import { randomUUID } from 'crypto';
import { PurchasePriceList, PurchasePriceListLine, PurchasePriceListProps } from '../../../domain/purchases/entities/PurchasePriceList';
import { CostPoint } from '../../../domain/inventory/entities/Item';
import { roundByCurrency } from '../../../domain/accounting/entities/CurrencyPrecisionHelpers';
import { IPurchasePriceListRepository, PurchasePriceListListOptions } from '../../../repository/interfaces/purchases/IPurchasePriceListRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { IUomConversionRepository } from '../../../repository/interfaces/inventory/IUomConversionRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { IPartyItemPriceRepository } from '../../../repository/interfaces/shared/IPartyItemPriceRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { convertItemQtyToBaseUomDetailed } from '../../inventory/services/UomResolutionService';
import { buildCcyUomKey } from '../../inventory/services/ItemCostingStatsService';

export interface PurchasePriceListLineInput {
  itemId: string;
  minQty?: number;
  unitPrice: number;
  discountPct?: number;
  comment?: string;
}

export interface CreatePurchasePriceListInput {
  companyId: string;
  name: string;
  currency: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date;
  validTo?: Date;
  isDefault?: boolean;
  lines?: PurchasePriceListLineInput[];
  createdBy: string;
}

export interface UpdatePurchasePriceListInput {
  companyId: string;
  id: string;
  name?: string;
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date | null;
  validTo?: Date | null;
  isDefault?: boolean;
  lines?: PurchasePriceListLineInput[];
  updatedBy?: string;
}

export class CreatePurchasePriceListUseCase {
  constructor(
    private readonly priceListRepo: IPurchasePriceListRepository,
    private readonly txManager: ITransactionManager
  ) {}

  async execute(input: CreatePurchasePriceListInput): Promise<PurchasePriceList> {
    const lines: PurchasePriceListLine[] = (input.lines ?? []).map((l) => ({
      itemId: l.itemId,
      minQty: l.minQty ?? 1,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      comment: l.comment,
    }));

    const priceList = new PurchasePriceList({
      companyId: input.companyId,
      name: input.name,
      currency: input.currency,
      status: input.status ?? 'ACTIVE',
      validFrom: input.validFrom,
      validTo: input.validTo,
      isDefault: input.isDefault ?? false,
      lines,
      createdBy: input.createdBy,
    });

    if (priceList.isDefault) {
      await this.txManager.runTransaction(async (txn) => {
        const existing = await this.priceListRepo.getDefaultForCurrency(
          input.companyId,
          priceList.currency
        );
        if (existing && existing.id !== priceList.id) {
          existing.isDefault = false;
          existing.updatedAt = new Date();
          await this.priceListRepo.update(existing, txn);
        }
        await this.priceListRepo.create(priceList, txn);
      });
    } else {
      await this.priceListRepo.create(priceList);
    }

    return priceList;
  }
}

export class UpdatePurchasePriceListUseCase {
  constructor(
    private readonly priceListRepo: IPurchasePriceListRepository,
    private readonly txManager: ITransactionManager
  ) {}

  async execute(input: UpdatePurchasePriceListInput): Promise<PurchasePriceList> {
    const existing = await this.priceListRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`PurchasePriceList not found: ${input.id}`);
    }

    const currency = input.currency ?? existing.currency;
    const props: PurchasePriceListProps = {
      id: existing.id,
      companyId: existing.companyId,
      name: input.name ?? existing.name,
      currency,
      status: input.status ?? existing.status,
      validFrom: input.validFrom !== undefined
        ? (input.validFrom ?? undefined)
        : existing.validFrom,
      validTo: input.validTo !== undefined
        ? (input.validTo ?? undefined)
        : existing.validTo,
      isDefault: input.isDefault !== undefined ? input.isDefault : existing.isDefault,
      lines: input.lines
        ? input.lines.map((l) => ({
            itemId: l.itemId,
            minQty: l.minQty ?? 1,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            comment: l.comment,
          }))
        : existing.lines,
      createdBy: existing.createdBy,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };

    const updated = new PurchasePriceList(props);

    if (updated.isDefault) {
      await this.txManager.runTransaction(async (txn) => {
        const currentDefault = await this.priceListRepo.getDefaultForCurrency(
          updated.companyId,
          updated.currency
        );
        if (currentDefault && currentDefault.id !== updated.id) {
          currentDefault.isDefault = false;
          currentDefault.updatedAt = new Date();
          await this.priceListRepo.update(currentDefault, txn);
        }
        await this.priceListRepo.update(updated, txn);
      });
    } else {
      await this.priceListRepo.update(updated);
    }

    return updated;
  }
}

export class DeletePurchasePriceListUseCase {
  constructor(private readonly priceListRepo: IPurchasePriceListRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.priceListRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`PurchasePriceList not found: ${id}`);
    }
    await this.priceListRepo.delete(companyId, id);
  }
}

export class GetPurchasePriceListUseCase {
  constructor(private readonly priceListRepo: IPurchasePriceListRepository) {}

  async execute(companyId: string, id: string): Promise<PurchasePriceList | null> {
    return this.priceListRepo.getById(companyId, id);
  }
}

export interface ListPurchasePriceListsOptions {
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export class ListPurchasePriceListsUseCase {
  constructor(private readonly priceListRepo: IPurchasePriceListRepository) {}

  async execute(companyId: string, options?: ListPurchasePriceListsOptions): Promise<PurchasePriceList[]> {
    const opts: PurchasePriceListListOptions = {
      currency: options?.currency,
      status: options?.status,
      includeInactive: options?.includeInactive,
      limit: options?.limit,
      offset: options?.offset,
    };
    return this.priceListRepo.list(companyId, opts);
  }
}

export interface GetEffectivePurchasePriceInput {
  companyId: string;
  vendorId: string;
  itemId: string;
  qty: number;
  asOfDate?: Date;
  currency?: string;
  exchangeRate?: number;
  uomId?: string;
  uom?: string;
}

export interface GetEffectivePurchasePriceResult {
  unitPrice: number;
  source: 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'LAST_EVENT' | 'ITEM_DEFAULT';
  sourcePriceListId?: string;
  sourceLineId?: string;
  isDefault?: boolean;
  currency?: string;
  uomId?: string;
  derived?: boolean;
  derivedFromUomId?: string;
  pricePoint?: CostPoint;
}

export class GetEffectivePurchasePriceUseCase {
  constructor(
    private readonly priceListRepo: IPurchasePriceListRepository | undefined,
    private readonly partyRepo: IPartyRepository,
    private readonly partyItemPriceRepo?: IPartyItemPriceRepository,
    private readonly itemRepo?: IItemRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository,
    private readonly purchaseSettingsRepo?: IPurchaseSettingsRepository,
    private readonly uomConversionRepo?: IUomConversionRepository
  ) {}

  async execute(input: GetEffectivePurchasePriceInput): Promise<GetEffectivePurchasePriceResult | null> {
    const asOf = input.asOfDate ?? new Date();
    const party = await this.partyRepo.getById(input.companyId, input.vendorId);
    const documentCurrency = this.normalizeCurrency(input.currency) ?? this.normalizeCurrency(party?.defaultCurrency);
    const settings = await this.inventorySettingsRepo?.getSettings(input.companyId);
    const purchaseSettings = await this.purchaseSettingsRepo?.getSettings(input.companyId);
    const item = this.itemRepo ? await this.itemRepo.getItem(input.itemId) : null;
    const targetUomId = this.resolveTargetUomId(input.uomId, input.uom, item);

    for (const source of this.buildSourceOrder(settings?.defaultLinePriceSource)) {
      if (source === 'PRICE_LIST') {
        const resolved = await this.resolveFromPriceList(input, asOf, party?.defaultPriceListId, documentCurrency);
        if (resolved) return resolved;
      } else if (source === 'LAST_PARTY_PRICE') {
        const resolved = await this.resolveFromPartyMemory(
          input,
          documentCurrency,
          targetUomId,
          purchaseSettings?.deriveLinePriceAcrossUom === true,
          item
        );
        if (resolved) return resolved;
      } else if (source === 'LAST_EVENT') {
        const resolved = await this.resolveFromItemLastEvent(input, documentCurrency, targetUomId, item);
        if (resolved) return resolved;
      } else {
        const resolved = await this.resolveFromItemDefault(input, documentCurrency, targetUomId, item);
        if (resolved) return resolved;
      }
    }

    return null;
  }

  private buildSourceOrder(configured?: string): GetEffectivePurchasePriceResult['source'][] {
    if (configured === 'PRICE_LIST' || configured === 'ITEM_DEFAULT') {
      return [configured];
    }
    return ['LAST_PARTY_PRICE'];
  }

  private normalizeCurrency(value?: string | null): string | undefined {
    const normalized = value?.trim().toUpperCase();
    return normalized || undefined;
  }

  private async resolveFromPriceList(
    input: GetEffectivePurchasePriceInput,
    asOf: Date,
    overridePriceListId?: string,
    documentCurrency?: string
  ): Promise<GetEffectivePurchasePriceResult | null> {
    if (!this.priceListRepo) return null;
    let resolvedList: PurchasePriceList | null = null;

    if (overridePriceListId) {
      const candidate = await this.priceListRepo.getById(input.companyId, overridePriceListId);
      if (candidate && candidate.isActiveOn(asOf) && (!documentCurrency || this.normalizeCurrency(candidate.currency) === documentCurrency)) {
        resolvedList = candidate;
      }
    }

    if (!resolvedList && documentCurrency) {
      const defaultList = await this.priceListRepo.getDefaultForCurrency(
        input.companyId,
        documentCurrency
      );
      if (defaultList && defaultList.isActiveOn(asOf)) {
        resolvedList = defaultList;
      }
    }

    if (!resolvedList) {
      return null;
    }

    const line = resolvedList.getEffectiveLine(input.itemId, input.qty);
    if (!line) {
      return null;
    }

    const sourceLineId = `${line.itemId}:${line.minQty}`;

    return {
      unitPrice: line.unitPrice,
      source: 'PRICE_LIST',
      sourcePriceListId: resolvedList.id,
      sourceLineId,
      isDefault: resolvedList.isDefault,
      currency: this.normalizeCurrency(resolvedList.currency),
    };
  }

  private async resolveFromPartyMemory(
    input: GetEffectivePurchasePriceInput,
    documentCurrency?: string,
    targetUomId?: string,
    deriveAcrossUom = false,
    item?: any
  ): Promise<GetEffectivePurchasePriceResult | null> {
    if (!this.partyItemPriceRepo || !documentCurrency || !targetUomId) return null;
    const record = await this.partyItemPriceRepo.get(input.companyId, input.vendorId, input.itemId);
    const point = record?.lastPurchaseByCcyUom?.[buildCcyUomKey(documentCurrency, targetUomId)];
    if (!point && deriveAcrossUom) {
      const derived = await this.deriveSameCurrencyAcrossUom({
        map: record?.lastPurchaseByCcyUom,
        documentCurrency,
        targetUomId,
        item,
        companyId: input.companyId,
      });
      if (derived) return derived;
    }
    if (!point) return null;
    return {
      unitPrice: point.ccy,
      source: 'LAST_PARTY_PRICE',
      currency: documentCurrency,
      uomId: targetUomId,
      pricePoint: point,
    };
  }

  private async resolveFromItemLastEvent(
    input: GetEffectivePurchasePriceInput,
    documentCurrency?: string,
    targetUomId?: string,
    item?: any
  ): Promise<GetEffectivePurchasePriceResult | null> {
    if (!documentCurrency || !targetUomId || !item || item.companyId !== input.companyId) return null;
    const point = item.costingStats?.lastPurchaseCostByCcyUom?.[buildCcyUomKey(documentCurrency, targetUomId)];
    if (!point) return null;
    return {
      unitPrice: point.ccy,
      source: 'LAST_EVENT',
      currency: documentCurrency,
      uomId: targetUomId,
      pricePoint: point,
    };
  }

  private async resolveFromItemDefault(
    input: GetEffectivePurchasePriceInput,
    documentCurrency?: string,
    targetUomId?: string,
    item?: any
  ): Promise<GetEffectivePurchasePriceResult | null> {
    if (!item || item.companyId !== input.companyId) return null;
    if (item.purchasePrice === undefined || item.purchasePrice === null || !Number.isFinite(item.purchasePrice)) return null;
    const itemCurrency = this.normalizeCurrency(item.costCurrency);
    if (documentCurrency && itemCurrency && itemCurrency !== documentCurrency) return null;
    return {
      unitPrice: item.purchasePrice,
      source: 'ITEM_DEFAULT',
      currency: documentCurrency ?? itemCurrency,
      uomId: targetUomId,
    };
  }

  private resolveTargetUomId(uomId: string | undefined, uom: string | undefined, item: any): string | undefined {
    if (uomId?.trim()) return uomId.trim();
    if (!item) return uom?.trim() || undefined;
    return item.purchaseUomId?.trim() || item.baseUomId?.trim() || uom?.trim() || item.baseUom?.trim();
  }

  private async deriveSameCurrencyAcrossUom({
    map,
    documentCurrency,
    targetUomId,
    item,
    companyId,
  }: {
    map?: Record<string, CostPoint>;
    documentCurrency: string;
    targetUomId: string;
    item?: any;
    companyId: string;
  }): Promise<GetEffectivePurchasePriceResult | null> {
    if (!map || !item || !this.uomConversionRepo) return null;
    const candidates = Object.values(map)
      .filter((point) => this.normalizeCurrency(point.currency) === documentCurrency && !!point.uomId && point.uomId !== targetUomId)
      .sort((a, b) => String(b.asOf).localeCompare(String(a.asOf)));
    const sourcePoint = candidates[0];
    if (!sourcePoint?.uomId) return null;

    const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
    const sourceFactor = this.factorToBase(item, conversions, sourcePoint.uomId);
    const targetFactor = this.factorToBase(item, conversions, targetUomId);
    if (!(sourceFactor > 0) || !(targetFactor > 0)) return null;

    const unitPrice = roundByCurrency((sourcePoint.ccy / sourceFactor) * targetFactor, documentCurrency);
    return {
      unitPrice,
      source: 'LAST_PARTY_PRICE',
      currency: documentCurrency,
      uomId: targetUomId,
      derived: true,
      derivedFromUomId: sourcePoint.uomId,
      pricePoint: sourcePoint,
    };
  }

  private factorToBase(item: any, conversions: any[], uomId: string): number {
    return convertItemQtyToBaseUomDetailed({
      qty: 1,
      item,
      conversions,
      fromUomId: uomId,
      round: (value) => value,
      itemCode: item.code,
    }).qtyInBaseUom;
  }
}
