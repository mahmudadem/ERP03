import { randomUUID } from 'crypto';
import { PriceList, PriceListLine, PriceListProps } from '../../../domain/sales/entities/PriceList';
import { IPriceListRepository, PriceListListOptions } from '../../../repository/interfaces/sales/IPriceListRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';

// ---------------------------------------------------------------------------
// Shared input types
// ---------------------------------------------------------------------------

export interface PriceListLineInput {
  itemId: string;
  minQty?: number;
  unitPrice: number;
  discountPct?: number;
  comment?: string;
}

export interface CreatePriceListInput {
  companyId: string;
  name: string;
  currency: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date;
  validTo?: Date;
  isDefault?: boolean;
  lines?: PriceListLineInput[];
  createdBy: string;
}

export interface UpdatePriceListInput {
  companyId: string;
  id: string;
  name?: string;
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date | null;
  validTo?: Date | null;
  isDefault?: boolean;
  lines?: PriceListLineInput[];
  updatedBy?: string;
}

// ---------------------------------------------------------------------------
// CreatePriceListUseCase
// ---------------------------------------------------------------------------

export class CreatePriceListUseCase {
  constructor(
    private readonly priceListRepo: IPriceListRepository,
    private readonly txManager: ITransactionManager
  ) {}

  async execute(input: CreatePriceListInput): Promise<PriceList> {
    const lines: PriceListLine[] = (input.lines ?? []).map((l) => ({
      itemId: l.itemId,
      minQty: l.minQty ?? 1,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      comment: l.comment,
    }));

    const priceList = new PriceList({
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
      // Unset any existing default for the same (company, currency) within a transaction
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

// ---------------------------------------------------------------------------
// UpdatePriceListUseCase
// ---------------------------------------------------------------------------

export class UpdatePriceListUseCase {
  constructor(
    private readonly priceListRepo: IPriceListRepository,
    private readonly txManager: ITransactionManager
  ) {}

  async execute(input: UpdatePriceListInput): Promise<PriceList> {
    const existing = await this.priceListRepo.getById(input.companyId, input.id);
    if (!existing) {
      throw new Error(`PriceList not found: ${input.id}`);
    }

    // Apply mutations onto a new PriceList to re-run entity validation
    const currency = input.currency ?? existing.currency;
    const props: PriceListProps = {
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

    const updated = new PriceList(props);

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

// ---------------------------------------------------------------------------
// DeletePriceListUseCase
// ---------------------------------------------------------------------------

export class DeletePriceListUseCase {
  constructor(private readonly priceListRepo: IPriceListRepository) {}

  async execute(companyId: string, id: string): Promise<void> {
    const existing = await this.priceListRepo.getById(companyId, id);
    if (!existing) {
      throw new Error(`PriceList not found: ${id}`);
    }
    await this.priceListRepo.delete(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// GetPriceListUseCase
// ---------------------------------------------------------------------------

export class GetPriceListUseCase {
  constructor(private readonly priceListRepo: IPriceListRepository) {}

  async execute(companyId: string, id: string): Promise<PriceList | null> {
    return this.priceListRepo.getById(companyId, id);
  }
}

// ---------------------------------------------------------------------------
// ListPriceListsUseCase
// ---------------------------------------------------------------------------

export interface ListPriceListsOptions {
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export class ListPriceListsUseCase {
  constructor(private readonly priceListRepo: IPriceListRepository) {}

  async execute(companyId: string, options?: ListPriceListsOptions): Promise<PriceList[]> {
    const opts: PriceListListOptions = {
      currency: options?.currency,
      status: options?.status,
      includeInactive: options?.includeInactive,
      limit: options?.limit,
      offset: options?.offset,
    };
    return this.priceListRepo.list(companyId, opts);
  }
}

// ---------------------------------------------------------------------------
// GetEffectivePriceUseCase
// ---------------------------------------------------------------------------

export interface GetEffectivePriceInput {
  companyId: string;
  customerId: string;
  itemId: string;
  qty: number;
  asOfDate?: Date;
}

export interface GetEffectivePriceResult {
  unitPrice: number;
  sourcePriceListId: string;
  sourceLineId: string;
  isDefault: boolean;
}

export class GetEffectivePriceUseCase {
  constructor(
    private readonly priceListRepo: IPriceListRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: GetEffectivePriceInput): Promise<GetEffectivePriceResult | null> {
    const asOf = input.asOfDate ?? new Date();

    // Step 1: Check if the customer Party has a defaultPriceListId override
    const party = await this.partyRepo.getById(input.companyId, input.customerId);
    const overridePriceListId: string | undefined = party?.defaultPriceListId ?? undefined;

    let resolvedList: PriceList | null = null;

    if (overridePriceListId) {
      const candidate = await this.priceListRepo.getById(input.companyId, overridePriceListId);
      if (candidate && candidate.isActiveOn(asOf)) {
        resolvedList = candidate;
      }
    }

    // Step 2: Fall back to the default price list for the company's invoice currency
    // For now we rely on getDefaultForCurrency since we don't have the invoice currency
    // in this context — the caller should pass the relevant currency in a future revision.
    // We try without a specific currency (getDefaultForCurrency needs one — caller must
    // provide it indirectly through the party's defaultCurrency if available).
    if (!resolvedList) {
      // Use party's defaultCurrency as a hint for which default list to pick
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

    // Step 3: Find the effective line
    const line = resolvedList.getEffectiveLine(input.itemId, input.qty);
    if (!line) {
      return null;
    }

    // Build a stable line key (itemId + minQty acts as the composite id)
    const sourceLineId = `${line.itemId}:${line.minQty}`;

    return {
      unitPrice: line.unitPrice,
      sourcePriceListId: resolvedList.id,
      sourceLineId,
      isDefault: resolvedList.isDefault,
    };
  }
}
