import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';

export interface InitializeSalesInput {
  companyId: string;
  userId: string;
  defaultARAccountId: string;
  defaultRevenueAccountId: string;
  salesControlMode: 'SIMPLE' | 'CONTROLLED';
  requireSOForStockItems?: boolean;
  defaultCOGSAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix?: string;
  soNumberNextSeq?: number;
  dnNumberPrefix?: string;
  dnNumberNextSeq?: number;
  siNumberPrefix?: string;
  siNumberNextSeq?: number;
  srNumberPrefix?: string;
  srNumberNextSeq?: number;
}

export interface UpdateSalesSettingsInput {
  companyId: string;
  salesControlMode?: 'SIMPLE' | 'CONTROLLED';
  requireSOForStockItems?: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix?: string;
  soNumberNextSeq?: number;
  dnNumberPrefix?: string;
  dnNumberNextSeq?: number;
  siNumberPrefix?: string;
  siNumberNextSeq?: number;
  srNumberPrefix?: string;
  srNumberNextSeq?: number;
}

export class InitializeSalesUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository
  ) {}

  async execute(input: InitializeSalesInput): Promise<SalesSettings> {
    const [arAccount, revenueAccount] = await Promise.all([
      this.accountRepo.getById(input.companyId, input.defaultARAccountId),
      this.accountRepo.getById(input.companyId, input.defaultRevenueAccountId),
    ]);

    if (!arAccount) {
      throw new Error(`Default AR account not found: ${input.defaultARAccountId}`);
    }
    if (!revenueAccount) {
      throw new Error(`Default revenue account not found: ${input.defaultRevenueAccountId}`);
    }

    const settings = new SalesSettings({
      companyId: input.companyId,
      salesControlMode: input.salesControlMode,
      requireSOForStockItems: input.requireSOForStockItems ?? false,
      defaultARAccountId: input.defaultARAccountId,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId,
      defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId,
      allowOverDelivery: input.allowOverDelivery ?? false,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? 30,
      salesVoucherTypeId: input.salesVoucherTypeId,
      defaultWarehouseId: input.defaultWarehouseId,
      soNumberPrefix: input.soNumberPrefix || 'SO',
      soNumberNextSeq: input.soNumberNextSeq ?? 1,
      dnNumberPrefix: input.dnNumberPrefix || 'DN',
      dnNumberNextSeq: input.dnNumberNextSeq ?? 1,
      siNumberPrefix: input.siNumberPrefix || 'SI',
      siNumberNextSeq: input.siNumberNextSeq ?? 1,
      srNumberPrefix: input.srNumberPrefix || 'SR',
      srNumberNextSeq: input.srNumberNextSeq ?? 1,
    });

    await this.settingsRepo.saveSettings(settings);

    const now = new Date();
    const salesModule = await this.companyModuleRepo.get(input.companyId, 'sales');
    if (salesModule) {
      await this.companyModuleRepo.update(input.companyId, 'sales', {
        initialized: true,
        initializationStatus: 'complete',
        updatedAt: now,
      });
    } else {
      await this.companyModuleRepo.create({
        companyId: input.companyId,
        moduleCode: 'sales',
        installedAt: now,
        initialized: true,
        initializationStatus: 'complete',
        config: {},
        updatedAt: now,
      });
    }

    return settings;
  }
}

export class GetSalesSettingsUseCase {
  constructor(private readonly settingsRepo: ISalesSettingsRepository) {}

  async execute(companyId: string): Promise<SalesSettings | null> {
    return this.settingsRepo.getSettings(companyId);
  }
}

export class UpdateSalesSettingsUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: UpdateSalesSettingsInput): Promise<SalesSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Sales settings are not initialized');
    }

    const nextMode = input.salesControlMode ?? existing.salesControlMode;
    const nextARAccountId = input.defaultARAccountId ?? existing.defaultARAccountId;
    const nextRevenueAccountId = input.defaultRevenueAccountId ?? existing.defaultRevenueAccountId;

    if (!nextARAccountId) throw new Error('defaultARAccountId is required');
    if (!nextRevenueAccountId) throw new Error('defaultRevenueAccountId is required');

    const [arAccount, revenueAccount] = await Promise.all([
      this.accountRepo.getById(input.companyId, nextARAccountId),
      this.accountRepo.getById(input.companyId, nextRevenueAccountId),
    ]);
    if (!arAccount) throw new Error(`Default AR account not found: ${nextARAccountId}`);
    if (!revenueAccount) throw new Error(`Default revenue account not found: ${nextRevenueAccountId}`);

    const updated = new SalesSettings({
      companyId: existing.companyId,
      salesControlMode: nextMode,
      requireSOForStockItems: nextMode === 'CONTROLLED'
        ? true
        : (input.requireSOForStockItems ?? existing.requireSOForStockItems),
      defaultARAccountId: nextARAccountId,
      defaultRevenueAccountId: nextRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId ?? existing.defaultCOGSAccountId,
      defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId ?? existing.defaultSalesExpenseAccountId,
      allowOverDelivery: input.allowOverDelivery ?? existing.allowOverDelivery,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? existing.overDeliveryTolerancePct,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? existing.overInvoiceTolerancePct,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? existing.defaultPaymentTermsDays,
      salesVoucherTypeId: input.salesVoucherTypeId ?? existing.salesVoucherTypeId,
      defaultWarehouseId: input.defaultWarehouseId ?? existing.defaultWarehouseId,
      soNumberPrefix: input.soNumberPrefix ?? existing.soNumberPrefix,
      soNumberNextSeq: input.soNumberNextSeq ?? existing.soNumberNextSeq,
      dnNumberPrefix: input.dnNumberPrefix ?? existing.dnNumberPrefix,
      dnNumberNextSeq: input.dnNumberNextSeq ?? existing.dnNumberNextSeq,
      siNumberPrefix: input.siNumberPrefix ?? existing.siNumberPrefix,
      siNumberNextSeq: input.siNumberNextSeq ?? existing.siNumberNextSeq,
      srNumberPrefix: input.srNumberPrefix ?? existing.srNumberPrefix,
      srNumberNextSeq: input.srNumberNextSeq ?? existing.srNumberNextSeq,
    });

    await this.settingsRepo.saveSettings(updated);
    return updated;
  }
}
