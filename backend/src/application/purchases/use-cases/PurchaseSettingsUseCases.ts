import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';

export interface InitializePurchasesInput {
  companyId: string;
  userId: string;
  defaultAPAccountId: string;
  procurementControlMode: 'SIMPLE' | 'CONTROLLED';
  requirePOForStockItems?: boolean;
  defaultPurchaseExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix?: string;
  poNumberNextSeq?: number;
  grnNumberPrefix?: string;
  grnNumberNextSeq?: number;
  piNumberPrefix?: string;
  piNumberNextSeq?: number;
  prNumberPrefix?: string;
  prNumberNextSeq?: number;
}

export interface UpdatePurchasesSettingsInput {
  companyId: string;
  procurementControlMode?: 'SIMPLE' | 'CONTROLLED';
  requirePOForStockItems?: boolean;
  defaultAPAccountId?: string;
  defaultPurchaseExpenseAccountId?: string;
  allowOverDelivery?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix?: string;
  poNumberNextSeq?: number;
  grnNumberPrefix?: string;
  grnNumberNextSeq?: number;
  piNumberPrefix?: string;
  piNumberNextSeq?: number;
  prNumberPrefix?: string;
  prNumberNextSeq?: number;
}

export class InitializePurchasesUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository
  ) {}

  async execute(input: InitializePurchasesInput): Promise<PurchaseSettings> {
    const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
    if (!apAccount) {
      throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
    }

    const settings = new PurchaseSettings({
      companyId: input.companyId,
      procurementControlMode: input.procurementControlMode,
      requirePOForStockItems: input.requirePOForStockItems ?? false,
      defaultAPAccountId: input.defaultAPAccountId,
      defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId,
      allowOverDelivery: input.allowOverDelivery ?? false,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? 30,
      purchaseVoucherTypeId: input.purchaseVoucherTypeId,
      defaultWarehouseId: input.defaultWarehouseId,
      poNumberPrefix: input.poNumberPrefix || 'PO',
      poNumberNextSeq: input.poNumberNextSeq ?? 1,
      grnNumberPrefix: input.grnNumberPrefix || 'GRN',
      grnNumberNextSeq: input.grnNumberNextSeq ?? 1,
      piNumberPrefix: input.piNumberPrefix || 'PI',
      piNumberNextSeq: input.piNumberNextSeq ?? 1,
      prNumberPrefix: input.prNumberPrefix || 'PR',
      prNumberNextSeq: input.prNumberNextSeq ?? 1,
    });

    await this.settingsRepo.saveSettings(settings);

    const now = new Date();
    const purchaseModule = await this.companyModuleRepo.get(input.companyId, 'purchase');
    if (purchaseModule) {
      await this.companyModuleRepo.update(input.companyId, 'purchase', {
        initialized: true,
        initializationStatus: 'complete',
        updatedAt: now,
      });
    } else {
      await this.companyModuleRepo.create({
        companyId: input.companyId,
        moduleCode: 'purchase',
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

export class GetPurchaseSettingsUseCase {
  constructor(private readonly settingsRepo: IPurchaseSettingsRepository) {}

  async execute(companyId: string): Promise<PurchaseSettings | null> {
    return this.settingsRepo.getSettings(companyId);
  }
}

export class UpdatePurchaseSettingsUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository
  ) {}

  async execute(input: UpdatePurchasesSettingsInput): Promise<PurchaseSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Purchase settings are not initialized');
    }

    const nextMode = input.procurementControlMode ?? existing.procurementControlMode;
    const nextAPAccountId = input.defaultAPAccountId ?? existing.defaultAPAccountId;
    if (!nextAPAccountId) {
      throw new Error('defaultAPAccountId is required');
    }

    const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
    if (!apAccount) {
      throw new Error(`Default AP account not found: ${nextAPAccountId}`);
    }

    const updated = new PurchaseSettings({
      companyId: existing.companyId,
      procurementControlMode: nextMode,
      requirePOForStockItems: nextMode === 'CONTROLLED'
        ? true
        : (input.requirePOForStockItems ?? existing.requirePOForStockItems),
      defaultAPAccountId: nextAPAccountId,
      defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId ?? existing.defaultPurchaseExpenseAccountId,
      allowOverDelivery: input.allowOverDelivery ?? existing.allowOverDelivery,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? existing.overDeliveryTolerancePct,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? existing.overInvoiceTolerancePct,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? existing.defaultPaymentTermsDays,
      purchaseVoucherTypeId: input.purchaseVoucherTypeId ?? existing.purchaseVoucherTypeId,
      defaultWarehouseId: input.defaultWarehouseId ?? existing.defaultWarehouseId,
      poNumberPrefix: input.poNumberPrefix ?? existing.poNumberPrefix,
      poNumberNextSeq: input.poNumberNextSeq ?? existing.poNumberNextSeq,
      grnNumberPrefix: input.grnNumberPrefix ?? existing.grnNumberPrefix,
      grnNumberNextSeq: input.grnNumberNextSeq ?? existing.grnNumberNextSeq,
      piNumberPrefix: input.piNumberPrefix ?? existing.piNumberPrefix,
      piNumberNextSeq: input.piNumberNextSeq ?? existing.piNumberNextSeq,
      prNumberPrefix: input.prNumberPrefix ?? existing.prNumberPrefix,
      prNumberNextSeq: input.prNumberNextSeq ?? existing.prNumberNextSeq,
    });

    await this.settingsRepo.saveSettings(updated);
    return updated;
  }
}
