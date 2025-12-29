"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostCenterRequiredPolicy = void 0;
/**
 * CostCenterRequiredPolicy
 *
 * Enforces analytical discipline by requiring cost center assignment
 * on specific posting lines.
 *
 * This is an ANALYTICAL/GOVERNANCE policy, NOT an accounting correctness policy.
 * It validates PRESENCE only, not amounts or balances.
 *
 * When enabled:
 * - Checks each posting line
 * - If line's account matches configured rules (accountIds or accountTypes)
 * - costCenterId must be present (non-null, non-empty)
 *
 * Config format:
 * - requiredFor.accountIds: ["acc-1", "acc-2"]
 * - requiredFor.accountTypes: ["expense"]
 *
 * Disabled by default (simple-by-default principle).
 */
class CostCenterRequiredPolicy {
    constructor(requiredFor, accountLookup) {
        this.requiredFor = requiredFor;
        this.accountLookup = accountLookup;
        this.id = 'cost-center-required';
        this.name = 'Cost Center Required';
    }
    async validate(ctx) {
        var _a, _b, _c, _d;
        // No rules configured → policy passes
        if (!((_a = this.requiredFor.accountIds) === null || _a === void 0 ? void 0 : _a.length) && !((_b = this.requiredFor.accountTypes) === null || _b === void 0 ? void 0 : _b.length)) {
            return { ok: true };
        }
        // Extract all account IDs from posting lines
        const accountIds = ctx.lines.map(line => line.accountId);
        // Bulk load account metadata (avoid N+1 queries)
        const accountMap = await this.accountLookup.getAccountsByIds(ctx.companyId, accountIds);
        // Check each line for cost center requirement
        for (let i = 0; i < ctx.lines.length; i++) {
            const line = ctx.lines[i];
            const account = accountMap.get(line.accountId);
            if (!account) {
                // Account not found - skip (let core validation handle missing accounts)
                continue;
            }
            // Check if line matches rules
            const matchesAccountId = (_c = this.requiredFor.accountIds) === null || _c === void 0 ? void 0 : _c.includes(line.accountId);
            const matchesAccountType = (_d = this.requiredFor.accountTypes) === null || _d === void 0 ? void 0 : _d.includes(account.type);
            if (matchesAccountId || matchesAccountType) {
                // Cost center is required for this line
                if (!line.costCenterId || line.costCenterId.trim() === '') {
                    return {
                        ok: false,
                        error: {
                            code: 'COST_CENTER_REQUIRED',
                            message: `Cost center is required for account "${account.name}" (${account.code || account.id})`,
                            fieldHints: [`lines[${i}].costCenterId`]
                        }
                    };
                }
            }
        }
        return { ok: true };
    }
}
exports.CostCenterRequiredPolicy = CostCenterRequiredPolicy;
//# sourceMappingURL=CostCenterRequiredPolicy.js.map