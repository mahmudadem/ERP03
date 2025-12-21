/**
 * Active Account Only Rule
 * 
 * Prevents posting to inactive/disabled accounts.
 * Only active accounts can be used in vouchers.
 */

import { IAccountValidationRule, AccountValidationContext, ValidationResult } from '../IAccountValidationRule';

export class ActiveAccountOnlyRule implements IAccountValidationRule {
  name = 'ActiveAccountOnly';
  priority = 5; // Higher priority than NoParentAccount

  async validate(ctx: AccountValidationContext): Promise<ValidationResult> {
    const { account } = ctx;
    
    // Check if account is active
    if (account.isActive === false || account.status === 'inactive' || account.status === 'disabled') {
      return {
        valid: false,
        reason: `Account "${account.code} - ${account.name}" is inactive. Please select an active account.`,
        ruleName: this.name
      };
    }
    
    return { valid: true };
  }
}
