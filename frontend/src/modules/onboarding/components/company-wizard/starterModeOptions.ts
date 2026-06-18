import type { InventoryAccountingMode } from '../../../../api/inventoryApi';

export type StarterModeOption = {
  value: InventoryAccountingMode;
  titleKey: string;
  titleDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
  reviewInventoryKey: string;
  reviewInventoryDefault: string;
  reviewWorkflowKey: string;
  reviewWorkflowDefault: string;
  summaryAccountingKey: string;
  summaryAccountingDefault: string;
  summaryInventoryKey: string;
  summaryInventoryDefault: string;
  summarySalesKey: string;
  summarySalesDefault: string;
  summaryPurchasesKey: string;
  summaryPurchasesDefault: string;
};

export const STARTER_MODE_OPTIONS: StarterModeOption[] = [
  {
    value: 'PERIODIC',
    titleKey: 'onboarding.companyWizard.needs.mode.options.simple.title',
    titleDefault: 'Simple',
    descriptionKey: 'onboarding.companyWizard.needs.mode.options.simple.description',
    descriptionDefault: 'I just track sales, purchases, and stock value',
    reviewInventoryKey: 'onboarding.companyWizard.review.starter.inventoryPeriodic',
    reviewInventoryDefault: 'Periodic stock valuation, global average cost, negative stock off',
    reviewWorkflowKey: 'onboarding.companyWizard.review.starter.workflowSimple',
    reviewWorkflowDefault: 'Simple sales and purchases',
    summaryAccountingKey: 'onboarding.companyWizard.needs.summary.accountingPeriodic',
    summaryAccountingDefault: 'Periodic trading chart of accounts',
    summaryInventoryKey: 'onboarding.companyWizard.needs.summary.inventoryPeriodic',
    summaryInventoryDefault: 'Periodic valuation with one company-wide average cost per item',
    summarySalesKey: 'onboarding.companyWizard.needs.summary.salesSimple',
    summarySalesDefault: 'Simple direct sales invoicing',
    summaryPurchasesKey: 'onboarding.companyWizard.needs.summary.purchasesSimple',
    summaryPurchasesDefault: 'Simple direct purchase invoicing',
  },
  {
    value: 'INVOICE_DRIVEN',
    titleKey: 'onboarding.companyWizard.needs.mode.options.standard.title',
    titleDefault: 'Standard',
    descriptionKey: 'onboarding.companyWizard.needs.mode.options.standard.description',
    descriptionDefault: 'Keep inventory value live, one invoice per transaction',
    reviewInventoryKey: 'onboarding.companyWizard.review.starter.inventoryInvoiceDriven',
    reviewInventoryDefault: 'Live inventory value on invoices, global average cost, negative stock off',
    reviewWorkflowKey: 'onboarding.companyWizard.review.starter.workflowSimple',
    reviewWorkflowDefault: 'Simple sales and purchases',
    summaryAccountingKey: 'onboarding.companyWizard.needs.summary.accountingStandard',
    summaryAccountingDefault: 'Inventory asset and COGS chart of accounts',
    summaryInventoryKey: 'onboarding.companyWizard.needs.summary.inventoryInvoiceDriven',
    summaryInventoryDefault: 'Invoice-driven inventory value with one company-wide average cost per item',
    summarySalesKey: 'onboarding.companyWizard.needs.summary.salesSimple',
    summarySalesDefault: 'Simple direct sales invoicing',
    summaryPurchasesKey: 'onboarding.companyWizard.needs.summary.purchasesSimple',
    summaryPurchasesDefault: 'Simple direct purchase invoicing',
  },
  {
    value: 'PERPETUAL',
    titleKey: 'onboarding.companyWizard.needs.mode.options.advanced.title',
    titleDefault: 'Advanced',
    descriptionKey: 'onboarding.companyWizard.needs.mode.options.advanced.description',
    descriptionDefault: 'Separate receiving and delivery, with full inventory control',
    reviewInventoryKey: 'onboarding.companyWizard.review.starter.inventoryPerpetual',
    reviewInventoryDefault: 'Perpetual stock valuation with warehouse-level moving average costing',
    reviewWorkflowKey: 'onboarding.companyWizard.review.starter.workflowOperational',
    reviewWorkflowDefault: 'Operational sales and purchases with receiving and delivery documents',
    summaryAccountingKey: 'onboarding.companyWizard.needs.summary.accountingAdvanced',
    summaryAccountingDefault: 'Inventory asset, COGS, and GRNI chart of accounts',
    summaryInventoryKey: 'onboarding.companyWizard.needs.summary.inventoryPerpetual',
    summaryInventoryDefault: 'Perpetual inventory value with warehouse-level moving average costing',
    summarySalesKey: 'onboarding.companyWizard.needs.summary.salesOperational',
    summarySalesDefault: 'Sales orders, delivery notes, and linked invoicing',
    summaryPurchasesKey: 'onboarding.companyWizard.needs.summary.purchasesOperational',
    summaryPurchasesDefault: 'Purchase orders, goods receipts, and linked invoicing',
  },
];

export const getStarterModeOption = (mode: InventoryAccountingMode | undefined): StarterModeOption =>
  STARTER_MODE_OPTIONS.find((option) => option.value === mode) || STARTER_MODE_OPTIONS[0];
