"use strict";
/**
 * Active Account Only Rule
 *
 * Prevents posting to inactive/disabled accounts.
 * Only active accounts can be used in vouchers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveAccountOnlyRule = void 0;
class ActiveAccountOnlyRule {
    constructor() {
        this.name = 'ActiveAccountOnly';
        this.priority = 5; // Higher priority than NoParentAccount
    }
    async validate(ctx) {
        const { account } = ctx;
        // Check if account is active (use isActive boolean or active field)
        if (account.isActive === false) {
            return {
                valid: false,
                reason: `Account "${account.code} - ${account.name}" is inactive. Please select an active account.`,
                ruleName: this.name
            };
        }
        return { valid: true };
    }
}
exports.ActiveAccountOnlyRule = ActiveAccountOnlyRule;
//# sourceMappingURL=ActiveAccountOnlyRule.js.map