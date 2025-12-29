"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingPolicyRegistry = void 0;
const ApprovalRequiredPolicy_1 = require("../../../domain/accounting/policies/implementations/ApprovalRequiredPolicy");
const PeriodLockPolicy_1 = require("../../../domain/accounting/policies/implementations/PeriodLockPolicy");
const AccountAccessPolicy_1 = require("../../../domain/accounting/policies/implementations/AccountAccessPolicy");
/**
 * AccountingPolicyRegistry
 *
 * Application-layer component that wires enabled policies based on configuration.
 *
 * Responsibilities:
 * - Load policy config for a company
 * - Instantiate enabled policy implementations
 * - Return ordered list of policies to enforce
 *
 * This is pure composition/wiring - NO business logic here.
 * Business logic belongs in individual policy implementations.
 */
class AccountingPolicyRegistry {
    constructor(configProvider, userScopeProvider, accountLookup) {
        this.configProvider = configProvider;
        this.userScopeProvider = userScopeProvider;
        this.accountLookup = accountLookup;
    }
    /**
     * Get enabled policies for a company
     *
     * Returns policies in order of execution.
     * Policies are instantiated fresh each time to avoid stale config.
     *
     * @param companyId - Company identifier
     * @returns Array of enabled policy instances
     */
    async getEnabledPolicies(companyId) {
        var _a;
        const config = await this.configProvider.getConfig(companyId);
        const policies = [];
        // Wire policies based on config
        if (config.approvalRequired) {
            policies.push(new ApprovalRequiredPolicy_1.ApprovalRequiredPolicy());
        }
        if (config.periodLockEnabled) {
            policies.push(new PeriodLockPolicy_1.PeriodLockPolicy(config.lockedThroughDate));
        }
        if (config.accountAccessEnabled && this.userScopeProvider && this.accountLookup) {
            policies.push(new AccountAccessPolicy_1.AccountAccessPolicy(this.userScopeProvider, this.accountLookup));
        }
        if (((_a = config.costCenterPolicy) === null || _a === void 0 ? void 0 : _a.enabled) && this.accountLookup) {
            const { CostCenterRequiredPolicy } = await Promise.resolve().then(() => __importStar(require('../../../domain/accounting/policies/implementations/CostCenterRequiredPolicy')));
            policies.push(new CostCenterRequiredPolicy(config.costCenterPolicy.requiredFor, this.accountLookup));
        }
        return policies;
    }
    /**
     * Get raw config for a company (useful for debugging/reporting)
     */
    async getConfig(companyId) {
        return this.configProvider.getConfig(companyId);
    }
}
exports.AccountingPolicyRegistry = AccountingPolicyRegistry;
//# sourceMappingURL=AccountingPolicyRegistry.js.map