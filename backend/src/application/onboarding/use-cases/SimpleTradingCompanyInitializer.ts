import { InitializeAccountingUseCase } from '../../accounting/use-cases/InitializeAccountingUseCase';
import { EnsureAccountingEngineInitialized } from '../../accounting/use-cases/EnsureAccountingEngineInitialized';
import { InitializeInventoryUseCase } from '../../inventory/use-cases/InitializeInventoryUseCase';
import { InitializeSalesUseCase } from '../../sales/use-cases/SalesSettingsUseCases';
import { InitializePurchasesUseCase } from '../../purchases/use-cases/PurchaseSettingsUseCases';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanySettingsRepository } from '../../../repository/interfaces/core/ICompanySettingsRepository';
import { ICurrencyRepository } from '../../../repository/interfaces/company-wizard/ICurrencyRepository';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { ISystemMetadataRepository } from '../../../infrastructure/repositories/FirestoreSystemMetadataRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { IUomRepository } from '../../../repository/interfaces/inventory/IUomRepository';
import { IWarehouseRepository } from '../../../repository/interfaces/inventory/IWarehouseRepository';
import { IPurchaseSettingsRepository } from '../../../repository/interfaces/purchases/IPurchaseSettingsRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { IVoucherFormRepository } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

export type SimpleTradingCompanyMode = 'PERIODIC' | 'INVOICE_DRIVEN' | 'PERPETUAL';

export interface SimpleTradingCompanyPolicySummary {
  templateId: 'simple-trading-company';
  templateName: string;
  modulesInitialized: string[];
  baseCurrency: string;
  accounting: {
    coaTemplate: 'periodic_trading' | 'standard';
    fiscalYearStart: string;
    fiscalYearEnd: string;
    approvalRequired: false;
  };
  inventory: {
    accountingMode: SimpleTradingCompanyMode;
    costingMethod: 'MOVING_AVG';
    costingBasis: 'WAREHOUSE' | 'GLOBAL';
    allowNegativeStock: false;
    defaultWarehouseCode: 'MAIN';
  };
  sales: {
    workflowMode: 'SIMPLE' | 'OPERATIONAL';
    allowDirectInvoicing: boolean;
    defaultSalesInvoicePersona: 'direct' | 'linked';
  };
  purchases: {
    workflowMode: 'SIMPLE' | 'OPERATIONAL';
    allowDirectInvoicing: boolean;
  };
  tax: {
    status: 'READY_NOT_ASSUMED';
    note: string;
  };
  linkedAccounts: Partial<Record<string, { code: string; id: string; name: string }>>;
}

interface Deps {
  companyRepo: ICompanyRepository;
  companyModuleRepo: ICompanyModuleRepository;
  accountRepo: IAccountRepository;
  systemMetadataRepo: ISystemMetadataRepository;
  companyModuleSettingsRepo: ICompanyModuleSettingsRepository;
  companySettingsRepo: ICompanySettingsRepository;
  currencyRepo: ICurrencyRepository;
  fiscalYearRepo: IFiscalYearRepository;
  voucherTypeRepo: IVoucherTypeDefinitionRepository;
  voucherFormRepo: IVoucherFormRepository;
  inventorySettingsRepo: IInventorySettingsRepository;
  warehouseRepo: IWarehouseRepository;
  uomRepo: IUomRepository;
  salesSettingsRepo: ISalesSettingsRepository;
  purchaseSettingsRepo: IPurchaseSettingsRepository;
}

type AccountSpec = {
  code: string;
  name: string;
  classification: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentCode: string;
  balanceNature?: 'DEBIT' | 'CREDIT' | 'BOTH';
  plSubgroup?: 'SALES' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_REVENUE' | 'OTHER_EXPENSES';
  equitySubgroup?: 'RETAINED_EARNINGS' | 'CONTRIBUTED_CAPITAL' | 'RESERVES';
};

type StarterModePolicy = {
  templateName: string;
  coaTemplate: 'periodic_trading' | 'standard';
  inventory: {
    accountingMode: SimpleTradingCompanyMode;
    costingBasis: 'WAREHOUSE' | 'GLOBAL';
  };
  sales: {
    workflowMode: 'SIMPLE' | 'OPERATIONAL';
    allowDirectInvoicing: boolean;
    defaultSalesInvoicePersona: 'direct' | 'linked';
  };
  purchases: {
    workflowMode: 'SIMPLE' | 'OPERATIONAL';
    allowDirectInvoicing: boolean;
  };
  linkedAccountCodes: Record<string, string>;
};

const SUPPORTING_ACCOUNT_SPECS: AccountSpec[] = [
  {
    code: '10303',
    name: 'Inventory Transfer Clearing',
    classification: 'ASSET',
    parentCode: '103',
    balanceNature: 'BOTH',
  },
  {
    code: '303',
    name: 'Opening Balance Equity',
    classification: 'EQUITY',
    parentCode: '3',
    balanceNature: 'BOTH',
    equitySubgroup: 'RESERVES',
  },
  {
    code: '304',
    name: 'Inventory Revaluation Reserve',
    classification: 'EQUITY',
    parentCode: '3',
    balanceNature: 'BOTH',
    equitySubgroup: 'RESERVES',
  },
  {
    code: '406',
    name: 'Inventory Adjustment Gain',
    classification: 'REVENUE',
    parentCode: '4',
    plSubgroup: 'OTHER_REVENUE',
  },
  {
    code: '50203',
    name: 'Inventory Adjustment Loss',
    classification: 'EXPENSE',
    parentCode: '502',
    plSubgroup: 'OPERATING_EXPENSES',
  },
  {
    code: '50204',
    name: 'Inventory Revaluation Expense',
    classification: 'EXPENSE',
    parentCode: '502',
    plSubgroup: 'OPERATING_EXPENSES',
  },
];

const STARTER_MODE_POLICIES: Record<SimpleTradingCompanyMode, StarterModePolicy> = {
  PERIODIC: {
    templateName: 'Trading Company - Simple',
    coaTemplate: 'periodic_trading',
    inventory: {
      accountingMode: 'PERIODIC',
      costingBasis: 'GLOBAL',
    },
    sales: {
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
      defaultSalesInvoicePersona: 'direct',
    },
    purchases: {
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
    },
    linkedAccountCodes: {
      cash: '10101',
      bank: '10201',
      inventoryAsset: '10301',
      transferClearing: '10303',
      arParent: '10401',
      apParent: '20100',
      grni: '209',
      openingEquity: '303',
      revaluationReserve: '304',
      salesRevenue: '400',
      salesReturn: '401',
      cogs: '50101',
      purchaseExpense: '50101',
      purchaseReturn: '50103',
      purchaseDiscount: '50104',
      salesExpense: '50202',
      inventoryGain: '406',
      inventoryLoss: '50203',
    },
  },
  INVOICE_DRIVEN: {
    templateName: 'Trading Company - Standard',
    coaTemplate: 'standard',
    inventory: {
      accountingMode: 'INVOICE_DRIVEN',
      costingBasis: 'GLOBAL',
    },
    sales: {
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
      defaultSalesInvoicePersona: 'direct',
    },
    purchases: {
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
    },
    linkedAccountCodes: {
      cash: '10101',
      bank: '10201',
      inventoryAsset: '10301',
      transferClearing: '10303',
      arParent: '10401',
      apParent: '20100',
      grni: '209',
      openingEquity: '303',
      revaluationReserve: '304',
      salesRevenue: '400',
      cogs: '50100',
      purchaseExpense: '50101',
      salesExpense: '50202',
      inventoryGain: '406',
      inventoryLoss: '50203',
    },
  },
  PERPETUAL: {
    templateName: 'Trading Company - Advanced',
    coaTemplate: 'standard',
    inventory: {
      accountingMode: 'PERPETUAL',
      costingBasis: 'WAREHOUSE',
    },
    sales: {
      workflowMode: 'OPERATIONAL',
      allowDirectInvoicing: false,
      defaultSalesInvoicePersona: 'linked',
    },
    purchases: {
      workflowMode: 'OPERATIONAL',
      allowDirectInvoicing: false,
    },
    linkedAccountCodes: {
      cash: '10101',
      bank: '10201',
      inventoryAsset: '10301',
      transferClearing: '10303',
      arParent: '10401',
      apParent: '20100',
      grni: '209',
      openingEquity: '303',
      revaluationReserve: '304',
      salesRevenue: '400',
      cogs: '50100',
      purchaseExpense: '50101',
      salesExpense: '50202',
      inventoryGain: '406',
      inventoryLoss: '50203',
    },
  },
};

export class SimpleTradingCompanyInitializer {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    companyId: string;
    userId: string;
    baseCurrency: string;
    accountingMode?: SimpleTradingCompanyMode;
    /**
     * True when re-running the initializer against an already-set-up company (e.g. a
     * pre-posting inventory accounting-mode switch). Preserves the owner's approval mode
     * and fiscal-year configuration while still reseeding the COA + module defaults.
     */
    preserveCompanyPolicy?: boolean;
  }): Promise<SimpleTradingCompanyPolicySummary> {
    const baseCurrency = String(input.baseCurrency || '').trim().toUpperCase();
    if (!baseCurrency) {
      throw new Error('Base currency is required for Simple Trading Company initialization.');
    }
    const starterMode = input.accountingMode || 'PERIODIC';
    const policy = STARTER_MODE_POLICIES[starterMode];

    const accountingUseCase = new InitializeAccountingUseCase(
      this.deps.companyModuleRepo,
      this.deps.accountRepo,
      this.deps.systemMetadataRepo,
      this.deps.companyModuleSettingsRepo,
      this.deps.companySettingsRepo,
      this.deps.currencyRepo,
      this.deps.companyRepo,
      this.deps.fiscalYearRepo,
      this.deps.voucherTypeRepo,
      this.deps.voucherFormRepo
    );

    await accountingUseCase.execute({
      companyId: input.companyId,
      preserveCompanyPolicy: input.preserveCompanyPolicy ?? false,
      config: {
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        baseCurrency,
        coaTemplate: policy.coaTemplate,
        selectedVoucherTypes: await this.getDefaultAccountingVoucherTemplateIds(),
        periodScheme: 'MONTHLY',
      },
    });

    await this.ensureSupportingAccounts(input.companyId, input.userId, baseCurrency);
    const accounts = await this.resolveLinkedAccounts(input.companyId, policy.linkedAccountCodes);

    const inventoryUseCase = new InitializeInventoryUseCase(
      this.deps.companyRepo,
      this.deps.inventorySettingsRepo,
      this.deps.warehouseRepo,
      this.deps.uomRepo,
      this.deps.companyModuleRepo,
      this.deps.voucherTypeRepo,
      this.deps.voucherFormRepo
    );
    const inventoryResult = await inventoryUseCase.execute({
      companyId: input.companyId,
      userId: input.userId,
      accountingMode: policy.inventory.accountingMode,
      defaultWarehouseName: 'Main Warehouse',
      defaultWarehouseCode: 'MAIN',
      defaultCostCurrency: baseCurrency,
      costingBasis: policy.inventory.costingBasis,
      allowNegativeStock: false,
      autoGenerateItemCode: true,
      itemCodePrefix: 'ITM',
      itemCodeNextSeq: 1,
      defaultInventoryAssetAccountId: accounts.inventoryAsset.id,
      defaultCOGSAccountId: accounts.cogs.id,
      defaultInventoryGainAccountId: accounts.inventoryGain.id,
      defaultInventoryLossAccountId: accounts.inventoryLoss.id,
      defaultInventoryTransferClearingAccountId: accounts.transferClearing.id,
      defaultInventoryRevaluationAccountId: accounts.revaluationReserve.id,
      allowNegativeInventoryValue: false,
    });

    const ensureAccounting = new EnsureAccountingEngineInitialized(
      this.deps.companyModuleRepo,
      this.deps.companyRepo,
      accountingUseCase
    );

    const salesUseCase = new InitializeSalesUseCase(
      this.deps.salesSettingsRepo,
      this.deps.accountRepo,
      this.deps.companyModuleRepo,
      this.deps.voucherTypeRepo,
      this.deps.voucherFormRepo,
      ensureAccounting,
      this.deps.inventorySettingsRepo
    );
    await salesUseCase.execute({
      companyId: input.companyId,
      userId: input.userId,
      workflowMode: policy.sales.workflowMode,
      allowDirectInvoicing: policy.sales.allowDirectInvoicing,
      requireSOForStockItems: policy.sales.workflowMode === 'OPERATIONAL',
      defaultSalesInvoicePersona: policy.sales.defaultSalesInvoicePersona,
      defaultWarehouseId: inventoryResult.defaultWarehouse?.id,
      defaultARAccountId: undefined,
      arParentAccountId: accounts.arParent.id,
      partyAccountCodeFormat: '{parent}-{partyCode}',
      defaultRevenueAccountId: accounts.salesRevenue.id,
      defaultCOGSAccountId: accounts.cogs.id,
      defaultInventoryAccountId: accounts.inventoryAsset.id,
      defaultSalesExpenseAccountId: accounts.salesExpense.id,
      defaultSalesReturnAccountId: accounts.salesReturn?.id,
      allowOverpayment: true,
    });

    const purchasesUseCase = new InitializePurchasesUseCase(
      this.deps.purchaseSettingsRepo,
      this.deps.accountRepo,
      this.deps.companyModuleRepo,
      this.deps.voucherTypeRepo,
      this.deps.voucherFormRepo,
      ensureAccounting,
      this.deps.inventorySettingsRepo
    );
    await purchasesUseCase.execute({
      companyId: input.companyId,
      userId: input.userId,
      workflowMode: policy.purchases.workflowMode,
      allowDirectInvoicing: policy.purchases.allowDirectInvoicing,
      requirePOForStockItems: policy.purchases.workflowMode === 'OPERATIONAL',
      defaultWarehouseId: inventoryResult.defaultWarehouse?.id,
      defaultAPAccountId: accounts.apParent.id,
      apParentAccountId: accounts.apParent.id,
      partyAccountCodeFormat: '{parent}-{partyCode}',
      defaultPurchaseExpenseAccountId: accounts.purchaseExpense?.id,
      defaultPurchaseReturnAccountId: accounts.purchaseReturn?.id,
      defaultPurchaseDiscountAccountId: accounts.purchaseDiscount?.id,
      defaultGRNIAccountId: accounts.grni.id,
      allowOverpayment: true,
    });

    return {
      templateId: 'simple-trading-company',
      templateName: policy.templateName,
      modulesInitialized: ['accounting', 'inventory', 'sales', 'purchase'],
      baseCurrency,
      accounting: {
        coaTemplate: policy.coaTemplate,
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        approvalRequired: false,
      },
      inventory: {
        accountingMode: policy.inventory.accountingMode,
        costingMethod: 'MOVING_AVG',
        costingBasis: policy.inventory.costingBasis,
        allowNegativeStock: false,
        defaultWarehouseCode: 'MAIN',
      },
      sales: {
        workflowMode: policy.sales.workflowMode,
        allowDirectInvoicing: policy.sales.allowDirectInvoicing,
        defaultSalesInvoicePersona: policy.sales.defaultSalesInvoicePersona,
      },
      purchases: {
        workflowMode: policy.purchases.workflowMode,
        allowDirectInvoicing: policy.purchases.allowDirectInvoicing,
      },
      tax: {
        status: 'READY_NOT_ASSUMED',
        note: 'Tax setup is ready for tax codes, but no country tax rate is silently applied by this template.',
      },
      linkedAccounts: this.toPolicyAccounts(accounts),
    };
  }

  private async getDefaultAccountingVoucherTemplateIds(): Promise<string[]> {
    const templates = await this.deps.voucherTypeRepo.getSystemTemplates();
    return templates
      .filter((template: any) => String(template.module || '').trim().toUpperCase() === 'ACCOUNTING')
      .map((template: any) => template.id)
      .filter(Boolean);
  }

  private async ensureSupportingAccounts(companyId: string, userId: string, baseCurrency: string): Promise<void> {
    for (const spec of SUPPORTING_ACCOUNT_SPECS) {
      const existing = await this.deps.accountRepo.getByCode(companyId, spec.code);
      if (existing) continue;

      const parent = await this.deps.accountRepo.getByCode(companyId, spec.parentCode);
      if (!parent) {
        throw new Error(`Cannot create account ${spec.code}; parent account ${spec.parentCode} is missing.`);
      }

      await this.deps.accountRepo.create(companyId, {
        userCode: spec.code,
        name: spec.name,
        classification: spec.classification,
        parentId: parent.id,
        accountRole: 'POSTING',
        balanceNature: spec.balanceNature,
        currencyPolicy: 'FIXED',
        fixedCurrencyCode: baseCurrency,
        createdBy: userId || 'SYSTEM',
        plSubgroup: spec.plSubgroup,
        equitySubgroup: spec.equitySubgroup,
      });
    }
  }

  private async resolveLinkedAccounts(companyId: string, linkedAccountCodes: Record<string, string>) {
    const entries = await Promise.all(
      Object.entries(linkedAccountCodes).map(async ([key, code]) => {
        const account = await this.deps.accountRepo.getByCode(companyId, code);
        if (!account) {
          throw new Error(`Simple Trading Company setup requires account ${code} (${key}), but it was not found.`);
        }
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<string, any>;
  }

  private toPolicyAccounts(accounts: Record<string, any>) {
    return Object.fromEntries(
      Object.entries(accounts).map(([key, account]) => [
        key,
        {
          code: account.userCode,
          id: account.id,
          name: account.name,
        },
      ])
    );
  }
}
