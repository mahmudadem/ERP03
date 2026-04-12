import { randomUUID } from 'crypto';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';
import { PostingRole } from '../../../domain/designer/entities/PostingRole';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IVoucherFormRepository, VoucherFormDefinition } from '../../../repository/interfaces/designer/IVoucherFormRepository';

interface PurchaseVoucherSeedTemplate {
  name: string;
  code: string;
  module: string;
  prefix: string;
  sidebarGroup: string;
  headerFields: any[];
  tableColumns: any[];
  layout: Record<string, any>;
}

const PURCHASE_VOUCHER_SEED_TEMPLATES: Record<string, PurchaseVoucherSeedTemplate> = {
  purchase_order: {
    name: 'Purchase Order',
    code: 'purchase_order',
    module: 'PURCHASE',
    prefix: 'PO',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: false, postingRole: null },
      { id: 'notes', label: 'Internal Notes', type: 'TEXT', isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '250px' },
      { fieldId: 'quantity', width: '100px' },
      { fieldId: 'unitPrice', width: '120px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'supplierId', 'currency', 'exchangeRate'] },
        { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
      ],
    },
  },
  grn: {
    name: 'Goods Receipt Note',
    code: 'grn',
    module: 'PURCHASE',
    prefix: 'GRN',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'receiptDate', label: 'Receipt Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Warehouse', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'purchaseOrderId', label: 'PO Reference', type: 'SELECT', required: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '250px' },
      { fieldId: 'quantity', width: '100px' },
      { fieldId: 'uom', width: '80px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Receipt Info', fieldIds: ['receiptDate', 'supplierId', 'warehouseId', 'purchaseOrderId'] },
        { id: 'lines', title: 'Received Items', fieldIds: ['lineItems'] },
      ],
    },
  },
  purchase_invoice: {
    name: 'Purchase Invoice',
    code: 'purchase_invoice',
    module: 'PURCHASE',
    prefix: 'PI',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'description', label: 'Description', type: 'TEXT', isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '220px' },
      { fieldId: 'quantity', width: '100px' },
      { fieldId: 'unitPrice', width: '100px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Purchase Invoice Header', fieldIds: ['date', 'supplierId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  purchase_return: {
    name: 'Purchase Return',
    code: 'purchase_return',
    module: 'PURCHASE',
    prefix: 'PR',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'description', label: 'Description', type: 'TEXT', isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '220px' },
      { fieldId: 'quantity', width: '100px' },
      { fieldId: 'unitPrice', width: '100px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Purchase Return Header', fieldIds: ['date', 'supplierId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
        { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
};

const cloneTemplateValue = <T,>(value: T): T => {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const buildFallbackVoucherType = (
  companyId: string,
  templateCode: string
): VoucherTypeDefinition => {
  const template = PURCHASE_VOUCHER_SEED_TEMPLATES[templateCode];
  return new VoucherTypeDefinition(
    randomUUID(),
    companyId,
    template.name,
    template.code,
    template.module,
    cloneTemplateValue(template.headerFields),
    cloneTemplateValue(template.tableColumns),
    cloneTemplateValue(template.layout),
    2
  );
};

const buildFallbackVoucherForm = (
  companyId: string,
  typeId: string,
  createdBy: string,
  templateCode: string
): VoucherFormDefinition => {
  const template = PURCHASE_VOUCHER_SEED_TEMPLATES[templateCode];
  const now = new Date();

  return {
    id: randomUUID(),
    companyId,
    module: template.module,
    typeId,
    name: template.name,
    code: template.code,
    description: `${template.name} system default form`,
    prefix: template.prefix,
    isDefault: true,
    isSystemGenerated: true,
    isLocked: false,
    enabled: true,
    headerFields: cloneTemplateValue(template.headerFields) as any,
    tableColumns: cloneTemplateValue(template.tableColumns) as any,
    layout: cloneTemplateValue(template.layout),
    uiModeOverrides: null,
    rules: [],
    actions: [],
    isMultiLine: true,
    tableStyle: 'web',
    baseType: template.code,
    createdAt: now,
    updatedAt: now,
    createdBy,
  };
};

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
    template.schemaVersion,
    template.requiredPostingRoles ? [...template.requiredPostingRoles] : undefined,
    cloneTemplateValue(template.workflow),
    cloneTemplateValue(template.uiModeOverrides),
    template.isMultiLine,
    cloneTemplateValue(template.rules),
    cloneTemplateValue(template.actions),
    template.defaultCurrency
  );
};

const cloneVoucherFormForCompany = (
  companyId: string,
  typeId: string,
  createdBy: string,
  template: VoucherFormDefinition
): VoucherFormDefinition => {
  const now = new Date();

  return {
    id: randomUUID(),
    companyId,
    module: template.module,
    typeId,
    name: template.name,
    code: template.code,
    description: template.description || '',
    prefix: template.prefix,
    numberFormat: template.numberFormat,
    isDefault: true,
    isSystemGenerated: true,
    isLocked: false,
    enabled: template.enabled ?? true,
    headerFields: cloneTemplateValue(template.headerFields),
    tableColumns: cloneTemplateValue(template.tableColumns),
    layout: cloneTemplateValue(template.layout),
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
  const templates = Object.values(PURCHASE_VOUCHER_SEED_TEMPLATES);
  for (const template of templates) {
    const existingType = await voucherTypeRepo.getByCode(companyId, template.code);
    
    // If it exists but in the WRONG module, we need to re-home it
    if (existingType && existingType.module !== template.module && existingType.companyId === companyId) {
       console.log(`Re-homing ${template.code} from ${existingType.module} to ${template.module}`);
       await voucherTypeRepo.deleteVoucherType(companyId, existingType.id); // Delete the misplaced one
       // Proceed to create the new one below
    }

    const companyVoucherType = existingType && existingType.module === template.module && existingType.companyId === companyId
        ? existingType
        : cloneVoucherTypeForCompany(companyId, existingType || buildFallbackVoucherType(companyId, template.code));
    // Ensure the cloned one has the correct module
    (companyVoucherType as any).module = template.module;
    
    await voucherTypeRepo.createVoucherType(companyVoucherType);

    // FORM MIGRATION / RE-HOMING
    // Check if forms exist ANYWHERE for this type
    const allExistingForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
    
    for (const form of allExistingForms) {
      if (form.module !== template.module) {
        console.log(`Re-homing Form ${form.name} from ${form.module} to ${template.module}`);
        // Delete old
        await voucherFormRepo.delete(companyId, form.id);
        // Create new with correct module
        await voucherFormRepo.create({ ...form, module: template.module });
      }
    }

    const companyForms = await voucherFormRepo.getByTypeId(companyId, companyVoucherType.id);
    if (companyForms.length > 0) continue;

    const fallbackForm = await voucherFormRepo.getDefaultForType(companyId, template.code);
    const companyForm = fallbackForm
      ? cloneVoucherFormForCompany(companyId, companyVoucherType.id, createdBy, fallbackForm)
      : buildFallbackVoucherForm(companyId, companyVoucherType.id, createdBy, template.code);

    await voucherFormRepo.create(companyForm);
  }
};

export interface InitializePurchasesInput {
  companyId: string;
  userId: string;
  defaultAPAccountId?: string;
  allowDirectInvoicing?: boolean;
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
  allowDirectInvoicing?: boolean;
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
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(input: InitializePurchasesInput): Promise<PurchaseSettings> {
    if (input.defaultAPAccountId) {
      const apAccount = await this.accountRepo.getById(input.companyId, input.defaultAPAccountId);
      if (!apAccount) {
        throw new Error(`Default AP account not found: ${input.defaultAPAccountId}`);
      }
    }

    await ensurePurchaseVoucherDefinitions(
      input.companyId,
      input.userId || 'SYSTEM',
      this.voucherTypeRepo,
      this.voucherFormRepo
    );

    const settings = new PurchaseSettings({
      companyId: input.companyId,
      allowDirectInvoicing: input.allowDirectInvoicing ?? true,
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
    private readonly voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(input: UpdatePurchasesSettingsInput): Promise<PurchaseSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Purchase settings are not initialized');
    }

    const nextAllowDirectInvoicing = input.allowDirectInvoicing ?? existing.allowDirectInvoicing;
    const nextAPAccountId = input.defaultAPAccountId ?? existing.defaultAPAccountId;
    if (nextAPAccountId) {
      const apAccount = await this.accountRepo.getById(input.companyId, nextAPAccountId);
      if (!apAccount) {
        throw new Error(`Default AP account not found: ${nextAPAccountId}`);
      }
    }

    await ensurePurchaseVoucherDefinitions(input.companyId, 'SYSTEM', this.voucherTypeRepo, this.voucherFormRepo);

    const updated = new PurchaseSettings({
      companyId: existing.companyId,
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requirePOForStockItems: input.requirePOForStockItems ?? existing.requirePOForStockItems,
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
