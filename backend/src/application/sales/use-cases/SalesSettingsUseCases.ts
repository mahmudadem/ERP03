import { randomUUID } from 'crypto';
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
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';

interface SalesVoucherSeedTemplate {
  name: string;
  code: string;
  module: string;
  prefix: string;
  sidebarGroup: string;
  headerFields: any[];
  tableColumns: any[];
  layout: Record<string, any>;
}

const SALES_VOUCHER_SEED_TEMPLATES: Record<string, SalesVoucherSeedTemplate> = {
  sales_order: {
    name: 'Sales Order',
    code: 'sales_order',
    module: 'SALES',
    prefix: 'SO',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'customerId', 'currency', 'exchangeRate'] },
        { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
      ],
    },
  },
  delivery_note: {
    name: 'Delivery Note',
    code: 'delivery_note',
    module: 'SALES',
    prefix: 'DN',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'deliveryDate', label: 'Delivery Date', type: 'DATE', required: true, isPosting: false, postingRole: null },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Warehouse', type: 'SELECT', required: true, isPosting: false, postingRole: null },
      { id: 'salesOrderId', label: 'SO Reference', type: 'SELECT', required: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '250px' },
      { fieldId: 'quantity', width: '100px' },
      { fieldId: 'uom', width: '80px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Delivery Info', fieldIds: ['deliveryDate', 'customerId', 'warehouseId', 'salesOrderId'] },
        { id: 'lines', title: 'Delivered Items', fieldIds: ['lineItems'] },
      ],
    },
  },
  sales_invoice: {
    name: 'Sales Invoice',
    code: 'sales_invoice',
    module: 'SALES',
    prefix: 'SI',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
        { id: 'header', title: 'Sales Invoice Header', fieldIds: ['date', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  sales_return: {
    name: 'Sales Return',
    code: 'sales_return',
    module: 'SALES',
    prefix: 'SR',
    sidebarGroup: 'Documents',
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, isPosting: false, postingRole: null },
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
        { id: 'header', title: 'Sales Return Header', fieldIds: ['date', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
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
  const template = SALES_VOUCHER_SEED_TEMPLATES[templateCode];
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
  const template = SALES_VOUCHER_SEED_TEMPLATES[templateCode];
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

const ensureSalesVoucherDefinitions = async (
  companyId: string,
  createdBy: string,
  voucherTypeRepo: IVoucherTypeDefinitionRepository,
  voucherFormRepo: IVoucherFormRepository
): Promise<void> => {
  const templates = Object.values(SALES_VOUCHER_SEED_TEMPLATES);
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
    
    // Ensure correct module tagging
    (companyVoucherType as any).module = template.module;
    await voucherTypeRepo.createVoucherType(companyVoucherType);

    // FORM MIGRATION / RE-HOMING - Run for EVERY template
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

    const fallbackForm = await voucherFormRepo.getDefaultForType(companyId, template.code);
    const companyForm = fallbackForm
      ? cloneVoucherFormForCompany(companyId, companyVoucherType.id, createdBy, fallbackForm)
      : buildFallbackVoucherForm(companyId, companyVoucherType.id, createdBy, template.code);

    await voucherFormRepo.create(companyForm);
  }
};

export interface InitializeSalesInput {
  companyId: string;
  userId: string;
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
    private readonly voucherFormRepo: IVoucherFormRepository
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

    const settings = new SalesSettings({
      companyId: input.companyId,
      allowDirectInvoicing: input.allowDirectInvoicing ?? true,
      requireSOForStockItems: input.requireSOForStockItems ?? false,
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
    private readonly voucherFormRepo: IVoucherFormRepository
  ) {}

  async execute(input: UpdateSalesSettingsInput): Promise<SalesSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Sales settings are not initialized');
    }

    const nextAllowDirectInvoicing = input.allowDirectInvoicing ?? existing.allowDirectInvoicing;
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
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requireSOForStockItems: input.requireSOForStockItems ?? existing.requireSOForStockItems,
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
