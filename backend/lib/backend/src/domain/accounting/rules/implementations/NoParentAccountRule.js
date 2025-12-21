"use strict";
/**
 * No Parent Account Rule
 *
 * Prevents posting to grouping/parent accounts.
 * Only leaf accounts (accounts without children) can be used in vouchers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoParentAccountRule = void 0;
class NoParentAccountRule {
    constructor() {
        this.name = 'NoParentAccount';
        this.priority = 10;
    }
    async validate(ctx) {
        const { account } = ctx;
        // Check if account is a parent/grouping account
        // Parent accounts typically have children or are marked as grouping
        if (account.isParent || account.hasChildren) {
            return {
                valid: false,
                reason: `Cannot post to grouping account "${account.code} - ${account.name}". Please select a leaf account.`,
                ruleName: this.name
            };
        }
        return { valid: true };
    }
}
exports.NoParentAccountRule = NoParentAccountRule;
//# sourceMappingURL=NoParentAccountRule.js.map