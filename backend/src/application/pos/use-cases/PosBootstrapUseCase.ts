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

    // Resolve the active register. The cashier screen calls bootstrap WITHOUT a
    // registerId, so we must pick a sensible default: a lone active register
    // (or a lone register of any status). Without this, register/openShift stay
    // undefined and the terminal wrongly reports "No open shift for this register"
    // even when one is open.
    let register: PosRegister | undefined;
    if (input.registerId) {
      register = (await this.registerRepo.getById(input.companyId, input.registerId)) || undefined;
    } else {
      const registers = await this.registerRepo.list(input.companyId);
      const active = registers.filter((r) => r.status === 'ACTIVE');
      register =
        active.length === 1 ? active[0] : registers.length === 1 ? registers[0] : undefined;
    }

    // Resolve the open shift: prefer the register's open shift; otherwise fall
    // back to the cashier's open shift (and hydrate its register if we have none).
    let openShift: PosShift | undefined;
    if (register) {
      openShift =
        (await this.shiftRepo.getOpenShiftForRegister(input.companyId, register.id)) || undefined;
    }
    if (!openShift && input.cashierUserId) {
      openShift =
        (await this.shiftRepo.getOpenShiftForCashier(input.companyId, input.cashierUserId)) ||
        undefined;
      if (openShift && !register) {
        register = (await this.registerRepo.getById(input.companyId, openShift.registerId)) || undefined;
      }
    }

    result.register = register;
    result.openShift = openShift;
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
 * match. Limited. We do NOT call the effective-price resolver from the Sales
 * settings here — the price the cashier sees is the item's `salePrice`. The
 * SI calculation in CreateSalesInvoiceUseCase is the source of truth.
 */
export class SearchPosProductsUseCase {
  constructor(private readonly itemRepo: IItemRepository) {}

  async execute(input: SearchPosProductsInput): Promise<PosProductSearchResult> {
    const q = (input.query || '').trim();
    if (!q) return { items: [] };
    const all = await this.itemRepo.searchItems(input.companyId, q, { limit: input.limit || 25, active: true });
    return {
      items: (all || []).map((it: Item) => ({
        id: it.id,
        code: it.code,
        barcode: it.barcode,
        name: it.name,
        type: (it.type === 'SERVICE' ? 'SERVICE' : 'PRODUCT') as 'PRODUCT' | 'SERVICE',
        trackInventory: !!it.trackInventory,
        baseUom: it.baseUom,
        salesUomId: it.salesUomId,
        defaultSalesTaxCodeId: it.defaultSalesTaxCodeId,
        salePrice: it.salePrice,
      })),
    };
  }
}
