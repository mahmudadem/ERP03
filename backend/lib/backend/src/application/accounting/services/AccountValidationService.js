"use strict";
/**
 * Account Validation Service
 *
 * Central service for validating accounts against all registered rules.
 * Supports extensible rule registration and provides helper methods
 * for getting valid accounts and resolving account codes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountValidationService = void 0;
const PostingAccountRule_1 = require("../../../domain/accounting/rules/implementations/PostingAccountRule");
const CurrencyPolicyRule_1 = require("../../../domain/accounting/rules/implementations/CurrencyPolicyRule");
class AccountValidationService {
    constructor(accountRepo) {
        this.accountRepo = accountRepo;
        this.rules = [];
        // Register V2 rules
        this.registerRule(new PostingAccountRule_1.PostingAccountRule());
        this.registerRule(new CurrencyPolicyRule_1.CurrencyPolicyRule());
    }
    /**
     * Register a new validation rule
     */
    registerRule(rule) {
        this.rules.push(rule);
        // Sort by priority (lower = higher priority)
        this.rules.sort((a, b) => a.priority - b.priority);
    }
    /**
     * Validate a single account against all rules
     */
    async validateAccount(ctx) {
        const errors = [];
        for (const rule of this.rules) {
            // Check if rule applies to this context
            if (rule.appliesTo && !rule.appliesTo(ctx)) {
                continue;
            }
            const result = await rule.validate(ctx);
            if (!result.valid) {
                errors.push(Object.assign(Object.assign({}, result), { ruleName: rule.name }));
            }
        }
        return errors;
    }
    /**
     * Check if an account is valid (passes all rules)
     */
    async isAccountValid(ctx) {
        const errors = await this.validateAccount(ctx);
        return errors.length === 0;
    }
    /**
     * Get all valid accounts for a company/user context
     * Pre-filters accounts that pass all validation rules
     */
    async getValidAccounts(companyId, userId, voucherType) {
        // Get all accounts for the company
        const allAccounts = await this.accountRepo.list(companyId);
        const validAccounts = [];
        // Check which accounts have children (to mark them as parent accounts)
        for (const account of allAccounts) {
            const hasChildren = await this.accountRepo.hasChildren(companyId, account.id);
            account.setHasChildren(hasChildren);
        }
        for (const account of allAccounts) {
            const ctx = {
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
    async resolveAccountCode(companyId, code) {
        try {
            // First try to find by code
            const account = await this.accountRepo.getByCode(companyId, code);
            return account || null;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Resolve account code and validate
     * Returns account if valid, throws error if invalid
     */
    async resolveAndValidate(companyId, userId, code, voucherType) {
        const account = await this.resolveAccountCode(companyId, code);
        if (!account) {
            throw new Error(`Account with code "${code}" not found`);
        }
        // Check if has children
        const hasChildren = await this.accountRepo.hasChildren(companyId, account.id);
        account.setHasChildren(hasChildren);
        const ctx = {
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
    /**
     * Resolve account by ID and validate
     */
    async validateAccountById(companyId, userId, accountId, voucherType, extraContext) {
        const account = await this.accountRepo.getById(companyId, accountId);
        if (!account) {
            throw new Error(`Account "${accountId}" not found`);
        }
        // Check if has children
        const hasChildren = await this.accountRepo.hasChildren(companyId, account.id);
        account.setHasChildren(hasChildren);
        const ctx = Object.assign({ companyId,
            userId,
            account,
            voucherType }, extraContext);
        const errors = await this.validateAccount(ctx);
        if (errors.length > 0) {
            const reasons = errors.map(e => e.reason).join('; ');
            throw new Error(`Account "${account.userCode}" invalid: ${reasons}`);
        }
        return account;
    }
}
exports.AccountValidationService = AccountValidationService;
//# sourceMappingURL=AccountValidationService.js.map