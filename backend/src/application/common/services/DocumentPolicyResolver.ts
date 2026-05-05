import {
  InventoryAccountingMode,
  InventorySettings,
  LegacyInventoryAccountingMethod,
} from '../../../domain/inventory/entities/InventorySettings';
import { PurchaseSettings, WorkflowMode } from '../../../domain/purchases/entities/PurchaseSettings';
import { SalesSettings, GovernanceRule } from '../../../domain/sales/entities/SalesSettings';

export type SupportedAccountingMode = InventoryAccountingMode;
export type SupportedWorkflowMode = WorkflowMode;

export class DocumentPolicyResolver {
  static legacyInventoryMethodToAccountingMode(
    method: LegacyInventoryAccountingMethod | undefined | null
  ): SupportedAccountingMode {
    return method === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN';
  }

  static accountingModeToLegacyInventoryMethod(
    mode: SupportedAccountingMode | undefined | null
  ): LegacyInventoryAccountingMethod {
    return mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC';
  }

  static resolveAccountingMode(
    settings: Pick<InventorySettings, 'accountingMode' | 'inventoryAccountingMethod'> | null | undefined
  ): SupportedAccountingMode {
    if (!settings) return 'INVOICE_DRIVEN';
    return settings.accountingMode
      || DocumentPolicyResolver.legacyInventoryMethodToAccountingMode(settings.inventoryAccountingMethod);
  }

  static resolveSalesWorkflowMode(
    settings: Pick<SalesSettings, 'workflowMode'> | null | undefined
  ): SupportedWorkflowMode {
    return settings?.workflowMode || 'OPERATIONAL';
  }

  static resolvePurchaseWorkflowMode(
    settings: Pick<PurchaseSettings, 'workflowMode'> | null | undefined
  ): SupportedWorkflowMode {
    return settings?.workflowMode || 'OPERATIONAL';
  }

  static shouldShowOperationalDocuments(workflowMode: SupportedWorkflowMode): boolean {
    return workflowMode === 'OPERATIONAL';
  }

  static shouldPostDeliveryNoteAccounting(mode: SupportedAccountingMode): boolean {
    return mode === 'PERPETUAL';
  }

  static shouldPostGoodsReceiptAccounting(mode: SupportedAccountingMode): boolean {
    return mode === 'PERPETUAL';
  }

  static shouldInvoiceRecognizeInventory(
    mode: SupportedAccountingMode,
    hasExistingOperationalPosting: boolean
  ): boolean {
    if (mode === 'INVOICE_DRIVEN') return true;
    return !hasExistingOperationalPosting;
  }

  static shouldSalesReturnReverseInventoryAccounting(
    mode: SupportedAccountingMode,
    returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT'
  ): boolean {
    if (mode === 'PERPETUAL') return true;
    return returnContext === 'AFTER_INVOICE' || returnContext === 'DIRECT';
  }

  static shouldRequirePositiveCostOnReturn(
    mode: SupportedAccountingMode
  ): boolean {
    return mode === 'PERPETUAL';
  }

  static shouldPurchaseReturnCreateVoucher(
    mode: SupportedAccountingMode,
    returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT'
  ): boolean {
    if (returnContext === 'DIRECT' || returnContext === 'AFTER_INVOICE') return true;
    return mode === 'PERPETUAL';
  }

  static shouldPurchaseInvoiceClearGRNI(
    mode: SupportedAccountingMode,
    hasExistingReceiptPosting: boolean
  ): boolean {
    return mode === 'PERPETUAL' && hasExistingReceiptPosting;
  }

  static normalizeWorkflowMode(mode: string | undefined | null): SupportedWorkflowMode {
    return String(mode || '').toUpperCase() === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL';
  }

  static enforceWorkflowAccountingCompatibility(
    workflowMode: SupportedWorkflowMode,
    accountingMode: SupportedAccountingMode
  ): void {
    // Rigid block removed. Transition rules are now handled at the use-case level.
  }

  static applySalesWorkflowDefaults(
    workflowMode: SupportedWorkflowMode,
    values: Pick<SalesSettings, 'allowDirectInvoicing' | 'requireSOForStockItems'>
  ): Pick<SalesSettings, 'allowDirectInvoicing' | 'requireSOForStockItems'> {
    if (workflowMode === 'SIMPLE') {
      return {
        allowDirectInvoicing: true,
        requireSOForStockItems: false,
      };
    }

    return values;
  }

  static applyPurchaseWorkflowDefaults(
    workflowMode: SupportedWorkflowMode,
    values: Pick<PurchaseSettings, 'allowDirectInvoicing' | 'requirePOForStockItems'>
  ): Pick<PurchaseSettings, 'allowDirectInvoicing' | 'requirePOForStockItems'> {
    if (workflowMode === 'SIMPLE') {
      return {
        allowDirectInvoicing: true,
        requirePOForStockItems: false,
      };
    }

    return values;
  }

  static getBasePolicyForMode(workflowMode: SupportedWorkflowMode): Record<'direct' | 'linked' | 'service', boolean> {
    if (workflowMode === 'SIMPLE') {
      return { direct: true, linked: false, service: true };
    }
    return { direct: false, linked: true, service: true };
  }

  static getSalesInvoiceBasePolicy(
    settings: Pick<SalesSettings, 'workflowMode' | 'allowDirectInvoicing'>
  ): Record<'direct' | 'linked' | 'service', boolean> {
    const workflowMode = DocumentPolicyResolver.resolveSalesWorkflowMode(settings);
    const basePolicy = {
      ...DocumentPolicyResolver.getBasePolicyForMode(workflowMode),
    };

    if (settings.allowDirectInvoicing) {
      basePolicy.direct = true;
    }

    return basePolicy;
  }

  static isSalesInvoicePersonaAllowed(
    settings: Pick<SalesSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    persona: 'direct' | 'linked' | 'service'
  ): boolean {
    const basePolicy = DocumentPolicyResolver.getSalesInvoiceBasePolicy(settings);
    let allowed = basePolicy[persona] ?? false;

    for (const rule of settings.governanceRules || []) {
      if (rule.persona !== persona) continue;
      if (rule.scope === 'company') {
        allowed = rule.action === 'allow';
      }
    }

    return allowed;
  }

  static isPersonaAllowed(
    workflowMode: SupportedWorkflowMode,
    governanceRules: GovernanceRule[],
    persona: 'direct' | 'linked' | 'service'
  ): boolean {
    const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
    let allowed = basePolicy[persona] ?? false;
    
    for (const rule of governanceRules) {
      if (rule.persona !== persona) continue;
      if (rule.scope === 'company') {
        allowed = rule.action === 'allow';
      }
    }

    return allowed;
  }

  static getPurchaseInvoiceBasePolicy(
    settings: Pick<PurchaseSettings, 'workflowMode' | 'allowDirectInvoicing'>
  ): Record<'direct' | 'linked' | 'service', boolean> {
    const workflowMode = DocumentPolicyResolver.resolvePurchaseWorkflowMode(settings);
    const basePolicy = {
      ...DocumentPolicyResolver.getBasePolicyForMode(workflowMode),
    };

    if (settings.allowDirectInvoicing) {
      basePolicy.direct = true;
    }

    return basePolicy;
  }

  static isPurchaseInvoicePersonaAllowed(
    settings: Pick<PurchaseSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    persona: 'direct' | 'linked' | 'service'
  ): boolean {
    const basePolicy = DocumentPolicyResolver.getPurchaseInvoiceBasePolicy(settings);
    let allowed = basePolicy[persona] ?? false;

    for (const rule of settings.governanceRules || []) {
      if (rule.persona !== persona) continue;
      if (rule.scope === 'company') {
        allowed = rule.action === 'allow';
      }
    }

    return allowed;
  }
}
