import { describe, expect, it } from '@jest/globals';
import { DocumentPolicyResolver } from '../DocumentPolicyResolver';
import { GovernanceRule } from '../../../../domain/sales/entities/SalesSettings';

describe('DocumentPolicyResolver', () => {
  it('maps legacy PERIODIC to PERIODIC', () => {
    expect(DocumentPolicyResolver.legacyInventoryMethodToAccountingMode('PERIODIC')).toBe('PERIODIC');
  });

  it('maps PERPETUAL accounting mode back to legacy PERPETUAL', () => {
    expect(DocumentPolicyResolver.accountingModeToLegacyInventoryMethod('PERPETUAL')).toBe('PERPETUAL');
  });

  it('does not block simple workflow with perpetual accounting (handled at use-case level)', () => {
    expect(() =>
      DocumentPolicyResolver.enforceWorkflowAccountingCompatibility('SIMPLE', 'PERPETUAL')
    ).not.toThrow();
  });

  it('allows invoice-driven sales invoice stock recognition even without delivery note', () => {
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('INVOICE_DRIVEN', false)).toBe(true);
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('INVOICE_DRIVEN', true)).toBe(true);
  });

  it('suppresses inventory recognition in periodic mode', () => {
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('PERIODIC', false)).toBe(false);
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('PERIODIC', true)).toBe(false);
    expect(DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting('PERIODIC', 'AFTER_INVOICE')).toBe(false);
    expect(DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting('PERIODIC', 'DIRECT')).toBe(false);
  });

  it('locks the supported workflow/accounting combinations as an explicit matrix', () => {
    const supportedModes = [
      {
        name: 'simple + periodic',
        workflowMode: 'SIMPLE' as const,
        accountingMode: 'PERIODIC' as const,
        showOperationalDocuments: false,
        postDeliveryNoteAccounting: false,
        postGoodsReceiptAccounting: false,
        invoiceRecognizesInventoryWithOperationalPosting: false,
        invoiceRecognizesInventoryStandalone: false,
      },
      {
        name: 'simple + invoice-driven',
        workflowMode: 'SIMPLE' as const,
        accountingMode: 'INVOICE_DRIVEN' as const,
        showOperationalDocuments: false,
        postDeliveryNoteAccounting: false,
        postGoodsReceiptAccounting: false,
        invoiceRecognizesInventoryWithOperationalPosting: true,
        invoiceRecognizesInventoryStandalone: true,
      },
      {
        name: 'operational + invoice-driven',
        workflowMode: 'OPERATIONAL' as const,
        accountingMode: 'INVOICE_DRIVEN' as const,
        showOperationalDocuments: true,
        postDeliveryNoteAccounting: false,
        postGoodsReceiptAccounting: false,
        invoiceRecognizesInventoryWithOperationalPosting: true,
        invoiceRecognizesInventoryStandalone: true,
      },
      {
        name: 'operational + perpetual',
        workflowMode: 'OPERATIONAL' as const,
        accountingMode: 'PERPETUAL' as const,
        showOperationalDocuments: true,
        postDeliveryNoteAccounting: true,
        postGoodsReceiptAccounting: true,
        invoiceRecognizesInventoryWithOperationalPosting: false,
        invoiceRecognizesInventoryStandalone: true,
      },
    ];

    for (const mode of supportedModes) {
      expect(() =>
        DocumentPolicyResolver.enforceWorkflowAccountingCompatibility(
          mode.workflowMode,
          mode.accountingMode
        )
      ).not.toThrow();

      expect(
        DocumentPolicyResolver.shouldShowOperationalDocuments(mode.workflowMode)
      ).toBe(mode.showOperationalDocuments);
      expect(
        DocumentPolicyResolver.shouldPostDeliveryNoteAccounting(mode.accountingMode)
      ).toBe(mode.postDeliveryNoteAccounting);
      expect(
        DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(mode.accountingMode)
      ).toBe(mode.postGoodsReceiptAccounting);
      expect(
        DocumentPolicyResolver.shouldInvoiceRecognizeInventory(mode.accountingMode, true)
      ).toBe(mode.invoiceRecognizesInventoryWithOperationalPosting);
      expect(
        DocumentPolicyResolver.shouldInvoiceRecognizeInventory(mode.accountingMode, false)
      ).toBe(mode.invoiceRecognizesInventoryStandalone);
    }
  });

  it('applies simple-workflow defaults that keep invoice-driven setup self-consistent', () => {
    expect(
      DocumentPolicyResolver.applySalesWorkflowDefaults('SIMPLE', {
        allowDirectInvoicing: false,
        requireSOForStockItems: true,
      })
    ).toEqual({
      allowDirectInvoicing: true,
      requireSOForStockItems: false,
    });

    expect(
      DocumentPolicyResolver.applyPurchaseWorkflowDefaults('SIMPLE', {
        allowDirectInvoicing: false,
        requirePOForStockItems: true,
      })
    ).toEqual({
      allowDirectInvoicing: true,
      requirePOForStockItems: false,
    });
  });

  it('keeps operational-workflow defaults unchanged', () => {
    expect(
      DocumentPolicyResolver.applySalesWorkflowDefaults('OPERATIONAL', {
        allowDirectInvoicing: false,
        requireSOForStockItems: true,
      })
    ).toEqual({
      allowDirectInvoicing: false,
      requireSOForStockItems: true,
    });

    expect(
      DocumentPolicyResolver.applyPurchaseWorkflowDefaults('OPERATIONAL', {
        allowDirectInvoicing: false,
        requirePOForStockItems: true,
      })
    ).toEqual({
      allowDirectInvoicing: false,
      requirePOForStockItems: true,
    });
  });

  // === Governance enforcement tests ===

  describe('Sales governance — base policy', () => {
    it('SIMPLE base policy allows direct and service, blocks linked', () => {
      const policy = DocumentPolicyResolver.getBasePolicyForMode('SIMPLE');
      expect(policy.direct).toBe(true);
      expect(policy.linked).toBe(false);
      expect(policy.service).toBe(true);
    });

    it('OPERATIONAL base policy blocks direct, allows linked and service', () => {
      const policy = DocumentPolicyResolver.getBasePolicyForMode('OPERATIONAL');
      expect(policy.direct).toBe(false);
      expect(policy.linked).toBe(true);
      expect(policy.service).toBe(true);
    });
  });

  describe('Sales governance — isSalesInvoicePersonaAllowed', () => {
    const makeSettings = (
      workflowMode: 'SIMPLE' | 'OPERATIONAL',
      governanceRules: GovernanceRule[] = [],
      allowDirectInvoicing = true
    ) => ({
      workflowMode,
      allowDirectInvoicing,
      governanceRules,
    });

    it('maps canonical document personas to legacy policy buckets for back compatibility', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'form', action: 'allow', persona: 'direct', formType: 'pos_sale' },
      ]);

      expect(DocumentPolicyResolver.toLegacySalesInvoicePersona('POS_DIRECT_SALE')).toBe('direct');
      expect(DocumentPolicyResolver.toCanonicalDocumentPersona('direct')).toBe('SALES_DIRECT_INVOICE');
      expect(DocumentPolicyResolver.toCanonicalDocumentPersona('service')).toBe('SERVICE');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'POS_DIRECT_SALE', { formType: 'pos_sale' })).toBe(true);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'POS_DIRECT_SALE')).toBe(false);
    });
    it('SIMPLE: direct is allowed by base policy', () => {
      const settings = makeSettings('SIMPLE');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(true);
    });

    it('OPERATIONAL: direct is blocked by base policy', () => {
      const settings = makeSettings('OPERATIONAL');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(false);
    });

    it('OPERATIONAL: linked is allowed by base policy', () => {
      const settings = makeSettings('OPERATIONAL');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'linked')).toBe(true);
    });

    it('OPERATIONAL: service is allowed by base policy', () => {
      const settings = makeSettings('OPERATIONAL');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'service')).toBe(true);
    });

    it('OPERATIONAL + company allow rule: direct is allowed', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'allow', persona: 'direct' },
      ]);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(true);
    });

    it('OPERATIONAL + company block rule: linked is blocked', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'block', persona: 'linked' },
      ]);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'linked')).toBe(false);
    });

    it('OPERATIONAL + branch allow rule: direct allowed only for matching branch', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'branch', action: 'allow', persona: 'direct', branchId: 'br-retail' },
      ]);
      // No context — base policy applies (direct blocked)
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(false);
      // Wrong branch — base policy applies
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { branchId: 'br-wholesale' })
      ).toBe(false);
      // Matching branch — direct allowed
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { branchId: 'br-retail' })
      ).toBe(true);
    });

    it('OPERATIONAL + form allow rule: direct allowed only for matching form', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'form', action: 'allow', persona: 'direct', formType: 'sales_invoice_direct' },
      ]);
      // No context — base policy applies
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(false);
      // Wrong form — base policy applies
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { formType: 'custom_invoice' })
      ).toBe(false);
      // Matching form — direct allowed
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { formType: 'sales_invoice_direct' })
      ).toBe(true);
    });

    it('precedence: form overrides branch overrides company overrides base', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'allow', persona: 'direct' },
        { id: 'r2', scope: 'branch', action: 'block', persona: 'direct', branchId: 'br-a' },
        { id: 'r3', scope: 'form', action: 'allow', persona: 'direct', formType: 'pos_invoice' },
      ]);

      // Company allows, but branch blocks for br-a
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { branchId: 'br-a' })
      ).toBe(false);

      // Company allows, no branch rule for br-b → company rule wins
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', { branchId: 'br-b' })
      ).toBe(true);

      // Form rule overrides branch block for pos_invoice on br-a
      expect(
        DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct', {
          branchId: 'br-a',
          formType: 'pos_invoice',
        })
      ).toBe(true);
    });

    it('service remains allowed in both modes unless explicitly blocked', () => {
      const simpleSettings = makeSettings('SIMPLE');
      const opSettings = makeSettings('OPERATIONAL');
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(simpleSettings, 'service')).toBe(true);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(opSettings, 'service')).toBe(true);

      // Explicit block
      const blockedSettings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'block', persona: 'service' },
      ]);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(blockedSettings, 'service')).toBe(false);
    });

    it('allowDirectInvoicing does NOT override OPERATIONAL base policy', () => {
      // This is the key governance change: allowDirectInvoicing should not
      // re-enable direct invoicing in OPERATIONAL mode.
      const settings = makeSettings('OPERATIONAL', [], true);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(false);
    });

    it('allowDirectInvoicing still works in SIMPLE mode for backward compatibility', () => {
      const settings = makeSettings('SIMPLE', [], true);
      expect(DocumentPolicyResolver.isSalesInvoicePersonaAllowed(settings, 'direct')).toBe(true);
    });
  });

  describe('Sales governance — resolveEffectiveSalesPersonaPolicy', () => {
    const makeSettings = (
      workflowMode: 'SIMPLE' | 'OPERATIONAL',
      governanceRules: GovernanceRule[] = []
    ) => ({
      workflowMode,
      allowDirectInvoicing: true,
      governanceRules,
    });

    it('returns base policy with no rules', () => {
      const settings = makeSettings('OPERATIONAL');
      const result = DocumentPolicyResolver.resolveEffectiveSalesPersonaPolicy(settings);
      expect(result.policy).toEqual({ direct: false, linked: true, service: true });
      expect(result.resolvedBy).toEqual({ direct: 'base', linked: 'base', service: 'base' });
    });

    it('returns company as source when company rule applies', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'allow', persona: 'direct' },
      ]);
      const result = DocumentPolicyResolver.resolveEffectiveSalesPersonaPolicy(settings);
      expect(result.policy.direct).toBe(true);
      expect(result.resolvedBy.direct).toBe('company');
    });

    it('returns branch as source when branch rule applies', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'branch', action: 'allow', persona: 'direct', branchId: 'br-retail' },
      ]);
      const result = DocumentPolicyResolver.resolveEffectiveSalesPersonaPolicy(settings, {
        branchId: 'br-retail',
      });
      expect(result.policy.direct).toBe(true);
      expect(result.resolvedBy.direct).toBe('branch');
    });

    it('returns form as source when form rule applies', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'form', action: 'allow', persona: 'direct', formType: 'pos_invoice' },
      ]);
      const result = DocumentPolicyResolver.resolveEffectiveSalesPersonaPolicy(settings, {
        formType: 'pos_invoice',
      });
      expect(result.policy.direct).toBe(true);
      expect(result.resolvedBy.direct).toBe('form');
    });
  });

  describe('Purchase governance — isPurchaseInvoicePersonaAllowed', () => {
    const makeSettings = (
      workflowMode: 'SIMPLE' | 'OPERATIONAL',
      governanceRules: GovernanceRule[] = [],
      allowDirectInvoicing = true
    ) => ({
      workflowMode,
      allowDirectInvoicing,
      governanceRules,
    });

    it('OPERATIONAL: direct is blocked by base policy', () => {
      const settings = makeSettings('OPERATIONAL');
      expect(DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, 'direct')).toBe(false);
    });

    it('OPERATIONAL + company allow rule: direct is allowed', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'company', action: 'allow', persona: 'direct' },
      ]);
      expect(DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, 'direct')).toBe(true);
    });

    it('OPERATIONAL + branch allow rule: direct allowed only for matching branch', () => {
      const settings = makeSettings('OPERATIONAL', [
        { id: 'r1', scope: 'branch', action: 'allow', persona: 'direct', branchId: 'br-wh' },
      ]);
      expect(DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, 'direct')).toBe(false);
      expect(
        DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, 'direct', { branchId: 'br-wh' })
      ).toBe(true);
    });

    it('allowDirectInvoicing does NOT override OPERATIONAL base policy for purchases', () => {
      const settings = makeSettings('OPERATIONAL', [], true);
      expect(DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, 'direct')).toBe(false);
    });
  });
});
