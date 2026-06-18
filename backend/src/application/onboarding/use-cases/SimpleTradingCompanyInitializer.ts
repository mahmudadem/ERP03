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

export interface SimpleTradingCompanyPolicySummary {
  templateId: 'simple-trading-company';
  templateName: string;
  modulesInitialized: string[];
  baseCurrency: string;
  accounting: {
    coaTemplate: 'periodic_trading';
    fiscalYearStart: string;
    fiscalYearEnd: string;
    approvalRequired: false;
  };
  inventory: {
    accountingMode: 'PERIODIC';
    costingMethod: 'MOVING_AVG';
    costingBasis: 'GLOBAL';
    allowNegativeStock: false;
    defaultWarehouseCode: 'MAIN';
  };
  sales: {
    workflowMode: 'SIMPLE';
    allowDirectInvoicing: true;
    defaultSalesInvoicePersona: 'direct';
  };
  purchases: {
    workflowMode: 'SIMPLE';
    allowDirectInvoicing: true;
  };
  tax: {
    status: 'READY_NOT_ASSUMED';
    note: string;
  };
  linkedAccounts: Record<string, { code: string; id: string; name: string }>;
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

const SIMPLE_ACCOUNT_SPECS: AccountSpec[] = [
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

const REQUIRED_ACCOUNT_CODES = {
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
} as const;

export class SimpleTradingCompanyInitializer {
  constructor(private readonly deps: Deps) {}

  async execute(input: {
    companyId: string;
    userId: string;
    baseCurrency: string;
  }): Promise<SimpleTradingCompanyPolicySummary> {
    const baseCurrency = String(input.baseCurrency || '').trim().toUpperCase();
    if (!baseCurrency) {
      throw new Error('Base currency is required for Simple Trading Company initialization.');
    }

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
      config: {
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        baseCurrency,
        coaTemplate: 'periodic_trading',
        selectedVoucherTypes: await this.getDefaultAccountingVoucherTemplateIds(),
        periodScheme: 'MONTHLY',
      },
    });

    await this.ensureSimpleTradingAccounts(input.companyId, input.userId, baseCurrency);
    const accounts = await this.resolveLinkedAccounts(input.companyId);

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
      accountingMode: 'PERIODIC',
      defaultWarehouseName: 'Main Warehouse',
      defaultWarehouseCode: 'MAIN',
      defaultCostCurrency: baseCurrency,
      costingBasis: 'GLOBAL',
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
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
      requireSOForStockItems: false,
      defaultSalesInvoicePersona: 'direct',
      defaultWarehouseId: inventoryResult.defaultWarehouse?.id,
      defaultARAccountId: undefined,
      arParentAccountId: accounts.arParent.id,
      partyAccountCodeFormat: '{parent}-{partyCode}',
      defaultRevenueAccountId: accounts.salesRevenue.id,
      defaultCOGSAccountId: accounts.cogs.id,
      defaultInventoryAccountId: accounts.inventoryAsset.id,
      defaultSalesExpenseAccountId: accounts.salesExpense.id,
      defaultSalesReturnAccountId: accounts.salesReturn.id,
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
      workflowMode: 'SIMPLE',
      allowDirectInvoicing: true,
      requirePOForStockItems: false,
      defaultWarehouseId: inventoryResult.defaultWarehouse?.id,
      defaultAPAccountId: accounts.apParent.id,
      apParentAccountId: accounts.apParent.id,
      partyAccountCodeFormat: '{parent}-{partyCode}',
      defaultPurchaseExpenseAccountId: accounts.purchaseExpense.id,
      defaultPurchaseReturnAccountId: accounts.purchaseReturn.id,
      defaultPurchaseDiscountAccountId: accounts.purchaseDiscount.id,
      defaultGRNIAccountId: accounts.grni.id,
      allowOverpayment: true,
    });

    return {
      templateId: 'simple-trading-company',
      templateName: 'Trading Company - Simple',
      modulesInitialized: ['accounting', 'inventory', 'sales', 'purchase'],
      baseCurrency,
      accounting: {
        coaTemplate: 'periodic_trading',
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        approvalRequired: false,
      },
      inventory: {
        accountingMode: 'PERIODIC',
        costingMethod: 'MOVING_AVG',
        costingBasis: 'GLOBAL',
        allowNegativeStock: false,
        defaultWarehouseCode: 'MAIN',
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

  private async ensureSimpleTradingAccounts(companyId: string, userId: string, baseCurrency: string): Promise<void> {
    for (const spec of SIMPLE_ACCOUNT_SPECS) {
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

  private async resolveLinkedAccounts(companyId: string) {
    const entries = await Promise.all(
      Object.entries(REQUIRED_ACCOUNT_CODES).map(async ([key, code]) => {
        const account = await this.deps.accountRepo.getByCode(companyId, code);
        if (!account) {
          throw new Error(`Simple Trading Company setup requires account ${code} (${key}), but it was not found.`);
        }
        return [key, account] as const;
      })
    );
    return Object.fromEntries(entries) as Record<keyof typeof REQUIRED_ACCOUNT_CODES, any>;
  }

  private toPolicyAccounts(accounts: Record<keyof typeof REQUIRED_ACCOUNT_CODES, any>) {
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
