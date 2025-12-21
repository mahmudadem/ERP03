/**
 * Account Validation Service
 * 
 * Central service for validating accounts against all registered rules.
 * Supports extensible rule registration and provides helper methods
 * for getting valid accounts and resolving account codes.
 */

import { Account } from '../../../domain/accounting/entities/Account';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { 
  IAccountValidationRule, 
  AccountValidationContext, 
  ValidationResult 
} from '../../../domain/accounting/rules/IAccountValidationRule';
import { NoParentAccountRule } from '../../../domain/accounting/rules/implementations/NoParentAccountRule';
import { ActiveAccountOnlyRule } from '../../../domain/accounting/rules/implementations/ActiveAccountOnlyRule';

export class AccountValidationService {
  private rules: IAccountValidationRule[] = [];

  constructor(private accountRepo: IAccountRepository) {
    // Register built-in rules
    this.registerRule(new ActiveAccountOnlyRule());
    this.registerRule(new NoParentAccountRule());
  }

  /**
   * Register a new validation rule
   */
  registerRule(rule: IAccountValidationRule): void {
    this.rules.push(rule);
    // Sort by priority (lower = higher priority)
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Validate a single account against all rules
   */
  async validateAccount(ctx: AccountValidationContext): Promise<ValidationResult[]> {
    const errors: ValidationResult[] = [];

    for (const rule of this.rules) {
      // Check if rule applies to this context
      if (rule.appliesTo && !rule.appliesTo(ctx)) {
        continue;
      }

      const result = await rule.validate(ctx);
      if (!result.valid) {
        errors.push({
          ...result,
          ruleName: rule.name
        });
      }
    }

    return errors;
  }

  /**
   * Check if an account is valid (passes all rules)
   */
  async isAccountValid(ctx: AccountValidationContext): Promise<boolean> {
    const errors = await this.validateAccount(ctx);
    return errors.length === 0;
  }

  /**
   * Get all valid accounts for a company/user context
   * Pre-filters accounts that pass all validation rules
   */
  async getValidAccounts(
    companyId: string, 
    userId: string, 
    voucherType?: string
  ): Promise<Account[]> {
    // Get all accounts for the company
    const allAccounts = await this.accountRepo.list(companyId);
    const validAccounts: Account[] = [];

    // Check which accounts have children (to mark them as parent accounts)
    for (const account of allAccounts) {
      const hasChildren = await this.accountRepo.hasChildren(companyId, account.id);
      account.setAsParent(hasChildren);
    }

    for (const account of allAccounts) {
      const ctx: AccountValidationContext = {
        companyId,
        userId,
        account,
        voucherType
      };

      const isValid = await this.isAccountValid(ctx);
      if (isValid) {
        validAccounts.push(account);
      }
    }

    return validAccounts;
  }

  /**
   * Resolve account code to account object
   * Returns null if not found
   */
  async resolveAccountCode(
    companyId: string, 
    code: string
  ): Promise<Account | null> {
    try {
      // First try to find by code
      const account = await this.accountRepo.getByCode(companyId, code);
      return account || null;
    } catch (error: unknown) {
      return null;
    }
  }

  /**
   * Resolve account code and validate
   * Returns account if valid, throws error if invalid
   */
  async resolveAndValidate(
    companyId: string,
    userId: string,
    code: string,
    voucherType?: string
  ): Promise<Account> {
    const account = await this.resolveAccountCode(companyId, code);
    
    if (!account) {
      throw new Error(`Account with code "${code}" not found`);
    }

    // Check if has children
    const hasChildren = await this.accountRepo.hasChildren(companyId, account.id);
    account.setAsParent(hasChildren);

    const ctx: AccountValidationContext = {
      companyId,
      userId,
      account,
      voucherType
    };

    const errors = await this.validateAccount(ctx);
    
    if (errors.length > 0) {
      const reasons = errors.map(e => e.reason).join('; ');
      throw new Error(`Account "${code}" is not valid: ${reasons}`);
    }

    return account;
  }
}
