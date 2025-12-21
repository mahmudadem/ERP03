/**
 * Account Validation Rule Interface
 * 
 * All account validation rules implement this interface.
 * Rules are executed in priority order (lower = higher priority).
 */

import { Account } from '../entities/Account';

export interface AccountValidationContext {
  companyId: string;
  userId: string;
  account: Account;
  voucherType?: string;
  lineType?: 'debit' | 'credit';
  amount?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  ruleName?: string;
}

export interface IAccountValidationRule {
  /** Unique name of the rule */
  name: string;
  
  /** Priority - lower numbers execute first */
  priority: number;
  
  /** Validate an account against this rule */
  validate(ctx: AccountValidationContext): Promise<ValidationResult>;
  
  /** Optional: Check if this rule applies to the given context */
  appliesTo?(ctx: AccountValidationContext): boolean;
}
