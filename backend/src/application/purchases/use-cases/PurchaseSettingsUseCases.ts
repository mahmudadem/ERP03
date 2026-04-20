import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { PostingRole } from '../../../domain/designer/entities/PostingRole';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IVoucherFormRepository, VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';

// Note: Hardcoded templates are now deprecated and will be removed in a future PR
// Source of truth is now system_metadata/voucher_types/items seeded by seedSystemVoucherTypes.ts

const cloneTemplateValue = (val: any) => (val ? JSON.parse(JSON.stringify(val)) : null);

const cloneVoucherTypeForCompany = (
  companyId: string,
  template: VoucherTypeDefinition
): VoucherTypeDefinition => {
  return new VoucherTypeDefinition(
    randomUUID(),
    companyId,
    template.name,
    template.code,
    template.module,
    cloneTemplateValue(template.headerFields),
    cloneTemplateValue(template.tableColumns),
    cloneTemplateValue(template.layout),
    template.schemaVersion || 2,
    template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined,
    cloneTemplateValue(template.workflow),
    cloneTemplateValue(template.uiModeOverrides),
    template.isMultiLine ?? true,
    cloneTemplateValue(template.rules) || [],
    cloneTemplateValue(template.actions) || [],
    template.defaultCurrency
  );
};

const cloneVoucherFormForCompany = (
  companyId: string,
  typeId: string,
  createdBy: string,
  template: VoucherFormDefinition | any // Can be from system metadata too
): VoucherFormDefinition => {
  const now = new Date();

  return {
    id: randomUUID(),
    companyId,
    module: template.module || 'PURCHASE',
    typeId,
    name: template.name,
    code: template.code,
    description: template.description || `Default form for ${template.name}`,
    prefix: template.prefix,
    numberFormat: template.numberFormat,
    isDefault: true,
    isSystemGenerated: true,
    isLocked: true,
    enabled: template.enabled ?? true,
    headerFields: cloneTemplateValue(template.headerFields) || [],
    tableColumns: cloneTemplateValue(template.tableColumns) || [],
    layout: cloneTemplateValue(template.layout) || { sections: [] },
    uiModeOverrides: cloneTemplateValue(template.uiModeOverrides),
    rules: cloneTemplateValue(template.rules) || [],
    actions: cloneTemplateValue(template.actions) || [],
    isMultiLine: template.isMultiLine ?? true,
    tableStyle: template.tableStyle || 'web',
    defaultCurrency: template.defaultCurrency,
    baseType: template.baseType || template.code,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
};

const ensurePurchaseVoucherDefinitions = async (
  companyId: string,
  createdBy: string,
  voucherTypeRepo: IVoucherTypeDefinitionRepository,
  voucherFormRepo: IVoucherFormRepository
): Promise<void> => {
  // Fetch ALL system templates from the unified source of truth
  const systemTemplates = await voucherTypeRepo.getSystemTemplates();
  const purchaseTemplates = systemTemplates.filter(t => t.module === 'PURCHASE');

  if (purchaseTemplates.length === 0) {
    console.warn('[PurchaseSettingsUseCases] No PURCHASE system templates found. Check seeder!');
  }

  for (const template of purchaseTemplates) {
    const existingType = await voucherTypeRepo.getByCode(companyId, template.code);
    
    // If it exists but in the WRONG module, we need to re-home it
    if (existingType && existingType.module !== template.module && existingType.companyId === companyId) {
       console.log(`Re-homing ${template.code} from ${existingType.module} to ${template.module}`);
       await voucherTypeRepo.deleteVoucherType(companyId, existingType.id);
       // We'll create it below
    }

    const companyVoucherType = existingType && existingType.module === template.module && existingType.companyId === companyId
        ? existingType
        : cloneVoucherTypeForCompany(companyId, template);
    
    // Set metadata correctly
    companyVoucherType.module = template.module;
    await voucherTypeRepo.createVoucherType(companyVoucherType);

    // FORM MIGRATION / RE-HOMING
    const allExistingForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
    for (const form of allExistingForms) {
      if (form.module !== template.module) {
        console.log(`Re-homing Purchase Form ${form.name} from ${form.module} to ${template.module}`);
        await voucherFormRepo.delete(companyId, form.id);
        await voucherFormRepo.create({ ...form, module: template.module });
      }
    }

    const companyForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
    if (companyForms.length > 0) continue;

    // Create default form from template
    const companyForm = cloneVoucherFormForCompany(companyId, companyVoucherType.id, createdBy, template);
    await voucherFormRepo.create(companyForm);
  }
};

export interface InitializePurchasesInput {
  companyId: string;
  userId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  defaultAPAccountId?: string;
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
}

export interface UpdatePurchasesSettingsInput {
  companyId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  allowDirectInvoicing?: boolean;
  requirePOForStockItems?: boolean;
  defaultAPAccountId?: string;
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
}

export class InitializePurchasesUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: InitializePurchasesInput): Promise<PurchaseSettings> {
    if (input.defaultAPAccountId) {
      const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
      if (!apAccount) {
        throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
      }
    }

    if (input.defaultGRNIAccountId) {
      const grniAccount = await this.accountRepo.getById(input.companyId, input.defaultGRNIAccountId);
      if (!grniAccount) {
        throw new Error(`Default GRNI account not found: ${input.defaultGRNIAccountId}`);
      }
    }

    await ensurePurchaseVoucherDefinitions(
      input.companyId,
      input.userId || 'SYSTEM',
      this.voucherTypeRepo,
      this.voucherFormRepo
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

    await ensurePurchaseVoucherDefinitions(companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
    return settings;
  }
}

export class UpdatePurchaseSettingsUseCase {
  constructor(
    private readonly settingsRepo: IPurchaseSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: UpdatePurchasesSettingsInput): Promise<PurchaseSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Purchase settings are not initialized');
    }

    const workflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode ?? existing.workflowMode);
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

    await ensurePurchaseVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);

    const updated = new PurchaseSettings({
      companyId: existing.companyId,
      workflowMode,
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requirePOForStockItems: workflowDefaults.requirePOForStockItems,
      defaultAPAccountId: nextAPAccountId,
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
    });

    await this.settingsRepo.saveSettings(updated);
    return updated;
  }
}
