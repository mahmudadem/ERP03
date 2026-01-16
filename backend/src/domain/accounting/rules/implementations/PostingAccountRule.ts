/**
 * PostingAccountRule
 * 
 * Ensures only POSTING accounts with ACTIVE status and no replacement
 * can be used in voucher lines.
 */

import { IAccountValidationRule, AccountValidationContext, ValidationResult } from '../IAccountValidationRule';

export class PostingAccountRule implements IAccountValidationRule {
  name = 'PostingAccountOnly';
  priority = 1; // Highest priority

  async validate(ctx: AccountValidationContext): Promise<ValidationResult> {
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
