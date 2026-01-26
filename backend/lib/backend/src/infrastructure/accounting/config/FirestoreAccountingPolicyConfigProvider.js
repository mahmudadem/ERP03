"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAccountingPolicyConfigProvider = void 0;
/**
 * FirestoreAccountingPolicyConfigProvider
 *
 * Loads accounting policy configuration from Firestore.
 *
 * Storage location: companies/{companyId}/settings/accounting
 *
 * This provider returns sensible defaults if config doesn't exist,
 * ensuring the system works even for new companies.
 */
class FirestoreAccountingPolicyConfigProvider {
    constructor(settingsResolver) {
        this.settingsResolver = settingsResolver;
        this.COLLECTION_PATH = 'companies';
        this.SETTINGS_DOC = 'settings';
        this.ACCOUNTING_FIELD = 'accounting';
    }
    async getConfig(companyId) {
        try {
            const settingsRef = this.settingsResolver.getAccountingSettingsRef(companyId);
            const path = settingsRef.path;
            console.log('[PolicyConfigProvider] Reading from path:', path);
            const snapshot = await settingsRef.get();
            console.log('[PolicyConfigProvider] Document exists:', snapshot.exists);
            if (!snapshot.exists) {
                console.log('[PolicyConfigProvider] Returning default config (document not found)');
                // Return default config (all policies disabled)
                return this.getDefaultConfig();
            }
            const data = snapshot.data();
            console.log('[PolicyConfigProvider] Raw data:', JSON.stringify(data, null, 2));
            if (!data) {
                return this.getDefaultConfig();
            }
            // Merge with defaults to handle missing fields and ensure structural integrity
            const merged = Object.assign(Object.assign(Object.assign({}, this.getDefaultConfig()), data), { 
                // Override nested objects specifically if they exist to avoid partial merges
                costCenterPolicy: Object.assign(Object.assign({}, (this.getDefaultConfig().costCenterPolicy)), (data.costCenterPolicy || {})) });
            console.log('[PolicyConfigProvider] Merged config:', JSON.stringify(merged, null, 2));
            return merged;
        }
        catch (error) {
            console.error(`Failed to load policy config for company ${companyId}:`, error);
            // Fail safe: return default config
            return this.getDefaultConfig();
        }
    }
    getDefaultConfig() {
        return {
            // Approval Policy V1 - all gates OFF by default (Mode A: Auto-Post)
            financialApprovalEnabled: false,
            faApplyMode: 'ALL',
            custodyConfirmationEnabled: false,
            approvalRequired: false,
            // Mode A Controls (V1)
            autoPostEnabled: true,
            // Period Lock
            periodLockEnabled: false,
            lockedThroughDate: undefined,
            accountAccessEnabled: false,
            costCenterPolicy: {
                enabled: false,
                requiredFor: {}
            },
            policyErrorMode: 'FAIL_FAST',
            paymentMethods: [
                { id: 'bank_transfer', name: 'Bank Transfer', isEnabled: true },
                { id: 'cash', name: 'Cash', isEnabled: true },
                { id: 'check', name: 'Check', isEnabled: true }
            ]
        };
    }
}
exports.FirestoreAccountingPolicyConfigProvider = FirestoreAccountingPolicyConfigProvider;
//# sourceMappingURL=FirestoreAccountingPolicyConfigProvider.js.map