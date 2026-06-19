import { DocumentPolicyResolver } from '../../common/services/DocumentPolicyResolver';
import {
  GovernanceRule,
  SalesMessagingAccount,
  SalesPaymentMethodConfig,
  SalesSettings,
} from '../../../domain/sales/entities/SalesSettings';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { IVoucherFormRepository } from '../../../repository/interfaces/designer/IVoucherFormRepository';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { IInventorySettingsRepository } from '../../../repository/interfaces/inventory/IInventorySettingsRepository';
import { ISalesSettingsRepository } from '../../../repository/interfaces/sales/ISalesSettingsRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { IDeliveryNoteRepository } from '../../../repository/interfaces/sales/IDeliveryNoteRepository';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { EnsureAccountingEngineInitialized } from '../../accounting/use-cases/EnsureAccountingEngineInitialized';
import { ICredentialCipher } from '../services/ICredentialCipher';
import { validatePartyAccountCodeFormat } from '../../shared/services/PartyAccountCodeRenderer';
import { syncCompanyVoucherTemplatesFromSystem } from '../../system/services/CompanyVoucherTemplateSyncService';

// Voucher type/form copy is delegated to syncCompanyVoucherTemplatesFromSystem,
// which honors the user's selectedVoucherTypes pick from the init wizard and
// keeps the same code path used by Accounting and the manual sync endpoint.

export interface InitializeSalesInput {
  companyId: string;
  userId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  defaultARAccountId?: string;
  arParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultRevenueAccountId: string;
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  defaultSalesReturnAccountId?: string;
  allowOverDelivery?: boolean;
  allowOverpayment?: boolean;
  deriveLinePriceAcrossUom?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  paymentMethodConfigs?: SalesPaymentMethodConfig[];
  messagingAccounts?: SalesMessagingAccountInput[];
  governanceRules?: GovernanceRule[];
  defaultSalesInvoicePersona?: 'direct' | 'linked' | 'service';
  defaultWarehouseId?: string;
  soNumberPrefix?: string;
  soNumberNextSeq?: number;
  dnNumberPrefix?: string;
  dnNumberNextSeq?: number;
  siNumberPrefix?: string;
  siNumberNextSeq?: number;
  srNumberPrefix?: string;
  srNumberNextSeq?: number;
  /**
   * IDs of system Sales voucher templates the user picked in the wizard.
   * `undefined` keeps legacy behavior (copy every SALES template).
   * `[]` copies nothing (user picked none).
   */
  selectedVoucherTypes?: string[];
}

export interface UpdateSalesSettingsInput {
  companyId: string;
  workflowMode?: 'SIMPLE' | 'OPERATIONAL';
  showOperationalDocsInSimple?: boolean;
  allowCreditOverride?: boolean;
  allowDirectInvoicing?: boolean;
  requireSOForStockItems?: boolean;
  defaultARAccountId?: string;
  arParentAccountId?: string;
  partyAccountCodeFormat?: string;
  defaultRevenueAccountId?: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  defaultSalesReturnAccountId?: string;
  defaultRefundAccountId?: string;
  restockingFeeAccountId?: string;
  allowOverDelivery?: boolean;
  allowOverpayment?: boolean;
  deriveLinePriceAcrossUom?: boolean;
  overDeliveryTolerancePct?: number;
  overInvoiceTolerancePct?: number;
  defaultPaymentTermsDays?: number;
  paymentMethodConfigs?: SalesPaymentMethodConfig[];
  messagingAccounts?: SalesMessagingAccountInput[];
  governanceRules?: GovernanceRule[];
  defaultSalesInvoicePersona?: 'direct' | 'linked' | 'service';
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

export interface SalesMessagingAccountInput {
  id: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'TELEGRAM';
  provider: 'META_WHATSAPP_CLOUD' | 'SMTP' | 'TELEGRAM_BOT';
  label: string;
  isDefault?: boolean;
  isActive?: boolean;
  phoneNumberE164?: string;
  phoneNumberId?: string;
  fromAddress?: string;
  fromDisplayName?: string;
  botUsername?: string;
  apiVersion?: string;
  credential?: string;
  encryptedCredential?: string;
}

const normalizeMessagingAccounts = (
  inputAccounts: SalesMessagingAccountInput[] | undefined,
  existingAccounts: SalesMessagingAccount[] | undefined,
  credentialCipher?: ICredentialCipher
): SalesMessagingAccount[] => {
  if (!inputAccounts) return existingAccounts ?? [];
  const existingById = new Map((existingAccounts ?? []).map((account) => [account.id, account]));

  return inputAccounts.map((account) => {
    const existing = existingById.get(account.id);
    const rawCredential = typeof account.credential === 'string' ? account.credential.trim() : '';
    const rawEncrypted = typeof account.encryptedCredential === 'string' ? account.encryptedCredential.trim() : '';
    let encryptedCredential = rawEncrypted || existing?.encryptedCredential;

    if (rawCredential) {
      if (!credentialCipher) {
        throw new Error('Credential cipher is required to encrypt messaging credentials.');
      }
      encryptedCredential = credentialCipher.encrypt(rawCredential);
    }
    if (account.isActive !== false && !encryptedCredential) {
      throw new Error(`Messaging account ${account.id} is active but has no credential.`);
    }

    return {
      id: account.id,
      channel: account.channel,
      provider: account.provider,
      label: account.label,
      isDefault: account.isDefault,
      isActive: account.isActive,
      phoneNumberE164: account.phoneNumberE164,
      phoneNumberId: account.phoneNumberId,
      fromAddress: account.fromAddress,
      fromDisplayName: account.fromDisplayName,
      botUsername: account.botUsername,
      apiVersion: account.apiVersion,
      encryptedCredential,
    };
  });
};

export class InitializeSalesUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyModuleRepo: ICompanyModuleRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly ensureAccountingEngine: EnsureAccountingEngineInitialized,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository,
    private readonly credentialCipher?: ICredentialCipher
  ) {}

  async execute(input: InitializeSalesInput): Promise<SalesSettings> {
    await this.ensureAccountingEngine.execute(input.companyId);

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

    await syncCompanyVoucherTemplatesFromSystem({
      companyId: input.companyId,
      modules: ['SALES'],
      selectedTemplateIds: input.selectedVoucherTypes,
      createdBy: input.userId || 'SYSTEM',
      voucherTypeRepo: this.voucherTypeRepo,
      voucherFormRepo: this.voucherFormRepo,
    });

    const workflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode);
    const workflowDefaults = DocumentPolicyResolver.applySalesWorkflowDefaults(workflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? true,
      requireSOForStockItems: input.requireSOForStockItems ?? false,
    });

    const defaultSalesInvoicePersona = workflowMode === 'SIMPLE' ? 'direct' as const : 'linked' as const;

    if (input.arParentAccountId) {
      const parent = await this.accountRepo.getById(input.companyId, input.arParentAccountId);
      if (!parent) {
        throw new Error(`AR parent account not found: ${input.arParentAccountId}`);
      }
      if (parent.classification !== 'ASSET') {
        throw new Error(`AR parent account must be classified as ASSET (got ${parent.classification})`);
      }
    }
    const partyAccountCodeFormatError = validatePartyAccountCodeFormat(input.partyAccountCodeFormat);
    if (partyAccountCodeFormatError) {
      throw new Error(partyAccountCodeFormatError);
    }

    const settings = new SalesSettings({
      companyId: input.companyId,
      workflowMode,
      allowDirectInvoicing: workflowDefaults.allowDirectInvoicing,
      requireSOForStockItems: workflowDefaults.requireSOForStockItems,
      defaultARAccountId: input.defaultARAccountId,
      arParentAccountId: input.arParentAccountId,
      partyAccountCodeFormat: input.partyAccountCodeFormat,
      defaultRevenueAccountId: input.defaultRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId,
      defaultInventoryAccountId: input.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId,
      defaultSalesReturnAccountId: input.defaultSalesReturnAccountId,
      allowOverDelivery: input.allowOverDelivery ?? false,
      allowOverpayment: input.allowOverpayment ?? false,
      deriveLinePriceAcrossUom: input.deriveLinePriceAcrossUom ?? false,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? 30,
      paymentMethodConfigs: input.paymentMethodConfigs ?? [],
      messagingAccounts: normalizeMessagingAccounts(input.messagingAccounts, [], this.credentialCipher),
      governanceRules: input.governanceRules ?? [],
      defaultSalesInvoicePersona: input.defaultSalesInvoicePersona ?? defaultSalesInvoicePersona,
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

    return settings;
  }
}

export class UpdateSalesSettingsUseCase {
  constructor(
    private readonly settingsRepo: ISalesSettingsRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private readonly voucherFormRepo: IVoucherFormRepository,
    private readonly salesOrderRepo: ISalesOrderRepository,
    private readonly deliveryNoteRepo: IDeliveryNoteRepository,
    private readonly inventorySettingsRepo?: IInventorySettingsRepository,
    private readonly credentialCipher?: ICredentialCipher
  ) {}

  async execute(input: UpdateSalesSettingsInput): Promise<SalesSettings> {
    const existing = await this.settingsRepo.getSettings(input.companyId);
    if (!existing) {
      throw new Error('Sales settings are not initialized');
    }

    const oldWorkflowMode = existing.workflowMode || 'OPERATIONAL';
    const newWorkflowMode = DocumentPolicyResolver.normalizeWorkflowMode(input.workflowMode ?? existing.workflowMode);

    // Guard: SIMPLE mode blocks if there are open commitments
    if (input.workflowMode === 'SIMPLE' && existing.workflowMode !== 'SIMPLE') {
      const hasOpenSO = await this.salesOrderRepo.hasOpenOrders(input.companyId);
      if (hasOpenSO) {
        throw new BusinessError(
          ErrorCode.SALES_TRANSITION_BLOCKED,
          'Cannot switch to Simple workflow while there are open Sales Orders. Please close or cancel all open orders first.'
        );
      }

      const hasUnpostedDN = await this.deliveryNoteRepo.hasUnpostedDeliveryNotes(input.companyId);
      if (hasUnpostedDN) {
        throw new BusinessError(
          ErrorCode.SALES_TRANSITION_BLOCKED,
          'Cannot switch to Simple workflow while there are draft or posted delivery notes. Please process or delete them first.'
        );
      }
    }

    const workflowDefaults = DocumentPolicyResolver.applySalesWorkflowDefaults(newWorkflowMode, {
      allowDirectInvoicing: input.allowDirectInvoicing ?? existing.allowDirectInvoicing,
      requireSOForStockItems: input.requireSOForStockItems ?? existing.requireSOForStockItems,
    });

    const nextAllowDirectInvoicing = workflowDefaults.allowDirectInvoicing;
    const nextARAccountId = input.defaultARAccountId ?? existing.defaultARAccountId;
    const nextARParentAccountId = input.arParentAccountId ?? existing.arParentAccountId;
    const nextPartyAccountCodeFormat = input.partyAccountCodeFormat ?? existing.partyAccountCodeFormat;
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

    if (nextARParentAccountId) {
      const parent = await this.accountRepo.getById(input.companyId, nextARParentAccountId);
      if (!parent) {
        throw new Error(`AR parent account not found: ${nextARParentAccountId}`);
      }
      if (parent.classification !== 'ASSET') {
        throw new Error(`AR parent account must be classified as ASSET (got ${parent.classification})`);
      }
    }
    const partyAccountCodeFormatError = validatePartyAccountCodeFormat(nextPartyAccountCodeFormat);
    if (partyAccountCodeFormatError) {
      throw new Error(partyAccountCodeFormatError);
    }

    const updated = new SalesSettings({
      companyId: existing.companyId,
      workflowMode: newWorkflowMode,
      showOperationalDocsInSimple:
        input.showOperationalDocsInSimple !== undefined
          ? input.showOperationalDocsInSimple === true
          : existing.showOperationalDocsInSimple,
      allowCreditOverride:
        input.allowCreditOverride !== undefined
          ? input.allowCreditOverride !== false
          : existing.allowCreditOverride,
      allowDirectInvoicing: nextAllowDirectInvoicing,
      requireSOForStockItems: workflowDefaults.requireSOForStockItems,
      defaultARAccountId: nextARAccountId,
      arParentAccountId: nextARParentAccountId,
      partyAccountCodeFormat: nextPartyAccountCodeFormat,
      defaultRevenueAccountId: nextRevenueAccountId,
      defaultCOGSAccountId: input.defaultCOGSAccountId ?? existing.defaultCOGSAccountId,
      defaultInventoryAccountId: nextDefaultInventoryAccountId,
      defaultSalesExpenseAccountId: input.defaultSalesExpenseAccountId ?? existing.defaultSalesExpenseAccountId,
      defaultSalesReturnAccountId: input.defaultSalesReturnAccountId ?? existing.defaultSalesReturnAccountId,
      defaultRefundAccountId: input.defaultRefundAccountId ?? existing.defaultRefundAccountId,
      restockingFeeAccountId: input.restockingFeeAccountId ?? existing.restockingFeeAccountId,
      allowOverDelivery: input.allowOverDelivery ?? existing.allowOverDelivery,
      allowOverpayment: input.allowOverpayment ?? existing.allowOverpayment,
      deriveLinePriceAcrossUom: input.deriveLinePriceAcrossUom ?? existing.deriveLinePriceAcrossUom,
      overDeliveryTolerancePct: input.overDeliveryTolerancePct ?? existing.overDeliveryTolerancePct,
      overInvoiceTolerancePct: input.overInvoiceTolerancePct ?? existing.overInvoiceTolerancePct,
      defaultPaymentTermsDays: input.defaultPaymentTermsDays ?? existing.defaultPaymentTermsDays,
      paymentMethodConfigs: input.paymentMethodConfigs ?? existing.paymentMethodConfigs,
      messagingAccounts: normalizeMessagingAccounts(
        input.messagingAccounts,
        existing.messagingAccounts,
        this.credentialCipher
      ),
      governanceRules: input.governanceRules ?? existing.governanceRules,
      defaultSalesInvoicePersona: input.defaultSalesInvoicePersona ?? existing.defaultSalesInvoicePersona,
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
