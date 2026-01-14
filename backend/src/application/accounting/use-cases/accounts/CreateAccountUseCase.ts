/**
 * CreateAccountUseCase
 * 
 * Creates a new account with full specification compliance.
 * Handles: systemCode generation, userCode normalization, parent validation, defaults.
 */

import { IAccountRepository, NewAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
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
  constructor(private accountRepo: IAccountRepository) {}

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

    // 6. Validate parent classification match (if parentId provided)
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
      // Currency policy tree coherence: if parent is FIXED, child cannot be OPEN
      if (parent.currencyPolicy === 'FIXED' && currencyPolicy === 'OPEN') {
        throw this.createError(
          'Child account cannot have OPEN currency policy when parent is FIXED',
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
