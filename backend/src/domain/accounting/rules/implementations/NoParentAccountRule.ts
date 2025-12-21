/**
 * No Parent Account Rule
 * 
 * Prevents posting to grouping/parent accounts.
 * Only leaf accounts (accounts without children) can be used in vouchers.
 */

import { IAccountValidationRule, AccountValidationContext, ValidationResult } from '../IAccountValidationRule';

export class NoParentAccountRule implements IAccountValidationRule {
  name = 'NoParentAccount';
  priority = 10;

  async validate(ctx: AccountValidationContext): Promise<ValidationResult> {
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
