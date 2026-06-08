export type WorkflowMode = 'SIMPLE' | 'OPERATIONAL';

export type GovernanceRuleScope = 'company' | 'branch' | 'form';
export type GovernanceAction = 'allow' | 'block';
export type SalesPaymentMethodCode = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'OTHER';
export type SalesMessagingChannel = 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
export type SalesMessagingProvider = 'META_WHATSAPP_CLOUD' | 'SMTP' | 'TELEGRAM_BOT';

export interface GovernanceRule {
  id: string;
  scope: GovernanceRuleScope;
  action: GovernanceAction;
  persona: 'direct' | 'linked' | 'service';
  branchId?: string;
  formType?: string;
}

export interface SalesPaymentMethodConfig {
  method: SalesPaymentMethodCode;
  settlementAccountId: string;
  label?: string;
  isEnabled?: boolean;
}

export interface SalesMessagingAccount {
  id: string;
  channel: SalesMessagingChannel;
  provider: SalesMessagingProvider;
  label: string;
  isDefault?: boolean;
  isActive?: boolean;
  phoneNumberE164?: string;
  phoneNumberId?: string;
  fromAddress?: string;
  fromDisplayName?: string;
  botUsername?: string;
  apiVersion?: string;
  encryptedCredential?: string;
}

export interface SalesSettingsProps {
  companyId: string;
  workflowMode?: WorkflowMode;
  /** When workflowMode is SIMPLE, set this true to still expose Sales Orders
   *  and Delivery Notes in the UI (useful for occasional operational use). */
  showOperationalDocsInSimple?: boolean;
  /** Governance: when false, credit-limit BLOCK is absolute and override is disabled
   *  even for users with the `sales.creditOverride` permission. Default true. */
  allowCreditOverride?: boolean;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  /** Parent account under which per-customer AR sub-accounts are auto-created. */
  arParentAccountId?: string;
  /** Template used when auto-creating per-customer AR sub-accounts. Tokens: {parent}, {partyCode}, {seq3}. */
  partyAccountCodeFormat?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  defaultRefundAccountId?: string;
  restockingFeeAccountId?: string;
  exchangeGainLossAccountId?: string;
  allowOverDelivery: boolean;
  /** Governance: when true, a settlement may exceed the invoice outstanding; the excess
   *  drives the party's AR balance negative (a credit owed to the customer). Default false. */
  allowOverpayment?: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  paymentMethodConfigs?: SalesPaymentMethodConfig[];
  messagingAccounts?: SalesMessagingAccount[];
  governanceRules?: GovernanceRule[];
  defaultSalesInvoicePersona?: 'direct' | 'linked' | 'service';
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;
  quoteNumberPrefix?: string;
  quoteNumberNextSeq?: number;
}

export class SalesSettings {
  readonly companyId: string;
  workflowMode: WorkflowMode;
  showOperationalDocsInSimple: boolean;
  allowCreditOverride: boolean;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  arParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  defaultRefundAccountId?: string;
  restockingFeeAccountId?: string;
  exchangeGainLossAccountId?: string;
  allowOverDelivery: boolean;
  allowOverpayment: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  paymentMethodConfigs: SalesPaymentMethodConfig[];
  messagingAccounts: SalesMessagingAccount[];
  governanceRules: GovernanceRule[];
  defaultSalesInvoicePersona: 'direct' | 'linked' | 'service';
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;
  quoteNumberPrefix: string;
  quoteNumberNextSeq: number;

  constructor(props: SalesSettingsProps) {
    if (!props.companyId?.trim()) throw new Error('SalesSettings companyId is required');
    if (!props.defaultRevenueAccountId?.trim()) throw new Error('SalesSettings defaultRevenueAccountId is required');

    this.companyId = props.companyId;
    this.workflowMode = props.workflowMode === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL';
    this.showOperationalDocsInSimple = props.showOperationalDocsInSimple === true;
    this.allowCreditOverride = props.allowCreditOverride !== false;
    this.allowDirectInvoicing = props.allowDirectInvoicing;
    this.requireSOForStockItems = props.requireSOForStockItems;
    this.defaultARAccountId = props.defaultARAccountId?.trim() || undefined;
    this.arParentAccountId = props.arParentAccountId?.trim() || undefined;
    this.partyAccountCodeFormat = props.partyAccountCodeFormat?.trim() || undefined;
    this.defaultRevenueAccountId = props.defaultRevenueAccountId.trim();
    this.defaultCOGSAccountId = props.defaultCOGSAccountId;
    this.defaultInventoryAccountId = props.defaultInventoryAccountId;
    this.defaultSalesExpenseAccountId = props.defaultSalesExpenseAccountId;
    this.defaultRefundAccountId = props.defaultRefundAccountId?.trim() || undefined;
    this.restockingFeeAccountId = props.restockingFeeAccountId?.trim() || undefined;
    this.exchangeGainLossAccountId = props.exchangeGainLossAccountId?.trim() || undefined;
    this.allowOverDelivery = props.allowOverDelivery;
    this.allowOverpayment = props.allowOverpayment === true;
    this.overDeliveryTolerancePct = props.overDeliveryTolerancePct;
    this.overInvoiceTolerancePct = props.overInvoiceTolerancePct;
    this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
    this.paymentMethodConfigs = (props.paymentMethodConfigs ?? [])
      .filter((config) => !!config?.method && !!config?.settlementAccountId)
      .map((config) => ({
        method: config.method,
        settlementAccountId: config.settlementAccountId.trim(),
        label: config.label?.trim() || undefined,
        isEnabled: config.isEnabled ?? true,
      }));
    const rawMessagingAccounts = (props.messagingAccounts ?? [])
      .filter((account) => !!account?.id && !!account?.channel && !!account?.provider && !!account?.label)
      .map((account) => ({
        id: String(account.id).trim(),
        channel: account.channel,
        provider: account.provider,
        label: String(account.label).trim(),
        isDefault: account.isDefault ?? false,
        isActive: account.isActive ?? true,
        phoneNumberE164: account.phoneNumberE164?.trim() || undefined,
        phoneNumberId: account.phoneNumberId?.trim() || undefined,
        fromAddress: account.fromAddress?.trim() || undefined,
        fromDisplayName: account.fromDisplayName?.trim() || undefined,
        botUsername: account.botUsername?.trim() || undefined,
        apiVersion: account.apiVersion?.trim() || undefined,
        encryptedCredential: account.encryptedCredential?.trim() || undefined,
      }));

    const normalizedMessagingByChannel = new Map<SalesMessagingChannel, SalesMessagingAccount[]>();
    rawMessagingAccounts.forEach((account) => {
      const current = normalizedMessagingByChannel.get(account.channel) || [];
      current.push(account);
      normalizedMessagingByChannel.set(account.channel, current);
    });

    this.messagingAccounts = [];
    normalizedMessagingByChannel.forEach((accounts) => {
      const active = accounts.filter((entry) => entry.isActive !== false);
      const explicitDefault = active.find((entry) => entry.isDefault);
      const effectiveDefaultId = explicitDefault?.id || active[0]?.id;

      accounts.forEach((entry) => {
        if (entry.channel === 'WHATSAPP' && !entry.phoneNumberId) {
          throw new Error(`SalesSettings messaging account ${entry.id} is missing phoneNumberId`);
        }
        this.messagingAccounts.push({
          ...entry,
          isDefault: entry.id === effectiveDefaultId,
          isActive: entry.isActive !== false,
        });
      });
    });
    this.governanceRules = props.governanceRules ?? [];
    this.defaultSalesInvoicePersona = props.defaultSalesInvoicePersona ?? 'direct';
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.soNumberPrefix = props.soNumberPrefix || 'SO';
    this.soNumberNextSeq = props.soNumberNextSeq || 1;
    this.dnNumberPrefix = props.dnNumberPrefix || 'DN';
    this.dnNumberNextSeq = props.dnNumberNextSeq || 1;
    this.siNumberPrefix = props.siNumberPrefix || 'SI';
    this.siNumberNextSeq = props.siNumberNextSeq || 1;
    this.srNumberPrefix = props.srNumberPrefix || 'SR';
    this.srNumberNextSeq = props.srNumberNextSeq || 1;
    this.quoteNumberPrefix = props.quoteNumberPrefix || 'QT';
    this.quoteNumberNextSeq = props.quoteNumberNextSeq || 1;
  }

  static createDefault(
    companyId: string,
    defaultARAccountId: string | undefined,
    defaultRevenueAccountId: string
  ): SalesSettings {
    return new SalesSettings({
      companyId,
      workflowMode: 'OPERATIONAL',
      showOperationalDocsInSimple: false,
      allowCreditOverride: true,
      allowDirectInvoicing: true,
      requireSOForStockItems: false,
      defaultARAccountId,
      defaultRevenueAccountId,
      allowOverDelivery: false,
      allowOverpayment: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
      defaultPaymentTermsDays: 30,
      paymentMethodConfigs: [],
      messagingAccounts: [],
      governanceRules: [],
      defaultSalesInvoicePersona: 'direct',
      soNumberPrefix: 'SO',
      soNumberNextSeq: 1,
      dnNumberPrefix: 'DN',
      dnNumberNextSeq: 1,
      siNumberPrefix: 'SI',
      siNumberNextSeq: 1,
      srNumberPrefix: 'SR',
      srNumberNextSeq: 1,
      quoteNumberPrefix: 'QT',
      quoteNumberNextSeq: 1,
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      workflowMode: this.workflowMode,
      showOperationalDocsInSimple: this.showOperationalDocsInSimple,
      allowCreditOverride: this.allowCreditOverride,
      allowDirectInvoicing: this.allowDirectInvoicing,
      requireSOForStockItems: this.requireSOForStockItems,
      defaultARAccountId: this.defaultARAccountId,
      arParentAccountId: this.arParentAccountId,
      partyAccountCodeFormat: this.partyAccountCodeFormat,
      defaultRevenueAccountId: this.defaultRevenueAccountId,
      defaultCOGSAccountId: this.defaultCOGSAccountId,
      defaultInventoryAccountId: this.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: this.defaultSalesExpenseAccountId,
      defaultRefundAccountId: this.defaultRefundAccountId,
      restockingFeeAccountId: this.restockingFeeAccountId,
      exchangeGainLossAccountId: this.exchangeGainLossAccountId,
      allowOverDelivery: this.allowOverDelivery,
      allowOverpayment: this.allowOverpayment,
      overDeliveryTolerancePct: this.overDeliveryTolerancePct,
      overInvoiceTolerancePct: this.overInvoiceTolerancePct,
      defaultPaymentTermsDays:     this.defaultPaymentTermsDays,
      paymentMethodConfigs: this.paymentMethodConfigs,
      messagingAccounts: this.messagingAccounts,
      governanceRules: this.governanceRules,
      defaultSalesInvoicePersona: this.defaultSalesInvoicePersona,
      defaultWarehouseId: this.defaultWarehouseId,
      soNumberPrefix: this.soNumberPrefix,
      soNumberNextSeq: this.soNumberNextSeq,
      dnNumberPrefix: this.dnNumberPrefix,
      dnNumberNextSeq: this.dnNumberNextSeq,
      siNumberPrefix: this.siNumberPrefix,
      siNumberNextSeq: this.siNumberNextSeq,
      srNumberPrefix: this.srNumberPrefix,
      srNumberNextSeq: this.srNumberNextSeq,
      quoteNumberPrefix: this.quoteNumberPrefix,
      quoteNumberNextSeq: this.quoteNumberNextSeq,
    };
  }

  static fromJSON(data: any): SalesSettings {
    return new SalesSettings({
      companyId: data.companyId,
      workflowMode: data.workflowMode === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL',
      showOperationalDocsInSimple: data.showOperationalDocsInSimple === true,
      allowCreditOverride: data.allowCreditOverride !== false,
      allowDirectInvoicing: data.allowDirectInvoicing ?? true,
      requireSOForStockItems: data.requireSOForStockItems ?? false,
      defaultARAccountId: data.defaultARAccountId,
      arParentAccountId: data.arParentAccountId,
      partyAccountCodeFormat: data.partyAccountCodeFormat,
      defaultRevenueAccountId: data.defaultRevenueAccountId,
      defaultCOGSAccountId: data.defaultCOGSAccountId,
      defaultInventoryAccountId: data.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: data.defaultSalesExpenseAccountId,
      defaultRefundAccountId: data.defaultRefundAccountId,
      restockingFeeAccountId: data.restockingFeeAccountId,
      exchangeGainLossAccountId: data.exchangeGainLossAccountId,
      allowOverDelivery: data.allowOverDelivery ?? false,
      allowOverpayment: data.allowOverpayment ?? false,
      overDeliveryTolerancePct: data.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: data.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? 30,
      paymentMethodConfigs: data.paymentMethodConfigs ?? [],
      messagingAccounts: data.messagingAccounts ?? [],
      governanceRules: data.governanceRules ?? [],
      defaultSalesInvoicePersona: data.defaultSalesInvoicePersona ?? 'direct',
      defaultWarehouseId: data.defaultWarehouseId,
      soNumberPrefix: data.soNumberPrefix || 'SO',
      soNumberNextSeq: data.soNumberNextSeq ?? 1,
      dnNumberPrefix: data.dnNumberPrefix || 'DN',
      dnNumberNextSeq: data.dnNumberNextSeq ?? 1,
      siNumberPrefix: data.siNumberPrefix || 'SI',
      siNumberNextSeq: data.siNumberNextSeq ?? 1,
      srNumberPrefix: data.srNumberPrefix || 'SR',
      srNumberNextSeq: data.srNumberNextSeq ?? 1,
      quoteNumberPrefix: data.quoteNumberPrefix || 'QT',
      quoteNumberNextSeq: data.quoteNumberNextSeq ?? 1,
    });
  }
}
