import { describe, expect, it } from '@jest/globals';
import { DocumentPolicyResolver } from '../DocumentPolicyResolver';

describe('DocumentPolicyResolver', () => {
  it('maps legacy PERIODIC to INVOICE_DRIVEN', () => {
    expect(DocumentPolicyResolver.legacyInventoryMethodToAccountingMode('PERIODIC')).toBe('INVOICE_DRIVEN');
  });

  it('maps PERPETUAL accounting mode back to legacy PERPETUAL', () => {
    expect(DocumentPolicyResolver.accountingModeToLegacyInventoryMethod('PERPETUAL')).toBe('PERPETUAL');
  });

  it('blocks simple workflow with perpetual accounting', () => {
    expect(() =>
      DocumentPolicyResolver.enforceWorkflowAccountingCompatibility('SIMPLE', 'PERPETUAL')
    ).toThrow(/invoice-driven/i);
  });

  it('allows invoice-driven sales invoice stock recognition even without delivery note', () => {
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('INVOICE_DRIVEN', false)).toBe(true);
    expect(DocumentPolicyResolver.shouldInvoiceRecognizeInventory('INVOICE_DRIVEN', true)).toBe(true);
  });

  it('locks the supported workflow/accounting combinations as an explicit matrix', () => {
    const supportedModes = [
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
});
