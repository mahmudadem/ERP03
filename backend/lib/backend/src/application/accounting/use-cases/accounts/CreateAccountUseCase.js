"use strict";
/**
 * CreateAccountUseCase
 *
 * Creates a new account with full specification compliance.
 * Handles: systemCode generation, userCode normalization, parent validation, defaults.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAccountUseCase = void 0;
const Account_1 = require("../../../../domain/accounting/models/Account");
class CreateAccountUseCase {
    constructor(accountRepo, companyRepo) {
        this.accountRepo = accountRepo;
        this.companyRepo = companyRepo;
    }
    async execute(companyId, data) {
        var _a;
        // 1. Normalize and validate userCode
        const userCode = (0, Account_1.normalizeUserCode)(data.userCode || data.code || '');
        const codeError = (0, Account_1.validateUserCodeFormat)(userCode);
        if (codeError) {
            throw this.createError(codeError, 400);
        }
        // 2. Check userCode uniqueness
        const existingCode = await this.accountRepo.existsByUserCode(companyId, userCode);
        if (existingCode) {
            throw this.createError(`Account with user code ${userCode} already exists`, 409);
        }
        // 3. Normalize classification
        let classification;
        try {
            classification = (0, Account_1.normalizeClassification)(data.classification || data.type || 'ASSET');
        }
        catch (err) {
            throw this.createError(err.message, 400);
        }
        // 4. Determine balance nature and validate
        const balanceNature = data.balanceNature || (0, Account_1.getDefaultBalanceNature)(classification);
        const balanceError = (0, Account_1.validateBalanceNature)(balanceNature, classification);
        if (balanceError) {
            throw this.createError(balanceError, 400);
        }
        // 5. Validate currency policy requirements
        const currencyPolicy = data.currencyPolicy || 'INHERIT';
        const currencyError = (0, Account_1.validateCurrencyPolicy)(currencyPolicy, data.fixedCurrencyCode || data.currency, data.allowedCurrencyCodes);
        if (currencyError) {
            throw this.createError(currencyError, 400);
        }
        // 6. Professional Governance: Fetch company base currency
        const company = await this.companyRepo.findById(companyId);
        if (!company)
            throw this.createError('Company not found', 404);
        const baseCurrency = company.baseCurrency || 'USD';
        // 6.1 Validate Hierarchy Currency Constraints
        if (data.parentId) {
            const parent = await this.accountRepo.getById(companyId, data.parentId);
            if (!parent) {
                throw this.createError(`Parent account ${data.parentId} not found`, 404);
            }
            if (parent.classification !== classification) {
                throw this.createError(`Child classification (${classification}) must match parent classification (${parent.classification})`, 400);
            }
            // Root Currency Lock Inheritance Check (Waterfall rule)
            const effectiveCurrencyPolicy = data.currencyPolicy || 'INHERIT';
            const effectiveFixedCurrency = data.fixedCurrencyCode || data.currency || null;
            // Governance rule: If the parent is in a foreign currency (e.g., EUR), 
            // the child MUST also be EUR (cannot revert to USD Base).
            if (parent.currencyPolicy === 'FIXED' && parent.fixedCurrencyCode !== baseCurrency) {
                if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency !== parent.fixedCurrencyCode) {
                    throw this.createError(`Professional Governance Violation: Account belongs to a ${parent.fixedCurrencyCode} parent. ` +
                        `Children inside a foreign context must share the parent's currency (${parent.fixedCurrencyCode}).`, 400);
                }
                if (effectiveCurrencyPolicy === 'OPEN') {
                    throw this.createError(`Professional Governance Violation: Cannot have OPEN currency policy under a foreign FIXED parent (${parent.fixedCurrencyCode}).`, 400);
                }
            }
            // Currency policy tree coherence: if parent is FIXED, child cannot be OPEN
            if (parent.currencyPolicy === 'FIXED' && currencyPolicy === 'OPEN') {
                throw this.createError('Child account cannot have OPEN currency policy when parent is FIXED', 400);
            }
            // Auto-convert parent to HEADER if it's currently POSTING
            if (parent.accountRole === 'POSTING') {
                await this.accountRepo.update(companyId, parent.id, {
                    accountRole: 'HEADER',
                    updatedBy: data.createdBy
                });
            }
        }
        else {
            // Root Level Policy Validation (Level 0)
            // Root accounts represent the primary ledger and MUST represent the Base Currency context.
            const effectiveCurrencyPolicy = data.currencyPolicy || 'INHERIT';
            const effectiveFixedCurrency = data.fixedCurrencyCode || data.currency || null;
            if (effectiveCurrencyPolicy === 'OPEN') {
                throw this.createError('Root Governance Lock: Root accounts (Assets, Liabilities, etc.) cannot have an OPEN currency policy. They must remain in the company base currency context.', 400);
            }
            if (effectiveCurrencyPolicy === 'FIXED' && effectiveFixedCurrency !== baseCurrency) {
                throw this.createError(`Root Governance Lock: Level 0 accounts (Assets, Liabilities, etc.) must remain in the company base currency (${baseCurrency}). ` +
                    `Use children to record foreign currency transactions.`, 400);
            }
        }
        // 7. Determine account role
        let accountRole = data.accountRole || 'POSTING';
        // POSTING accounts cannot have children at create time (they're new, so 0 children)
        // But if explicitly setting HEADER, allow it
        // 8. Build input for repository
        const input = {
            userCode,
            name: data.name,
            classification,
            createdBy: data.createdBy,
            description: data.description,
            accountRole,
            balanceNature,
            balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
            parentId: data.parentId,
            currencyPolicy,
            fixedCurrencyCode: data.fixedCurrencyCode || data.currency,
            allowedCurrencyCodes: data.allowedCurrencyCodes || [],
            isProtected: (_a = data.isProtected) !== null && _a !== void 0 ? _a : false
        };
        // 9. Create account (repository handles systemCode generation)
        const account = await this.accountRepo.create(companyId, input);
        return account;
    }
    createError(message, statusCode) {
        const err = new Error(message);
        err.statusCode = statusCode;
        return err;
    }
}
exports.CreateAccountUseCase = CreateAccountUseCase;
//# sourceMappingURL=CreateAccountUseCase.js.map