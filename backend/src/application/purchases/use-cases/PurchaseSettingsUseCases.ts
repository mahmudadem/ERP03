import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PurchaseSettings, GovernanceRule } from '../../../domain/purchases/entities/PurchaseSettings';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IVoucherFormRepository } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IGoodsReceiptRepository } from '../../../repository/interfaces/purchases/IGoodsReceiptRepository';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { EnsureAccountingEngineInitialized } from '../../accounting/use-cases/EnsureAccountingEngineInitialized';
import { validatePartyAccountCodeFormat } from '../../shared/services/PartyAccountCodeRenderer';
import { syncCompanyVoucherTemplatesFromSystem } from '../../system/services/CompanyVoucherTemplateSyncService';

// Voucher type/form copy is delegated to syncCompanyVoucherTemplatesFromSystem,
// which honors the user's selectedVoucherTypes pick from the init wizard.

const normalizeModule = (value: any) => String(value || '').trim().toUpperCase();

const ensureVoucherTypeScope = async (
  voucherTypeRepo: IVoucherTypeDefinitionRepository,
  companyId: string,
  voucherTypeId: string | undefined,
  expectedModule: string,
  fieldName: string
): Promise<void> => {
  if (!voucherTypeId) return;

  const voucherType = await voucherTypeRepo.getVoucherType(companyId, voucherTypeId);
  if (!voucherType) {
    throw new Error(`${fieldName} not found: ${voucherTypeId}`);
  }

  if (normalizeModule(voucherType.module) !== expectedModule) {
    throw new Error(`${fieldName} must belong to ${expectedModule} module`);
  }
};

export interface InitializePurchasesInput {
  companyId: string;
  userId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  defaultAPAccountId?: string;
  apParentAccountId?: string;
  partyAccountCodeFormat?: string;
  allowDirectInvoicing?: boolean;
  requirePOForStockItems?: boolean;
  defaultPurchaseExpenseAccountId?: string;
  defaultGRNIAccountId?: string;
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
  /**
   * IDs of system Purchase voucher templates the user picked in the wizard.
   * `undefined` keeps legacy behavior (copy every PURCHASE template).
   * `[]` copies nothing (user picked none).
   */
  selectedVoucherTypes?: string[];
}

export interface UpdatePurchasesSettingsInput {
  companyId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  allowDirectInvoicing?: boolean;
  requirePOForStockItems?: boolean;
  defaultAPAccountId?: string;
  apParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultPurchaseExpenseAccountId?: string;
  defaultGRNIAccountId?: string;
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
  governanceRules?: GovernanceRule[];
  defaultPurchaseInvoicePersona?: 'direct' | 'linked' | 'service';
}

export class InitializePurchasesUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly ensureAccountingEngine: EnsureAccountingEngineInitialized,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: InitializePurchasesInput): Promise<PurchaseSettings> {
    await this.ensureAccountingEngine.execute(input.companyId);

    if (input.defaultAPAccountId) {
      const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
      if (!apAccount) {
        throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
      }
    }

    if (input.apParentAccountId) {
      const parent = await this.accountRepo.getById(input.companyId, input.apParentAccountId);
      if (!parent) {
        throw new Error(`AP parent account not found: ${input.apParentAccountId}`);
      }
      if (parent.classification !== 'LIABILITY') {
        throw new Error(`AP parent account must be classified as LIABILITY (got ${parent.classification})`);
      }
    }
    const partyAccountCodeFormatError = validatePartyAccountCodeFormat(input.partyAccountCodeFormat);
    if (partyAccountCodeFormatError) {
      throw new Error(partyAccountCodeFormatError);
    }

    if (input.defaultGRNIAccountId) {
      const grniAccount = await this.accountRepo.getById(input.companyId, input.defaultGRNIAccountId);
      if (!grniAccount) {
        throw new Error(`Default GRNI account not found: ${input.defaultGRNIAccountId}`);
      }
    }

    await syncCompanyVoucherTemplatesFromSystem({
      companyId: input.companyId,
      modules: ['PURCHASE'],
      selectedTemplateIds: input.selectedVoucherTypes,
      createdBy: input.userId || 'SYSTEM',
      voucherTypeRepo: this.voucherTypeRepo,
      voucherFormRepo: this.voucherFormRepo,
    });
    await ensureVoucherTypeScope(
      this.voucherTypeRepo,
      input.companyId,
      input.purchaseVoucherTypeId,
      'PURCHASE',
      'purchaseVoucherTypeId'
    );

    const workflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode);
    const accountingMode = this.inventorySettingsRepo
      ? DocumentPolicyResolver.resolveAccountingMode(await this.inventorySettingsRepo.getSettings(input.companyId))
      : 'INVOICE_DRIVEN';
    DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
    const workflowDefaults = DocumentPolicyResolver.applyPurchaseWorkflowDefaults(workflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? true,
      requirePOForStockItems: input.requirePOForStockItems ?? false,
    });
    if (accountingMode === 'PERPETUAL' && !input.defaultGRNIAccountId) {
      throw new Error('Default GRNI account is required for perpetual purchasing workflows.');
    }

    const settings = new PurchaseSettings({
      companyId: input.companyId,
      workflowMode,
      allowDirectInvoicing: workflowDefaults.allowDirectInvoicing,
      requirePOForStockItems: workflowDefaults.requirePOForStockItems,
      defaultAPAccountId: input.defaultAPAccountId,
      apParentAccountId: input.apParentAccountId,
      partyAccountCodeFormat: input.partyAccountCodeFormat,
      defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId,
      defaultGRNIAccountId: input.defaultGRNIAccountId,
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
        isEnabled: true,
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
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(companyId: string): Promise<PurchaseSettings | null> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) {
      return null;
    }

    // Voucher templates are no longer lazily ensured here. They are owned by the
    // module init wizard (selectedVoucherTypes) so that an empty selection sticks
    // and unselected templates do not silently reappear on every settings read.
    return settings;
  }
}

export class UpdatePurchaseSettingsUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly purchaseOrderRepo: IPurchaseOrderRepository,
    private readonly goodsReceiptRepo: IGoodsReceiptRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: UpdatePurchasesSettingsInput): Promise<PurchaseSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Purchase settings are not initialized');
    }

    const oldWorkflowMode = existing.workflowMode || 'OPERATIONAL';
    const newWorkflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode ?? existing.workflowMode);

    if (input.workflowMode === 'SIMPLE' && oldWorkflowMode !== 'SIMPLE') {
      const hasOpenPO = await this.purchaseOrderRepo.hasOpenOrders(input.companyId);
      if (hasOpenPO) {
        throw new BusinessError(
          ErrorCode.PURCHASES_TRANSITION_BLOCKED,
          'Cannot switch to Simple workflow while there are open Purchase Orders. Please close or cancel all open orders first.'
        );
      }

      const hasUnpostedGRN = await this.goodsReceiptRepo.hasUnpostedGoodsReceipts(input.companyId);
      if (hasUnpostedGRN) {
        throw new BusinessError(
          ErrorCode.PURCHASES_TRANSITION_BLOCKED,
          'Cannot switch to Simple workflow while there are draft goods receipts. Please process or delete them first.'
        );
      }
    }

    await ensureVoucherTypeScope(
      this.voucherTypeRepo,
      input.companyId,
      input.purchaseVoucherTypeId,
      'PURCHASE',
      'purchaseVoucherTypeId'
    );

    const workflowMode = newWorkflowMode;
    const accountingMode = this.inventorySettingsRepo
      ? DocumentPolicyResolver.resolveAccountingMode(await this.inventorySettingsRepo.getSettings(input.companyId))
      : 'INVOICE_DRIVEN';
    DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
    const workflowDefaults = DocumentPolicyResolver.applyPurchaseWorkflowDefaults(workflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? existing.allowDirectInvoicing,
      requirePOForStockItems: input.requirePOForStockItems ?? existing.requirePOForStockItems,
    });
    const nextAllowDirectInvoicing = workflowDefaults.allowDirectInvoicing;
    const nextAPAccountId = input.defaultAPAccountId ?? existing.defaultAPAccountId;
    const nextAPParentAccountId = input.apParentAccountId ?? existing.apParentAccountId;
    const nextPartyAccountCodeFormat = input.partyAccountCodeFormat ?? existing.partyAccountCodeFormat;
    const nextGRNIAccountId = input.defaultGRNIAccountId ?? existing.defaultGRNIAccountId;
    if (accountingMode === 'PERPETUAL' && !nextGRNIAccountId) {
      throw new Error('Default GRNI account is required for perpetual purchasing workflows.');
    }
    if (nextAPAccountId) {
      const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
      if (!apAccount) {
        throw new Error(`Default AP account not found: ${nextAPAccountId}`);
      }
    }
    if (nextGRNIAccountId) {
      const grniAccount = await this.accountRepo.getById(input.companyId, nextGRNIAccountId);
      if (!grniAccount) {
        throw new Error(`Default GRNI account not found: ${nextGRNIAccountId}`);
      }
    }
    if (nextAPParentAccountId) {
      const parent = await this.accountRepo.getById(input.companyId, nextAPParentAccountId);
      if (!parent) {
        throw new Error(`AP parent account not found: ${nextAPParentAccountId}`);
      }
      if (parent.classification !== 'LIABILITY') {
        throw new Error(`AP parent account must be classified as LIABILITY (got ${parent.classification})`);
      }
    }
    const partyAccountCodeFormatErrorUpdate = validatePartyAccountCodeFormat(nextPartyAccountCodeFormat);
    if (partyAccountCodeFormatErrorUpdate) {
      throw new Error(partyAccountCodeFormatErrorUpdate);
    }

    // No lazy voucher-template ensure here. See note in GetPurchaseSettingsUseCase.

    const updated = new PurchaseSettings({
      companyId: existing.companyId,
      workflowMode,
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requirePOForStockItems: workflowDefaults.requirePOForStockItems,
      defaultAPAccountId: nextAPAccountId,
      apParentAccountId: nextAPParentAccountId,
      partyAccountCodeFormat: nextPartyAccountCodeFormat,
      defaultPurchaseExpenseAccountId: input.defaultPurchaseExpenseAccountId ?? existing.defaultPurchaseExpenseAccountId,
      defaultGRNIAccountId: nextGRNIAccountId,
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
      governanceRules: input.governanceRules ?? existing.governanceRules,
      defaultPurchaseInvoicePersona: input.defaultPurchaseInvoicePersona ?? existing.defaultPurchaseInvoicePersona,
    });

    await this.settingsRepo.saveSettings(updated);
    return updated;
  }
}
