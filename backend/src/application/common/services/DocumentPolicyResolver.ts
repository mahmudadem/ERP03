import {
  InventoryAccountingMode,
  InventorySettings,
  LegacyInventoryAccountingMethod,
} from '../../../domain/inventory/entities/InventorySettings';
import { PurchaseSettings, WorkflowMode } from '../../../domain/purchases/entities/PurchaseSettings';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';

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
    returnContext: 'AFTER_INVOICE' | 'BEFORE_INVOICE'
  ): boolean {
    if (mode === 'PERPETUAL') return true;
    return returnContext === 'AFTER_INVOICE';
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
    if (workflowMode === 'SIMPLE' && accountingMode === 'PERPETUAL') {
      throw new Error('Simple workflow is only supported with invoice-driven accounting.');
    }
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
}
