"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountAccessPolicy = void 0;
/**
 * AccountAccessPolicy
 *
 * Prevents users from posting to accounts outside their allowed scope.
 * Operational safety + governance layer, not accounting calculation.
 *
 * Access Model:
 * - Accounts have ownerUnitIds (e.g., ["branch-a"]) and ownerScope ("shared" | "restricted")
 * - Users have allowedUnitIds (e.g., ["branch-a"]) and optional isSuper flag
 *
 * Access Rules:
 * - ownerScope = "shared" → ALLOW (accessible to all)
 * - ownerScope = "restricted" or has ownerUnitIds:
 *   - If user.isSuper → ALLOW (admin override)
 *   - Else if user has ANY matching unitId → ALLOW
 *   - Else → DENY
 * - No metadata (default) → treated as "shared" → ALLOW
 *
 * This policy does NOT:
 * - Modify amounts or lines
 * - Create separate ledgers
 * - Affect accounting calculations
 */
class AccountAccessPolicy {
    constructor(userScopeProvider, accountLookup) {
        this.userScopeProvider = userScopeProvider;
        this.accountLookup = accountLookup;
        this.id = 'account-access';
        this.name = 'Account Access Control';
    }
    async validate(ctx) {
        var _a;
        // 1. Load user access scope
        const userScope = await this.userScopeProvider.getScope(ctx.userId, ctx.companyId);
        // Super users bypass all restrictions
        if (userScope.isSuper) {
            return { ok: true };
        }
        // 2. Extract unique account IDs from voucher lines
        const accountIds = Array.from(new Set(ctx.lines.map(line => line.accountId)));
        // 3. Bulk load accounts
        const accounts = await this.accountLookup.getAccountsByIds(ctx.companyId, accountIds);
        // 4. Validate each line's account
        for (let i = 0; i < ctx.lines.length; i++) {
            const line = ctx.lines[i];
            const account = accounts.get(line.accountId);
            // Account not found - let core validation handle this
            if (!account) {
                continue;
            }
            // Check access
            const accessDenied = this.isAccessDenied(account, userScope.allowedUnitIds);
            if (accessDenied) {
                return {
                    ok: false,
                    error: {
                        code: 'ACCOUNT_ACCESS_DENIED',
                        message: `Access denied to account "${account.name}" (${account.code}). ` +
                            `Account restricted to units: ${((_a = account.ownerUnitIds) === null || _a === void 0 ? void 0 : _a.join(', ')) || 'unknown'}. ` +
                            `User has access to: ${userScope.allowedUnitIds.join(', ') || 'none'}.`,
                        fieldHints: [`lines[${i}].accountId`, `accountId:${account.id}`]
                    }
                };
            }
        }
        return { ok: true };
    }
    /**
     * Check if user access is denied for an account
     */
    isAccessDenied(account, userUnitIds) {
        // Default to shared if no metadata
        const scope = account.ownerScope || 'shared';
        // Shared accounts are accessible to all
        if (scope === 'shared') {
            return false;
        }
        // Restricted accounts require matching unit
        if (scope === 'restricted' || account.ownerUnitIds) {
            const accountUnits = account.ownerUnitIds || [];
            // No owner units specified but marked restricted = deny all
            if (accountUnits.length === 0) {
                return true;
            }
            // Check if user has any matching unit
            const hasMatch = accountUnits.some(unitId => userUnitIds.includes(unitId));
            return !hasMatch;
        }
        // Default: allow
        return false;
    }
}
exports.AccountAccessPolicy = AccountAccessPolicy;
//# sourceMappingURL=AccountAccessPolicy.js.map