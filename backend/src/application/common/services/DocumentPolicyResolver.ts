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
    if (method === 'PERPETUAL') return 'PERPETUAL';
    if (method === 'PERIODIC') return 'PERIODIC';
    return 'INVOICE_DRIVEN';
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
    if (mode === 'PERIODIC') return false;
    if (mode === 'INVOICE_DRIVEN') return true;
    return !hasExistingOperationalPosting;
  }

  static shouldSalesReturnReverseInventoryAccounting(
    mode: SupportedAccountingMode,
    returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE' | 'DIRECT'
  ): boolean {
    if (mode === 'PERIODIC') return false;
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

    // allowDirectInvoicing is deprecated as a broad override for OPERATIONAL.
    // It is preserved only for backward compatibility in SIMPLE mode where it
    // was historically the primary toggle. In OPERATIONAL mode, governance rules
    // are the only valid way to re-enable direct invoicing.
    if (workflowMode === 'SIMPLE' && settings.allowDirectInvoicing) {
      basePolicy.direct = true;
    }

    return basePolicy;
  }

  /**
   * Governance-aware persona resolution with full precedence chain.
   *
   * Precedence (most specific wins):
   *   1. form-specific rule (matching formType)
   *   2. branch-specific rule (matching branchId)
   *   3. company-scope rule
   *   4. base workflow mode default
   *
   * If no matching rule exists at a given level, falls through to the next
   * less specific level. If multiple rules exist at the same specificity,
   * the last one in array order wins (stored-order convention).
   */
  static isSalesInvoicePersonaAllowed(
    settings: Pick<SalesSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    persona: 'direct' | 'linked' | 'service',
    context?: { branchId?: string; formType?: string }
  ): boolean {
    const workflowMode = DocumentPolicyResolver.resolveSalesWorkflowMode(settings);
    const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
    let allowed = basePolicy[persona] ?? false;

    const rules = settings.governanceRules || [];

    // Level 1: company-scope rules
    for (const rule of rules) {
      if (rule.persona !== persona) continue;
      if (rule.scope === 'company') {
        allowed = rule.action === 'allow';
      }
    }

    // Level 2: branch-scope rules (only if branchId is provided)
    if (context?.branchId) {
      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'branch' && rule.branchId === context.branchId) {
          allowed = rule.action === 'allow';
        }
      }
    }

    // Level 3: form-scope rules (only if formType is provided)
    if (context?.formType) {
      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'form' && rule.formType === context.formType) {
          allowed = rule.action === 'allow';
        }
      }
    }

    return allowed;
  }

  /**
   * Returns the full resolved policy for all personas, plus metadata about
   * which rule determined each decision. Useful for UI rendering and debugging.
   */
  static resolveEffectiveSalesPersonaPolicy(
    settings: Pick<SalesSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    context?: { branchId?: string; formType?: string }
  ): {
    policy: Record<'direct' | 'linked' | 'service', boolean>;
    resolvedBy: Record<'direct' | 'linked' | 'service', 'base' | 'company' | 'branch' | 'form'>;
  } {
    const workflowMode = DocumentPolicyResolver.resolveSalesWorkflowMode(settings);
    const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
    const rules = settings.governanceRules || [];
    const personas: Array<'direct' | 'linked' | 'service'> = ['direct', 'linked', 'service'];

    const policy: Record<string, boolean> = {};
    const resolvedBy: Record<string, 'base' | 'company' | 'branch' | 'form'> = {};

    for (const persona of personas) {
      let allowed = basePolicy[persona] ?? false;
      let source: 'base' | 'company' | 'branch' | 'form' = 'base';

      // Company-scope rules
      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'company') {
          allowed = rule.action === 'allow';
          source = 'company';
        }
      }

      // Branch-scope rules
      if (context?.branchId) {
        for (const rule of rules) {
          if (rule.persona !== persona) continue;
          if (rule.scope === 'branch' && rule.branchId === context.branchId) {
            allowed = rule.action === 'allow';
            source = 'branch';
          }
        }
      }

      // Form-scope rules
      if (context?.formType) {
        for (const rule of rules) {
          if (rule.persona !== persona) continue;
          if (rule.scope === 'form' && rule.formType === context.formType) {
            allowed = rule.action === 'allow';
            source = 'form';
          }
        }
      }

      policy[persona] = allowed;
      resolvedBy[persona] = source;
    }

    return {
      policy: policy as Record<'direct' | 'linked' | 'service', boolean>,
      resolvedBy: resolvedBy as Record<'direct' | 'linked' | 'service', 'base' | 'company' | 'branch' | 'form'>,
    };
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

    // allowDirectInvoicing is deprecated as a broad override for OPERATIONAL.
    // Preserved only for backward compatibility in SIMPLE mode.
    if (workflowMode === 'SIMPLE' && settings.allowDirectInvoicing) {
      basePolicy.direct = true;
    }

    return basePolicy;
  }

  static isPurchaseInvoicePersonaAllowed(
    settings: Pick<PurchaseSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    persona: 'direct' | 'linked' | 'service',
    context?: { branchId?: string; formType?: string }
  ): boolean {
    const workflowMode = DocumentPolicyResolver.resolvePurchaseWorkflowMode(settings);
    const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
    let allowed = basePolicy[persona] ?? false;

    const rules = settings.governanceRules || [];

    // Level 1: company-scope rules
    for (const rule of rules) {
      if (rule.persona !== persona) continue;
      if (rule.scope === 'company') {
        allowed = rule.action === 'allow';
      }
    }

    // Level 2: branch-scope rules
    if (context?.branchId) {
      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'branch' && rule.branchId === context.branchId) {
          allowed = rule.action === 'allow';
        }
      }
    }

    // Level 3: form-scope rules
    if (context?.formType) {
      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'form' && rule.formType === context.formType) {
          allowed = rule.action === 'allow';
        }
      }
    }

    return allowed;
  }

  static resolveEffectivePurchasePersonaPolicy(
    settings: Pick<PurchaseSettings, 'workflowMode' | 'allowDirectInvoicing' | 'governanceRules'>,
    context?: { branchId?: string; formType?: string }
  ): {
    policy: Record<'direct' | 'linked' | 'service', boolean>;
    resolvedBy: Record<'direct' | 'linked' | 'service', 'base' | 'company' | 'branch' | 'form'>;
  } {
    const workflowMode = DocumentPolicyResolver.resolvePurchaseWorkflowMode(settings);
    const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
    const rules = settings.governanceRules || [];
    const personas: Array<'direct' | 'linked' | 'service'> = ['direct', 'linked', 'service'];

    const policy: Record<string, boolean> = {};
    const resolvedBy: Record<string, 'base' | 'company' | 'branch' | 'form'> = {};

    for (const persona of personas) {
      let allowed = basePolicy[persona] ?? false;
      let source: 'base' | 'company' | 'branch' | 'form' = 'base';

      for (const rule of rules) {
        if (rule.persona !== persona) continue;
        if (rule.scope === 'company') {
          allowed = rule.action === 'allow';
          source = 'company';
        }
      }

      if (context?.branchId) {
        for (const rule of rules) {
          if (rule.persona !== persona) continue;
          if (rule.scope === 'branch' && rule.branchId === context.branchId) {
            allowed = rule.action === 'allow';
            source = 'branch';
          }
        }
      }

      if (context?.formType) {
        for (const rule of rules) {
          if (rule.persona !== persona) continue;
          if (rule.scope === 'form' && rule.formType === context.formType) {
            allowed = rule.action === 'allow';
            source = 'form';
          }
        }
      }

      policy[persona] = allowed;
      resolvedBy[persona] = source;
    }

    return {
      policy: policy as Record<'direct' | 'linked' | 'service', boolean>,
      resolvedBy: resolvedBy as Record<'direct' | 'linked' | 'service', 'base' | 'company' | 'branch' | 'form'>,
    };
  }
}
