import { randomUUID } from 'crypto';
import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';
import { PostingRole } from '../../../domain/designer/entities/PostingRole';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import {
  IVoucherFormRepository,
  VoucherFormDefinition,
} from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';

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
    module: template.module || 'SALES',
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
    baseType: template.baseType || template.code,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
};

const ensureSalesVoucherDefinitions = async (
  companyId: string,
  createdBy: string,
  voucherTypeRepo: IVoucherTypeDefinitionRepository,
  voucherFormRepo: IVoucherFormRepository
): Promise<void> => {
  // Fetch ALL system templates from the unified source of truth
  const systemTemplates = await voucherTypeRepo.getSystemTemplates();
  const salesTemplates = systemTemplates.filter(t => t.module === 'SALES');

  if (salesTemplates.length === 0) {
    console.warn('[SalesSettingsUseCases] No SALES system templates found. Check seeder!');
  }

  for (const template of salesTemplates) {
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
        console.log(`Re-homing Sales Form ${form.name} from ${form.module} to ${template.module}`);
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

export interface InitializeSalesInput {
  companyId: string;
  userId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
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
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
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
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: InitializeSalesInput): Promise<SalesSettings> {
    const [revenueAccount, inventoryAccount, arAccount] = await Promise.all([
      this.accountRepo.getById(input.companyId, input.defaultRevenueAccountId),
      input.defaultInventoryAccountId
        ? this.accountRepo.getById(input.companyId, input.defaultInventoryAccountId)
        : Promise.resolve(null),
      input.defaultARAccountId
        ? this.accountRepo.getById(input.companyId, input.defaultARAccountId)
        : Promise.resolve(null),
    ]);

    if (!revenueAccount) {
      throw new Error(`Default revenue account not found: ${input.defaultRevenueAccountId}`);
    }
    if (input.defaultInventoryAccountId && !inventoryAccount) {
      throw new Error(`Default inventory account not found: ${input.defaultInventoryAccountId}`);
    }
    if (input.defaultARAccountId && !arAccount) {
      throw new Error(`Default AR account not found: ${input.defaultARAccountId}`);
    }

    await ensureSalesVoucherDefinitions(
      input.companyId,
      input.userId || 'SYSTEM',
      this.voucherTypeRepo,
      this.voucherFormRepo
    );

    const workflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode);
    if (this.inventorySettingsRepo) {
      const inventorySettings = await this.inventorySettingsRepo.getSettings(input.companyId);
      const accountingMode = DocumentPolicyResolver.resolveAccountingMode(inventorySettings);
      DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
    }
    const workflowDefaults = DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? true,
      requireSOForStockItems: input.requireSOForStockItems ?? false,
    });

    const settings = new SalesSettings({
      companyId: input.companyId,
      workflowMode,
      allowDirectInvoicing: workflowDefaults.allowDirectInvoicing,
      requireSOForStockItems: workflowDefaults.requireSOForStockItems,
      defaultARAccountId: input.defaultARAccountId,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId,
      defaultInventoryAccountId: input.defaultInventoryAccountId,
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
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(companyId: string): Promise<SalesSettings | null> {
    const settings = await this.settingsRepo.getSettings(companyId);
    if (!settings) {
      return null;
    }

    await ensureSalesVoucherDefinitions(companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);
    return settings;
  }
}

export class UpdateSalesSettingsUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository
  ) {}

  async execute(input: UpdateSalesSettingsInput): Promise<SalesSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Sales settings are not initialized');
    }

    const workflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode ?? existing.workflowMode);
    if (this.inventorySettingsRepo) {
      const inventorySettings = await this.inventorySettingsRepo.getSettings(input.companyId);
      const accountingMode = DocumentPolicyResolver.resolveAccountingMode(inventorySettings);
      DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(workflowMode, accountingMode);
    }
    const workflowDefaults = DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? existing.allowDirectInvoicing,
      requireSOForStockItems: input.requireSOForStockItems ?? existing.requireSOForStockItems,
    });
    const nextAllowDirectInvoicing = workflowDefaults.allowDirectInvoicing;
    const nextARAccountId = input.defaultARAccountId ?? existing.defaultARAccountId;
    const nextRevenueAccountId = input.defaultRevenueAccountId ?? existing.defaultRevenueAccountId;
    const nextDefaultInventoryAccountId = input.defaultInventoryAccountId ?? existing.defaultInventoryAccountId;

    if (!nextRevenueAccountId) throw new Error('defaultRevenueAccountId is required');

    const [revenueAccount, inventoryAccount, arAccount] = await Promise.all([
      this.accountRepo.getById(input.companyId, nextRevenueAccountId),
      nextDefaultInventoryAccountId
        ? this.accountRepo.getById(input.companyId, nextDefaultInventoryAccountId)
        : Promise.resolve(null),
      nextARAccountId
        ? this.accountRepo.getById(input.companyId, nextARAccountId)
        : Promise.resolve(null),
    ]);
    if (!revenueAccount) throw new Error(`Default revenue account not found: ${nextRevenueAccountId}`);
    if (nextDefaultInventoryAccountId && !inventoryAccount) {
      throw new Error(`Default inventory account not found: ${nextDefaultInventoryAccountId}`);
    }
    if (nextARAccountId && !arAccount) {
      throw new Error(`Default AR account not found: ${nextARAccountId}`);
    }

    await ensureSalesVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);

    const updated = new SalesSettings({
      companyId: existing.companyId,
      workflowMode,
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requireSOForStockItems: workflowDefaults.requireSOForStockItems,
      defaultARAccountId: nextARAccountId,
      defaultRevenueAccountId: nextRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId ?? existing.defaultCOGSAccountId,
      defaultInventoryAccountId: nextDefaultInventoryAccountId,
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
