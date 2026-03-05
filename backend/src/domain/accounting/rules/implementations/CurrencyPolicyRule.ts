/**
 * CurrencyPolicyRule
 * 
 * Validates that voucher line currency matches account's currency policy.
 */

import { IAccountValidationRule, AccountValidationContext, ValidationResult } from '../IAccountValidationRule';

export class CurrencyPolicyRule implements IAccountValidationRule {
  name = 'CurrencyPolicy';
  priority = 15;

  async validate(ctx: AccountValidationContext): Promise<ValidationResult> {
    const { account } = ctx;
    const lineCurrency = ctx.lineCurrency;
    
    // Skip if no line currency provided
    if (!lineCurrency) {
      return { valid: true };
    }

    // Opt-in fixed-currency enforcement:
    // only evaluate when both fixedCurrencyCode and lineCurrency are present.
    const fixedCurrency = account.fixedCurrencyCode;
    if (fixedCurrency && lineCurrency) {
      const normalizedFixed = fixedCurrency.toUpperCase();
      const normalizedLine = lineCurrency.toUpperCase();
      const normalizedBase = (ctx.baseCurrency || '').toUpperCase();

      if (normalizedLine !== normalizedFixed && normalizedLine !== normalizedBase) {
        return {
          valid: false,
          reason: `Account "${account.userCode}" only accepts ${normalizedFixed} or base currency. Got: ${normalizedLine}.`,
          ruleName: this.name
        };
      }
    }

    // Check based on currency policy
    switch (account.currencyPolicy) {
      case 'FIXED':
        if (account.fixedCurrencyCode) {
          const normalizedFixed = account.fixedCurrencyCode.toUpperCase();
          const normalizedLine = lineCurrency.toUpperCase();
          const normalizedBase = (ctx.baseCurrency || '').toUpperCase();
          if (normalizedLine !== normalizedFixed && normalizedLine !== normalizedBase) {
          return {
            valid: false,
            reason: `Account "${account.userCode}" requires currency ${account.fixedCurrencyCode}, but transaction uses ${lineCurrency}.`,
            ruleName: this.name
          };
          }
        }
        break;

      case 'RESTRICTED':
        if (account.allowedCurrencyCodes && account.allowedCurrencyCodes.length > 0) {
          const allowed = account.allowedCurrencyCodes.map(c => c.toUpperCase());
          if (!allowed.includes(lineCurrency.toUpperCase())) {
            return {
              valid: false,
              reason: `Account "${account.userCode}" only allows currencies: ${account.allowedCurrencyCodes.join(', ')}. Transaction uses ${lineCurrency}.`,
              ruleName: this.name
            };
          }
        }
        break;

      case 'INHERIT':
        // Check parent's policy if needed (would require loading parent)
        // For now, INHERIT allows all currencies at the leaf level
        break;

      case 'OPEN':
        // Any currency allowed
        break;
    }

    return { valid: true };
  }
}
