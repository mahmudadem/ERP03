/**
 * UpdateAccountUseCase
 * 
 * Updates an existing account with full specification compliance.
 * Handles: USED immutability, parent validation, replace policy, audit events.
 */

import { IAccountRepository, UpdateAccountInput } from '../../../../repository/interfaces/accounting/IAccountRepository';
import { 
  Account, 
  normalizeUserCode,
  validateUserCodeFormat,
  normalizeClassification,
  validateBalanceNature,
  validateCurrencyPolicy,
  AccountClassification
} from '../../../../domain/accounting/models/Account';

export interface UpdateAccountCommand {
  updatedBy: string;
  
  // Mutable fields
  userCode?: string;
  name?: string;
  description?: string | null;
  status?: string;
  replacedByAccountId?: string | null;
  parentId?: string | null;
  isProtected?: boolean;
  
  // Conditionally mutable (blocked after USED)
  accountRole?: string;
  classification?: string;
  balanceNature?: string;
  balanceEnforcement?: string;
  currencyPolicy?: string;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[];
  
  // Legacy compat
  code?: string;
  type?: string;
  isActive?: boolean;
  currency?: string;
}

export class UpdateAccountUseCase {
  constructor(private accountRepo: IAccountRepository) {}

  async execute(companyId: string, accountId: string, data: UpdateAccountCommand): Promise<Account> {
    // 1. Load existing account
    const existing = await this.accountRepo.getById(companyId, accountId);
    if (!existing) {
      throw this.createError('Account not found', 404);
    }

    // 2. Check if account is USED (has voucher line references)
    const isUsed = await this.accountRepo.isUsed(companyId, accountId);
    existing.setIsUsed(isUsed);

    // 3. Check for protected account restrictions
    if (existing.isProtected) {
      const protectedBlockedFields = ['classification', 'type', 'parentId', 'accountRole'];
      for (const field of protectedBlockedFields) {
        if ((data as any)[field] !== undefined && (data as any)[field] !== (existing as any)[field]) {
          throw this.createError(`Cannot change ${field} of a protected account`, 403);
        }
      }
    }

    // 4. Enforce USED immutability (10A)
    if (isUsed) {
      const usedImmutableFields = Account.getUsedImmutableFields();
      for (const field of usedImmutableFields) {
        const newValue = (data as any)[field];
        const oldValue = (existing as any)[field];
        
        if (newValue !== undefined && newValue !== oldValue) {
          // Handle array comparison
          if (Array.isArray(newValue) && Array.isArray(oldValue)) {
            if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
              throw this.createError(
                `Cannot change ${field} of an account that has been used in vouchers`,
                400
              );
            }
          } else {
            throw this.createError(
              `Cannot change ${field} of an account that has been used in vouchers`,
              400
            );
          }
        }
      }
    }

    // 5. Validate userCode if changing
    const newUserCode = data.userCode || data.code;
    if (newUserCode && newUserCode !== existing.userCode) {
      const normalizedCode = normalizeUserCode(newUserCode);
      const codeError = validateUserCodeFormat(normalizedCode);
      if (codeError) {
        throw this.createError(codeError, 400);
      }
      
      const exists = await this.accountRepo.existsByUserCode(companyId, normalizedCode, accountId);
      if (exists) {
        throw this.createError(`Account with user code ${normalizedCode} already exists`, 409);
      }
    }

    // 6. Validate classification if changing
    if (data.classification || data.type) {
      const newClassification = normalizeClassification(data.classification || data.type || existing.classification);
      
      // Check balance nature compatibility
      const newBalanceNature = data.balanceNature || existing.balanceNature;
      const balanceError = validateBalanceNature(newBalanceNature as any, newClassification);
      if (balanceError) {
        throw this.createError(balanceError, 400);
      }
    }

    // 7. Validate parent classification match
    const newParentId = data.parentId !== undefined ? data.parentId : existing.parentId;
    if (newParentId) {
      const parent = await this.accountRepo.getById(companyId, newParentId);
      if (!parent) {
        throw this.createError(`Parent account ${newParentId} not found`, 404);
      }
      
      const effectiveClassification = normalizeClassification(
        data.classification || data.type || existing.classification
      );
      if (parent.classification !== effectiveClassification) {
        throw this.createError(
          `Child classification (${effectiveClassification}) must match parent classification (${parent.classification})`,
          400
        );
      }
      
      // Currency policy tree coherence
      const effectiveCurrencyPolicy = data.currencyPolicy || existing.currencyPolicy;
      if (parent.currencyPolicy === 'FIXED' && effectiveCurrencyPolicy === 'OPEN') {
        throw this.createError(
          'Child account cannot have OPEN currency policy when parent is FIXED',
          400
        );
      }
    }

    // 8. Validate accountRole vs children
    const newAccountRole = data.accountRole || existing.accountRole;
    if (newAccountRole === 'POSTING') {
      const childCount = await this.accountRepo.countChildren(companyId, accountId);
      if (childCount > 0) {
        throw this.createError(
          'Cannot set accountRole to POSTING for an account that has children. Remove children first or use HEADER.',
          400
        );
      }
    }

    // 9. Handle replace policy
    if (data.replacedByAccountId) {
      // Verify replacement account exists
      const replacement = await this.accountRepo.getById(companyId, data.replacedByAccountId);
      if (!replacement) {
        throw this.createError(`Replacement account ${data.replacedByAccountId} not found`, 404);
      }
      // Auto-set status to INACTIVE
      data.status = 'INACTIVE';
    }

    // 10. Validate currency policy if changing
    if (data.currencyPolicy || data.fixedCurrencyCode || data.allowedCurrencyCodes) {
      const currencyError = validateCurrencyPolicy(
        (data.currencyPolicy || existing.currencyPolicy) as any,
        data.fixedCurrencyCode !== undefined ? data.fixedCurrencyCode : existing.fixedCurrencyCode,
        data.allowedCurrencyCodes !== undefined ? data.allowedCurrencyCodes : existing.allowedCurrencyCodes
      );
      if (currencyError) {
        throw this.createError(currencyError, 400);
      }
    }

    // 11. Record audit events for key changes
    const auditEvents: Array<{ field: string; oldValue: any; newValue: any; type: any }> = [];
    
    if (data.name && data.name !== existing.name) {
      auditEvents.push({ field: 'name', oldValue: existing.name, newValue: data.name, type: 'NAME_CHANGED' });
    }
    if (newUserCode && newUserCode !== existing.userCode) {
      auditEvents.push({ field: 'userCode', oldValue: existing.userCode, newValue: newUserCode, type: 'USER_CODE_CHANGED' });
    }
    if (data.status && data.status !== existing.status) {
      auditEvents.push({ field: 'status', oldValue: existing.status, newValue: data.status, type: 'STATUS_CHANGED' });
    }
    if (data.replacedByAccountId !== undefined && data.replacedByAccountId !== existing.replacedByAccountId) {
      auditEvents.push({ field: 'replacedByAccountId', oldValue: existing.replacedByAccountId, newValue: data.replacedByAccountId, type: 'REPLACED_BY_CHANGED' });
    }
    if (data.currencyPolicy && data.currencyPolicy !== existing.currencyPolicy) {
      auditEvents.push({ field: 'currencyPolicy', oldValue: existing.currencyPolicy, newValue: data.currencyPolicy, type: 'CURRENCY_POLICY_CHANGED' });
    }

    // 12. Build update input
    const updateInput: UpdateAccountInput = {
      updatedBy: data.updatedBy
    };

    // Copy all provided fields
    if (newUserCode) updateInput.userCode = normalizeUserCode(newUserCode);
    if (data.name !== undefined) updateInput.name = data.name;
    if (data.description !== undefined) updateInput.description = data.description;
    if (data.status !== undefined) updateInput.status = data.status as any;
    if (data.isActive !== undefined) updateInput.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
    if (data.replacedByAccountId !== undefined) updateInput.replacedByAccountId = data.replacedByAccountId;
    if (data.parentId !== undefined) updateInput.parentId = data.parentId;
    if (data.isProtected !== undefined) updateInput.isProtected = data.isProtected;
    if (data.accountRole !== undefined) updateInput.accountRole = data.accountRole as any;
    if (data.classification !== undefined) updateInput.classification = normalizeClassification(data.classification);
    if (data.type !== undefined) updateInput.classification = normalizeClassification(data.type);
    if (data.balanceNature !== undefined) updateInput.balanceNature = data.balanceNature as any;
    if (data.balanceEnforcement !== undefined) updateInput.balanceEnforcement = data.balanceEnforcement as any;
    if (data.currencyPolicy !== undefined) updateInput.currencyPolicy = data.currencyPolicy as any;
    if (data.fixedCurrencyCode !== undefined) updateInput.fixedCurrencyCode = data.fixedCurrencyCode;
    if (data.currency !== undefined) updateInput.fixedCurrencyCode = data.currency;
    if (data.allowedCurrencyCodes !== undefined) updateInput.allowedCurrencyCodes = data.allowedCurrencyCodes;

    // 13. Perform update
    const updated = await this.accountRepo.update(companyId, accountId, updateInput);

    // 14. Record audit events
    const now = new Date();
    for (const event of auditEvents) {
      await this.accountRepo.recordAuditEvent(companyId, accountId, {
        type: event.type,
        field: event.field,
        oldValue: event.oldValue,
        newValue: event.newValue,
        changedBy: data.updatedBy,
        changedAt: now
      });
    }

    return updated;
  }

  private createError(message: string, statusCode: number): Error {
    const err: any = new Error(message);
    err.statusCode = statusCode;
    return err;
  }
}
