"use strict";
/**
 * PostingAccountRule
 *
 * Ensures only POSTING accounts with ACTIVE status and no replacement
 * can be used in voucher lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostingAccountRule = void 0;
class PostingAccountRule {
    constructor() {
        this.name = 'PostingAccountOnly';
        this.priority = 1; // Highest priority
    }
    async validate(ctx) {
        const { account } = ctx;
        // 1. Check accountRole
        if (account.accountRole !== 'POSTING') {
            return {
                valid: false,
                reason: `Account "${account.userCode} - ${account.name}" is a HEADER account and cannot be used for posting. Select a POSTING account.`,
                ruleName: this.name
            };
        }
        // 2. Check status
        if (account.status !== 'ACTIVE') {
            return {
                valid: false,
                reason: `Account "${account.userCode} - ${account.name}" is INACTIVE. Please select an active account.`,
                ruleName: this.name
            };
        }
        // 3. Check replacement
        if (account.replacedByAccountId) {
            return {
                valid: false,
                reason: `Account "${account.userCode} - ${account.name}" has been replaced. Please use account ${account.replacedByAccountId} instead.`,
                ruleName: this.name
            };
        }
        // 4. Check hierarchy (Posting accounts shouldn't have children)
        if (account.hasChildren) {
            return {
                valid: false,
                reason: `Account "${account.userCode} - ${account.name}" has sub-accounts and cannot be used for posting. Please select a child account.`,
                ruleName: this.name
            };
        }
        return { valid: true };
    }
}
exports.PostingAccountRule = PostingAccountRule;
//# sourceMappingURL=PostingAccountRule.js.map