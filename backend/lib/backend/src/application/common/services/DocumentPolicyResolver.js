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
        return returnContext === 'AFTER_INVOICE' || returnContext === 'DIRECT';
    }
    static shouldRequirePositiveCostOnReturn(mode) {
        return mode === 'PERPETUAL';
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
        // Rigid block removed. Transition rules are now handled at the use-case level.
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
    static getBasePolicyForMode(workflowMode) {
        if (workflowMode === 'SIMPLE') {
            return { direct: true, linked: false, service: true };
        }
        return { direct: false, linked: true, service: true };
    }
    static getSalesInvoiceBasePolicy(settings) {
        const workflowMode = DocumentPolicyResolver.resolveSalesWorkflowMode(settings);
        const basePolicy = Object.assign({}, DocumentPolicyResolver.getBasePolicyForMode(workflowMode));
        if (settings.allowDirectInvoicing) {
            basePolicy.direct = true;
        }
        return basePolicy;
    }
    static isSalesInvoicePersonaAllowed(settings, persona) {
        var _a;
        const basePolicy = DocumentPolicyResolver.getSalesInvoiceBasePolicy(settings);
        let allowed = (_a = basePolicy[persona]) !== null && _a !== void 0 ? _a : false;
        for (const rule of settings.governanceRules || []) {
            if (rule.persona !== persona)
                continue;
            if (rule.scope === 'company') {
                allowed = rule.action === 'allow';
            }
        }
        return allowed;
    }
    static isPersonaAllowed(workflowMode, governanceRules, persona) {
        var _a;
        const basePolicy = DocumentPolicyResolver.getBasePolicyForMode(workflowMode);
        let allowed = (_a = basePolicy[persona]) !== null && _a !== void 0 ? _a : false;
        for (const rule of governanceRules) {
            if (rule.persona !== persona)
                continue;
            if (rule.scope === 'company') {
                allowed = rule.action === 'allow';
            }
        }
        return allowed;
    }
    static getPurchaseInvoiceBasePolicy(settings) {
        const workflowMode = DocumentPolicyResolver.resolvePurchaseWorkflowMode(settings);
        const basePolicy = Object.assign({}, DocumentPolicyResolver.getBasePolicyForMode(workflowMode));
        if (settings.allowDirectInvoicing) {
            basePolicy.direct = true;
        }
        return basePolicy;
    }
    static isPurchaseInvoicePersonaAllowed(settings, persona) {
        var _a;
        const basePolicy = DocumentPolicyResolver.getPurchaseInvoiceBasePolicy(settings);
        let allowed = (_a = basePolicy[persona]) !== null && _a !== void 0 ? _a : false;
        for (const rule of settings.governanceRules || []) {
            if (rule.persona !== persona)
                continue;
            if (rule.scope === 'company') {
                allowed = rule.action === 'allow';
            }
        }
        return allowed;
    }
}
exports.DocumentPolicyResolver = DocumentPolicyResolver;
//# sourceMappingURL=DocumentPolicyResolver.js.map