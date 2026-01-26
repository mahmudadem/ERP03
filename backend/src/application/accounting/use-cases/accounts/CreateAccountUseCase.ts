/**
 * CreateAccountUseCase
 * 
 * Creates a new account with full specification compliance.
 * Handles: systemCode generation, userCode normalization, parent validation, defaults.
 */

import { IAccountRepository, NewAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyCurrencyRepository } from '../../../../repository/interfaces/accounting/ICompanyCurrencyRepository';
import { 
  Account, 
  normalizeUserCode,
  validateUserCodeFormat,
  normalizeClassification,
  getDefaultBalanceNature,
  validateBalanceNature,
  validateCurrencyPolicy,
  AccountRole,
  AccountClassification
} from '../../../../domain/accounting/models/Account';

export interface CreateAccountCommand {
  userCode: string;
  name: string;
  classification: string;
  createdBy: string;
  
  // Optional
  description?: string | null;
  accountRole?: AccountRole;
  balanceNature?: string;
  balanceEnforcement?: string;
  parentId?: string | null;
  currencyPolicy?: string;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  isProtected?: boolean;
  
  // Legacy compat
  code?: string;
  type?: string;
  currency?: string;
}

export class CreateAccountUseCase {
  constructor(
    private accountRepo: IAccountRepository,
    private companyRepo: ICompanyRepository,
    private companyCurrencyRepo: ICompanyCurrencyRepository
  ) {}

  async execute(companyId: string, data: CreateAccountCommand): Promise<Account> {
    // 1. Normalize and validate userCode
    const userCode = normalizeUserCode(data.userCode || data.code || '');
    const codeError = validateUserCodeFormat(userCode);
    if (codeError) {
      throw this.createError(codeError, 400);
    }

    // 2. Check userCode uniqueness
    const existingCode = await this.accountRepo.existsByUserCode(companyId, userCode);
    if (existingCode) {
      throw this.createError(`Account with user code ${userCode} already exists`, 409);
    }

    // 3. Normalize classification
    let classification: AccountClassification;
    try {
      classification = normalizeClassification(data.classification || data.type || 'ASSET');
    } catch (err: any) {
      throw this.createError(err.message, 400);
    }

    // 4. Determine balance nature and validate
    const balanceNature = (data.balanceNature as any) || getDefaultBalanceNature(classification);
    const balanceError = validateBalanceNature(balanceNature, classification);
    if (balanceError) {
      throw this.createError(balanceError, 400);
    }

    // 5. Validate currency policy requirements
    const currencyPolicy = (data.currencyPolicy as any) || 'INHERIT';
    const currencyError = validateCurrencyPolicy(
      currencyPolicy,
      data.fixedCurrencyCode || data.currency,
      data.allowedCurrencyCodes
    );
    if (currencyError) {
      throw this.createError(currencyError, 400);
    }

    // 6. Professional Governance: Resolve accurate base currency
    const baseCurrency = await this.companyCurrencyRepo.getBaseCurrency(companyId);
    
    const company = await this.companyRepo.findById(companyId);
    if (!company) throw this.createError('Company not found', 404);

    const effectiveBaseCurrency = (baseCurrency || company.baseCurrency || 'USD').toUpperCase();
    console.log(`[CreateAccountUseCase] Effective baseCurrency: "${effectiveBaseCurrency}" (Resolved: "${baseCurrency}", Profile: "${company.baseCurrency}")`);

    // 6.1 Validate Hierarchy Currency Constraints
    if (data.parentId) {
      const parent = await this.accountRepo.getById(companyId, data.parentId);
      if (!parent) {
        throw this.createError(`Parent account ${data.parentId} not found`, 404);
      }
      if (parent.classification !== classification) {
        throw this.createError(
          `Child classification (${classification}) must match parent classification (${parent.classification})`,
          400
        );
      }

      // Root Currency Lock Inheritance Check (Waterfall rule)
      const effectiveCurrencyPolicy = (data.currencyPolicy as any) || 'INHERIT';
      const effectiveFixedCurrency = (data.fixedCurrencyCode || data.currency || null)?.toUpperCase();

      // Governance rule: If the parent is in a foreign currency (e.g., EUR), 
      // the child MUST also be EUR (cannot revert to USD Base).
      if (parent.currencyPolicy === 'FIXED' && parent.fixedCurrencyCode?.toUpperCase() !== effectiveBaseCurrency) {
        if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency !== parent.fixedCurrencyCode?.toUpperCase()) {
          throw this.createError(
            `Professional Governance Violation: Account belongs to a ${parent.fixedCurrencyCode} parent. ` +
            `Children inside a foreign context must share the parent's currency (${parent.fixedCurrencyCode}).`,
            400
          );
        }
        if (effectiveCurrencyPolicy === 'OPEN') {
          throw this.createError(
            `Professional Governance Violation: Cannot have OPEN currency policy under a foreign FIXED parent (${parent.fixedCurrencyCode}).`,
            400
          );
        }
      }

      // Currency policy tree coherence: if parent is FIXED, child cannot be OPEN
      if (parent.currencyPolicy === 'FIXED' && currencyPolicy === 'OPEN') {
        throw this.createError(
          'Child account cannot have OPEN currency policy when parent is FIXED',
          400
        );
      }
      
      // Auto-convert parent to HEADER if it's currently POSTING
      if (parent.accountRole === 'POSTING') {
        await this.accountRepo.update(companyId, parent.id, {
          accountRole: 'HEADER',
          updatedBy: data.createdBy
        });
      }
    } else {
      // Root Level Policy Validation (Level 0)
      // Root accounts represent the primary ledger and MUST represent the Base Currency context.
      const effectiveCurrencyPolicy = (data.currencyPolicy as any) || 'INHERIT';
      const effectiveFixedCurrency = data.fixedCurrencyCode || data.currency || null;

      if (effectiveCurrencyPolicy === 'OPEN') {
         throw this.createError(
          'Root Governance Lock: Root accounts (Assets, Liabilities, etc.) cannot have an OPEN currency policy. They must remain in the company base currency context.',
          400
        );
      }

      if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency?.toUpperCase() !== effectiveBaseCurrency.toUpperCase()) {
        throw this.createError(
          `Root Governance Lock: Level 0 accounts (Assets, Liabilities, etc.) must remain in the company base currency (${effectiveBaseCurrency}). ` +
          `Detected: ${effectiveFixedCurrency}.`,
          400
        );
      }
    }

    // 7. Determine account role
    let accountRole: AccountRole = data.accountRole || 'POSTING';
    
    // POSTING accounts cannot have children at create time (they're new, so 0 children)
    // But if explicitly setting HEADER, allow it
    
    // 8. Build input for repository
    const input: NewAccountInput = {
      userCode,
      name: data.name,
      classification,
      createdBy: data.createdBy,
      description: data.description,
      accountRole,
      balanceNature,
      balanceEnforcement: (data.balanceEnforcement as any) || 'WARN_ABNORMAL',
      parentId: data.parentId,
      currencyPolicy,
      fixedCurrencyCode: data.fixedCurrencyCode || data.currency,
      allowedCurrencyCodes: data.allowedCurrencyCodes || [],
      isProtected: data.isProtected ?? false
    };

    // 9. Create account (repository handles systemCode generation)
    const account = await this.accountRepo.create(companyId, input);

    return account;
  }

  private createError(message: string, statusCode: number): Error {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
  }
}
