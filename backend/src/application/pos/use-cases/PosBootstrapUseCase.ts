import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IItemRepository } from '../../../repository/interfaces/inventory/IItemRepository';
import { ITaxCodeRepository } from '../../../repository/interfaces/shared/ITaxCodeRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { Item } from '../../../domain/inventory/entities/Item';
import { PosSettings } from '../../../domain/pos/entities/PosSettings';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { ICommercialCore } from '../../system-core';

export interface GetPosBootstrapInput {
  companyId: string;
  registerId?: string;
  cashierUserId?: string;
}

export interface PosBootstrapResult {
  register?: PosRegister;
  openShift?: PosShift;
  settings: PosSettings;
}

/**
 * One round-trip used by the cashier screen to hydrate: settings,
 * the active register, and the cashier's open shift on that register.
 */
export class GetPosBootstrapUseCase {
  constructor(
    private readonly registerRepo: IPosRegisterRepository,
    private readonly settingsRepo: IPosSettingsRepository,
    private readonly shiftRepo: IPosShiftRepository,
    private readonly itemRepo: IItemRepository,
    private readonly taxCodeRepo: ITaxCodeRepository,
    private readonly partyRepo: IPartyRepository
  ) {}

  async execute(input: GetPosBootstrapInput): Promise<PosBootstrapResult> {
    let settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) {
      settings = PosSettings.createDefault(input.companyId);
      await this.settingsRepo.saveSettings(settings);
    }
    const result: PosBootstrapResult = { settings };

    if (input.registerId) {
      result.register = (await this.registerRepo.getById(input.companyId, input.registerId)) || undefined;
    }
    if (input.registerId) {
      result.openShift =
        (await this.shiftRepo.getOpenShiftForRegister(input.companyId, input.registerId)) || undefined;
    }
    void this.itemRepo;
    void this.taxCodeRepo;
    void this.partyRepo;
    return result;
  }
}

export interface SearchPosProductsInput {
  companyId: string;
  query: string;
  limit?: number;
}

export interface PosProductSearchResult {
  items: Array<{
    id: string;
    code: string;
    barcode?: string;
    name: string;
    type: 'PRODUCT' | 'SERVICE';
    trackInventory: boolean;
    baseUom: string;
    salesUomId?: string;
    defaultSalesTaxCodeId?: string;
    salePrice?: number;
  }>;
}

/**
 * Lightweight product search for the cashier screen. Code/barcode/prefix-name
 * match. Limited. Price display goes through Commercial Core and falls back to
 * the item's salePrice when no resolver result exists.
 */
export class SearchPosProductsUseCase {
  constructor(
    private readonly itemRepo: IItemRepository,
    private readonly commercialCore?: ICommercialCore
  ) {}

  async execute(input: SearchPosProductsInput): Promise<PosProductSearchResult> {
    const q = (input.query || '').trim();
    if (!q) return { items: [] };
    const all = await this.itemRepo.searchItems(input.companyId, q, { limit: input.limit || 25, active: true });
    const items = await Promise.all((all || []).map(async (it: Item) => {
      const resolvedPrice = await this.commercialCore?.resolvePrice({
        companyId: input.companyId,
        itemId: it.id,
        channel: 'pos',
        uomId: it.salesUomId,
      });
      return {
        id: it.id,
        code: it.code,
        barcode: it.barcode,
        name: it.name,
        type: (it.type === 'SERVICE' ? 'SERVICE' : 'PRODUCT') as 'PRODUCT' | 'SERVICE',
        trackInventory: !!it.trackInventory,
        baseUom: it.baseUom,
        salesUomId: it.salesUomId,
        defaultSalesTaxCodeId: it.defaultSalesTaxCodeId,
        salePrice: resolvedPrice ?? it.salePrice,
      };
    }));
    return {
      items,
    };
  }
}
