"use strict";
/**
 * UpdateAccountUseCase
 *
 * Updates an existing account with full specification compliance.
 * Handles: USED immutability, parent validation, replace policy, audit events.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAccountUseCase = void 0;
const Account_1 = require("../../../../domain/accounting/models/Account");
class UpdateAccountUseCase {
    constructor(accountRepo, companyRepo) {
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
    }
    async execute(companyId, accountId, data) {
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
                if (data[field] !== undefined && data[field] !== existing[field]) {
                    throw this.createError(`Cannot change ${field} of a protected account`, 403);
                }
            }
        }
        // 4. Enforce USED immutability (10A)
        if (isUsed) {
            const usedImmutableFields = Account_1.Account.getUsedImmutableFields();
            for (const field of usedImmutableFields) {
                const newValue = data[field];
                const oldValue = existing[field];
                if (newValue !== undefined && newValue !== oldValue) {
                    // Handle array comparison
                    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
                        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
                            throw this.createError(`Cannot change ${field} of an account that has been used in vouchers`, 400);
                        }
                    }
                    else {
                        throw this.createError(`Cannot change ${field} of an account that has been used in vouchers`, 400);
                    }
                }
            }
        }
        // 5. Validate userCode if changing
        const newUserCode = data.userCode || data.code;
        if (newUserCode && newUserCode !== existing.userCode) {
            const normalizedCode = (0, Account_1.normalizeUserCode)(newUserCode);
            const codeError = (0, Account_1.validateUserCodeFormat)(normalizedCode);
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
            const newClassification = (0, Account_1.normalizeClassification)(data.classification || data.type || existing.classification);
            // Check balance nature compatibility
            const newBalanceNature = data.balanceNature || existing.balanceNature;
            const balanceError = (0, Account_1.validateBalanceNature)(newBalanceNature, newClassification);
            if (balanceError) {
                throw this.createError(balanceError, 400);
            }
        }
        // 7. Validate classification and context (Professional Governance)
        const company = await this.companyRepo.findById(companyId);
        if (!company)
            throw this.createError('Company not found', 404);
        const baseCurrency = company.baseCurrency || 'USD';
        const newParentId = data.parentId !== undefined ? data.parentId : existing.parentId;
        const effectiveCurrencyPolicy = (data.currencyPolicy || existing.currencyPolicy);
        const effectiveFixedCurrency = data.fixedCurrencyCode !== undefined ? data.fixedCurrencyCode : existing.fixedCurrencyCode;
        if (newParentId) {
            const parent = await this.accountRepo.getById(companyId, newParentId);
            if (!parent) {
                throw this.createError(`Parent account ${newParentId} not found`, 404);
            }
            const effectiveClassification = (0, Account_1.normalizeClassification)(data.classification || data.type || existing.classification);
            if (parent.classification !== effectiveClassification) {
                throw this.createError(`Child classification (${effectiveClassification}) must match parent classification (${parent.classification})`, 400);
            }
            // Professional Governance: Waterfall rule
            // If the parent is in a foreign currency, child cannot revert to Base
            if (parent.currencyPolicy === 'FIXED' && parent.fixedCurrencyCode !== baseCurrency) {
                if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency !== parent.fixedCurrencyCode) {
                    throw this.createError(`Professional Governance Violation: Account belongs to a ${parent.fixedCurrencyCode} parent. ` +
                        `Children inside a foreign context must share the parent's currency (${parent.fixedCurrencyCode}).`, 400);
                }
                if (effectiveCurrencyPolicy === 'OPEN') {
                    throw this.createError(`Professional Governance Violation: Cannot have OPEN currency policy under a foreign FIXED parent (${parent.fixedCurrencyCode}).`, 400);
                }
            }
            // Currency policy tree coherence
            if (parent.currencyPolicy === 'FIXED' && effectiveCurrencyPolicy === 'OPEN') {
                throw this.createError('Child account cannot have OPEN currency policy when parent is FIXED', 400);
            }
            // Auto-convert parent to HEADER if it's currently POSTING
            if (parent.accountRole === 'POSTING') {
                await this.accountRepo.update(companyId, parent.id, {
                    accountRole: 'HEADER',
                    updatedBy: data.updatedBy
                });
            }
        }
        else {
            // Root Level Governance Lock
            if (effectiveCurrencyPolicy === 'OPEN') {
                throw this.createError('Root Governance Lock: Root accounts (Assets, Liabilities, etc.) cannot have an OPEN currency policy.', 400);
            }
            if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency !== baseCurrency) {
                throw this.createError(`Root Governance Lock: Level 0 accounts (Assets, Liabilities, etc.) must remain in the company base currency (${baseCurrency}).`, 400);
            }
        }
        // 8. Validate accountRole vs children
        const newAccountRole = data.accountRole || existing.accountRole;
        if (newAccountRole === 'POSTING') {
            const childCount = await this.accountRepo.countChildren(companyId, accountId);
            if (childCount > 0) {
                throw this.createError('Cannot set accountRole to POSTING for an account that has children. Remove children first or use HEADER.', 400);
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
            const currencyError = (0, Account_1.validateCurrencyPolicy)((data.currencyPolicy || existing.currencyPolicy), data.fixedCurrencyCode !== undefined ? data.fixedCurrencyCode : existing.fixedCurrencyCode, data.allowedCurrencyCodes !== undefined ? data.allowedCurrencyCodes : existing.allowedCurrencyCodes);
            if (currencyError) {
                throw this.createError(currencyError, 400);
            }
        }
        // 11. Record audit events for key changes
        const auditEvents = [];
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
        const updateInput = {
            updatedBy: data.updatedBy
        };
        // Copy all provided fields
        if (newUserCode)
            updateInput.userCode = (0, Account_1.normalizeUserCode)(newUserCode);
        if (data.name !== undefined)
            updateInput.name = data.name;
        if (data.description !== undefined)
            updateInput.description = data.description;
        if (data.status !== undefined)
            updateInput.status = data.status;
        if (data.isActive !== undefined)
            updateInput.status = data.isActive ? 'ACTIVE' : 'INACTIVE';
        if (data.replacedByAccountId !== undefined)
            updateInput.replacedByAccountId = data.replacedByAccountId;
        if (data.parentId !== undefined)
            updateInput.parentId = data.parentId;
        if (data.isProtected !== undefined)
            updateInput.isProtected = data.isProtected;
        if (data.accountRole !== undefined)
            updateInput.accountRole = data.accountRole;
        if (data.classification !== undefined)
            updateInput.classification = (0, Account_1.normalizeClassification)(data.classification);
        if (data.type !== undefined)
            updateInput.classification = (0, Account_1.normalizeClassification)(data.type);
        if (data.balanceNature !== undefined)
            updateInput.balanceNature = data.balanceNature;
        if (data.balanceEnforcement !== undefined)
            updateInput.balanceEnforcement = data.balanceEnforcement;
        if (data.currencyPolicy !== undefined)
            updateInput.currencyPolicy = data.currencyPolicy;
        if (data.fixedCurrencyCode !== undefined)
            updateInput.fixedCurrencyCode = data.fixedCurrencyCode;
        if (data.currency !== undefined)
            updateInput.fixedCurrencyCode = data.currency;
        if (data.allowedCurrencyCodes !== undefined)
            updateInput.allowedCurrencyCodes = data.allowedCurrencyCodes;
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
    createError(message, statusCode) {
        const err = new Error(message);
        err.statusCode = statusCode;
        return err;
    }
}
exports.UpdateAccountUseCase = UpdateAccountUseCase;
//# sourceMappingURL=UpdateAccountUseCase.js.map