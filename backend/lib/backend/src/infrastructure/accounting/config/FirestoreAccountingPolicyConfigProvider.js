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
    constructor(db) {
        this.db = db;
        this.COLLECTION_PATH = 'companies';
        this.SETTINGS_DOC = 'settings';
        this.ACCOUNTING_FIELD = 'accounting';
    }
    async getConfig(companyId) {
        try {
            const path = `${this.COLLECTION_PATH}/${companyId}/${this.SETTINGS_DOC}/${this.ACCOUNTING_FIELD}`;
            console.log('[PolicyConfigProvider] Reading from path:', path);
            const settingsRef = this.db
                .collection(this.COLLECTION_PATH)
                .doc(companyId)
                .collection(this.SETTINGS_DOC)
                .doc(this.ACCOUNTING_FIELD);
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
            policyErrorMode: 'FAIL_FAST'
        };
    }
}
exports.FirestoreAccountingPolicyConfigProvider = FirestoreAccountingPolicyConfigProvider;
//# sourceMappingURL=FirestoreAccountingPolicyConfigProvider.js.map