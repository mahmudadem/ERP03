import { randomUUID } from 'crypto';
import { PurchasePriceList, PurchasePriceListLine, PurchasePriceListProps } from '../../../domain/purchases/entities/PurchasePriceList';
import { IPurchasePriceListRepository, PurchasePriceListListOptions } from '../../../repository/interfaces/purchases/IPurchasePriceListRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';

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
}

export interface GetEffectivePurchasePriceResult {
  unitPrice: number;
  sourcePriceListId: string;
  sourceLineId: string;
  isDefault: boolean;
}

export class GetEffectivePurchasePriceUseCase {
  constructor(
    private readonly priceListRepo: IPurchasePriceListRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: GetEffectivePurchasePriceInput): Promise<GetEffectivePurchasePriceResult | null> {
    const asOf = input.asOfDate ?? new Date();

    const party = await this.partyRepo.getById(input.companyId, input.vendorId);
    const overridePriceListId: string | undefined = party?.defaultPriceListId ?? undefined;

    let resolvedList: PurchasePriceList | null = null;

    if (overridePriceListId) {
      const candidate = await this.priceListRepo.getById(input.companyId, overridePriceListId);
      if (candidate && candidate.isActiveOn(asOf)) {
        resolvedList = candidate;
      }
    }

    if (!resolvedList) {
      const fallbackCurrency = party?.defaultCurrency;
      if (fallbackCurrency) {
        const defaultList = await this.priceListRepo.getDefaultForCurrency(
          input.companyId,
          fallbackCurrency
        );
        if (defaultList && defaultList.isActiveOn(asOf)) {
          resolvedList = defaultList;
        }
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
      sourcePriceListId: resolvedList.id,
      sourceLineId,
      isDefault: resolvedList.isDefault,
    };
  }
}
