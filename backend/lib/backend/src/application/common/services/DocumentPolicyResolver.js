"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentPolicyResolver = void 0;
class DocumentPolicyResolver {
    static legacyInventoryMethodToAccountingMode(method) {
        return method === 'PERPETUAL' ? 'PERPETUAL' : 'INVOICE_DRIVEN';
    }
    static accountingModeToLegacyInventoryMethod(mode) {
        return mode === 'PERPETUAL' ? 'PERPETUAL' : 'PERIODIC';
    }
    static resolveAccountingMode(settings) {
        if (!settings)
            return 'INVOICE_DRIVEN';
        return settings.accountingMode
            || DocumentPolicyResolver.legacyInventoryMethodToAccountingMode(settings.inventoryAccountingMethod);
    }
    static resolveSalesWorkflowMode(settings) {
        return (settings === null || settings === void 0 ? void 0 : settings.workflowMode) || 'OPERATIONAL';
    }
    static resolvePurchaseWorkflowMode(settings) {
        return (settings === null || settings === void 0 ? void 0 : settings.workflowMode) || 'OPERATIONAL';
    }
    static shouldShowOperationalDocuments(workflowMode) {
        return workflowMode === 'OPERATIONAL';
    }
    static shouldPostDeliveryNoteAccounting(mode) {
        return mode === 'PERPETUAL';
    }
    static shouldPostGoodsReceiptAccounting(mode) {
        return mode === 'PERPETUAL';
    }
    static shouldInvoiceRecognizeInventory(mode, hasExistingOperationalPosting) {
        if (mode === 'INVOICE_DRIVEN')
            return true;
        return !hasExistingOperationalPosting;
    }
    static shouldSalesReturnReverseInventoryAccounting(mode, returnContext) {
        if (mode === 'PERPETUAL')
            return true;
        return returnContext === 'AFTER_INVOICE';
    }
    static shouldPurchaseReturnCreateVoucher(mode, returnContext) {
        if (returnContext === 'DIRECT' || returnContext === 'AFTER_INVOICE')
            return true;
        return mode === 'PERPETUAL';
    }
    static shouldPurchaseInvoiceClearGRNI(mode, hasExistingReceiptPosting) {
        return mode === 'PERPETUAL' && hasExistingReceiptPosting;
    }
    static normalizeWorkflowMode(mode) {
        return String(mode || '').toUpperCase() === 'SIMPLE' ? 'SIMPLE' : 'OPERATIONAL';
    }
    static enforceWorkflowAccountingCompatibility(workflowMode, accountingMode) {
        if (workflowMode === 'SIMPLE' && accountingMode === 'PERPETUAL') {
            throw new Error('Simple workflow is only supported with invoice-driven accounting.');
        }
    }
    static applySalesWorkflowDefaults(workflowMode, values) {
        if (workflowMode === 'SIMPLE') {
            return {
                allowDirectInvoicing: true,
                requireSOForStockItems: false,
            };
        }
        return values;
    }
    static applyPurchaseWorkflowDefaults(workflowMode, values) {
        if (workflowMode === 'SIMPLE') {
            return {
                allowDirectInvoicing: true,
                requirePOForStockItems: false,
            };
        }
        return values;
    }
}
exports.DocumentPolicyResolver = DocumentPolicyResolver;
//# sourceMappingURL=DocumentPolicyResolver.js.map