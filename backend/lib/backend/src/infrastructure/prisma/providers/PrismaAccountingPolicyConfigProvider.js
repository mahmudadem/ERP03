"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAccountingPolicyConfigProvider = void 0;
class PrismaAccountingPolicyConfigProvider {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getConfig(companyId) {
        try {
            const settings = await this.prisma.companyModuleSettings.findUnique({
                where: { companyId_moduleId: { companyId, moduleId: 'accounting' } },
            });
            console.log('[PolicyConfigProvider] Document exists:', !!settings);
            if (!settings) {
                console.log('[PolicyConfigProvider] Returning default config (document not found)');
                return this.getDefaultConfig();
            }
            const data = settings.settings;
            console.log('[PolicyConfigProvider] Raw data:', JSON.stringify(data, null, 2));
            if (!data) {
                return this.getDefaultConfig();
            }
            // Merge with defaults to handle missing fields and ensure structural integrity
            const merged = Object.assign(Object.assign(Object.assign({}, this.getDefaultConfig()), data), { 
                // Override nested objects specifically if they exist to avoid partial merges
                costCenterPolicy: Object.assign(Object.assign({}, (this.getDefaultConfig().costCenterPolicy)), (data.costCenterPolicy || {})) });
            // Backward compat: map legacy key to canonical key when canonical is absent.
            if (merged.allowEditPostedVouchersEnabled !== undefined && merged.allowEditDeletePosted === undefined) {
                merged.allowEditDeletePosted = merged.allowEditPostedVouchersEnabled;
            }
            // CRITICAL: approval is required when either financial approval or custody confirmation is enabled.
            merged.approvalRequired = !!(merged.financialApprovalEnabled || merged.custodyConfirmationEnabled);
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
            // Derived: true if ANY gate (financial approval or custody confirmation) is enabled.
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
exports.PrismaAccountingPolicyConfigProvider = PrismaAccountingPolicyConfigProvider;
//# sourceMappingURL=PrismaAccountingPolicyConfigProvider.js.map