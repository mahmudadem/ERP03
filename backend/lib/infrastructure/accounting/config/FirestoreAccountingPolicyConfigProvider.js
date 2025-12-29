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
        var _a, _b, _c;
        try {
            const settingsRef = this.db
                .collection(this.COLLECTION_PATH)
                .doc(companyId)
                .collection(this.SETTINGS_DOC)
                .doc(this.ACCOUNTING_FIELD);
            const snapshot = await settingsRef.get();
            if (!snapshot.exists) {
                // Return default config (all policies disabled)
                return this.getDefaultConfig();
            }
            const data = snapshot.data();
            if (!data) {
                return this.getDefaultConfig();
            }
            // Merge with defaults to handle missing fields
            return {
                approvalRequired: (_a = data.approvalRequired) !== null && _a !== void 0 ? _a : false,
                periodLockEnabled: (_b = data.periodLockEnabled) !== null && _b !== void 0 ? _b : false,
                lockedThroughDate: data.lockedThroughDate,
                accountAccessEnabled: (_c = data.accountAccessEnabled) !== null && _c !== void 0 ? _c : false
            };
        }
        catch (error) {
            console.error(`Failed to load policy config for company ${companyId}:`, error);
            // Fail safe: return default config
            return this.getDefaultConfig();
        }
    }
    getDefaultConfig() {
        return {
            approvalRequired: false,
            periodLockEnabled: false,
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
