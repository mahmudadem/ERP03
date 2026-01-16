"use strict";
/**
 * Account Entity
 *
 * Chart of Accounts domain entity with full specification compliance.
 * Implements: Identity, Classification, Role, Balance controls, Currency policy, Audit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Account = exports.validateCurrencyPolicy = exports.validateBalanceNature = exports.getDefaultBalanceNature = exports.normalizeClassification = exports.validateUserCodeFormat = exports.normalizeUserCode = void 0;
// ============================================================================
// VALIDATION HELPERS
// ============================================================================
/**
 * Normalize user code: trim, uppercase, replace any invalid chars
 * Allowed: A-Z, 0-9, '.', '-', '_'
 */
function normalizeUserCode(code) {
    if (!code)
        return '';
    return code
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '') // Remove spaces
        .replace(/[^A-Z0-9.\-_]/g, ''); // Remove invalid chars
}
exports.normalizeUserCode = normalizeUserCode;
/**
 * Validate user code format
 * Returns error message or null if valid
 */
function validateUserCodeFormat(code) {
    if (!code || code.trim().length === 0) {
        return 'User code is required';
    }
    const normalized = normalizeUserCode(code);
    if (normalized.length === 0) {
        return 'User code contains only invalid characters';
    }
    if (normalized !== code.trim().toUpperCase()) {
        return 'User code contains invalid characters. Only letters, digits, and separators (. - _) are allowed';
    }
    return null;
}
exports.validateUserCodeFormat = validateUserCodeFormat;
/**
 * Map legacy INCOME to REVENUE
 */
function normalizeClassification(input) {
    const upper = (input || '').toUpperCase().trim();
    if (upper === 'INCOME')
        return 'REVENUE';
    if (['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(upper)) {
        return upper;
    }
    throw new Error(`Invalid classification: ${input}. Must be ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE.`);
}
exports.normalizeClassification = normalizeClassification;
/**
 * Get default balance nature for a classification
 */
function getDefaultBalanceNature(classification) {
    switch (classification) {
        case 'ASSET':
        case 'EXPENSE':
            return 'DEBIT';
        case 'LIABILITY':
        case 'EQUITY':
        case 'REVENUE':
            return 'CREDIT';
    }
}
exports.getDefaultBalanceNature = getDefaultBalanceNature;
/**
 * Validate balance nature against classification
 * BOTH is only allowed for ASSET, LIABILITY, EQUITY
 */
function validateBalanceNature(balanceNature, classification) {
    if (balanceNature === 'BOTH') {
        if (classification === 'REVENUE' || classification === 'EXPENSE') {
            return `Balance nature BOTH is not allowed for ${classification} accounts. Use DEBIT or CREDIT.`;
        }
    }
    return null;
}
exports.validateBalanceNature = validateBalanceNature;
/**
 * Validate currency policy requirements
 */
function validateCurrencyPolicy(policy, fixedCurrencyCode, allowedCurrencyCodes) {
    if (policy === 'FIXED') {
        if (!fixedCurrencyCode || fixedCurrencyCode.trim().length === 0) {
            return 'Currency policy FIXED requires a fixedCurrencyCode';
        }
    }
    if (policy === 'RESTRICTED') {
        if (!allowedCurrencyCodes || allowedCurrencyCodes.length === 0) {
            return 'Currency policy RESTRICTED requires at least one allowed currency code';
        }
    }
    return null;
}
exports.validateCurrencyPolicy = validateCurrencyPolicy;
class Account {
    constructor(props) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // Runtime flags (computed, not persisted directly)
        this._hasChildren = false;
        this._isUsed = false;
        // Identity
        this.id = props.id;
        this.systemCode = props.systemCode;
        this.companyId = props.companyId;
        this.createdAt = props.createdAt;
        this.createdBy = props.createdBy;
        // User-editable
        this.userCode = props.userCode;
        this.name = props.name;
        this.description = (_a = props.description) !== null && _a !== void 0 ? _a : null;
        // Semantics
        this.accountRole = props.accountRole;
        this.classification = props.classification;
        this.balanceNature = props.balanceNature;
        this.balanceEnforcement = props.balanceEnforcement;
        // Hierarchy
        this.parentId = (_b = props.parentId) !== null && _b !== void 0 ? _b : null;
        // Currency
        this.currencyPolicy = props.currencyPolicy;
        this.fixedCurrencyCode = (_c = props.fixedCurrencyCode) !== null && _c !== void 0 ? _c : null;
        this.allowedCurrencyCodes = (_d = props.allowedCurrencyCodes) !== null && _d !== void 0 ? _d : [];
        // Lifecycle
        this.status = props.status;
        this.isProtected = props.isProtected;
        this.replacedByAccountId = (_e = props.replacedByAccountId) !== null && _e !== void 0 ? _e : null;
        // Audit
        this.updatedAt = props.updatedAt;
        this.updatedBy = props.updatedBy;
        // Legacy
        this.requiresApproval = (_f = props.requiresApproval) !== null && _f !== void 0 ? _f : false;
        this.requiresCustodyConfirmation = (_g = props.requiresCustodyConfirmation) !== null && _g !== void 0 ? _g : false;
        this.custodianUserId = (_h = props.custodianUserId) !== null && _h !== void 0 ? _h : null;
    }
    // =========================================================================
    // COMPUTED PROPERTIES (Legacy compatibility)
    // =========================================================================
    /** Legacy: alias for userCode */
    get code() {
        return this.userCode;
    }
    /** Legacy: alias for classification */
    get type() {
        return this.classification;
    }
    /** Legacy: get currency (from fixedCurrencyCode or empty) */
    get currency() {
        return this.fixedCurrencyCode || '';
    }
    /** Legacy: active boolean based on status */
    get active() {
        return this.status === 'ACTIVE';
    }
    /** Legacy: isActive alias */
    get isActive() {
        return this.status === 'ACTIVE';
    }
    /** Runtime: whether account has children */
    get hasChildren() {
        return this._hasChildren;
    }
    /** Runtime: whether account is a parent (has children) */
    get isParent() {
        return this._hasChildren;
    }
    /** Runtime: whether account has been used in vouchers */
    get isUsed() {
        return this._isUsed;
    }
    // =========================================================================
    // RUNTIME SETTERS (called by repository/use-case)
    // =========================================================================
    setHasChildren(value) {
        this._hasChildren = value;
        // If has children, must be HEADER
        if (value && this.accountRole !== 'HEADER') {
            console.warn(`Account ${this.userCode} has children but role is ${this.accountRole}. Should be HEADER.`);
        }
    }
    setIsUsed(value) {
        this._isUsed = value;
    }
    // =========================================================================
    // BUSINESS METHODS
    // =========================================================================
    /**
     * Check if account can be used for posting (voucher lines)
     */
    canPost() {
        return (this.accountRole === 'POSTING' &&
            this.status === 'ACTIVE' &&
            this.replacedByAccountId === null);
    }
    /**
     * Get immutable fields that cannot change after USED
     */
    static getUsedImmutableFields() {
        return [
            'accountRole',
            'classification',
            'balanceNature',
            'balanceEnforcement',
            'currencyPolicy',
            'fixedCurrencyCode',
            'allowedCurrencyCodes'
        ];
    }
    /**
     * Get fields that can always be changed
     */
    static getMutableFields() {
        return [
            'name',
            'userCode',
            'description',
            'status',
            'replacedByAccountId',
            'requiresApproval',
            'requiresCustodyConfirmation',
            'custodianUserId'
        ];
    }
    /**
     * Validate this account's state
     * Returns array of error messages (empty if valid)
     */
    validate() {
        const errors = [];
        // User code format
        const codeError = validateUserCodeFormat(this.userCode);
        if (codeError)
            errors.push(codeError);
        // Balance nature constraint
        const balanceError = validateBalanceNature(this.balanceNature, this.classification);
        if (balanceError)
            errors.push(balanceError);
        // Currency policy
        const currencyError = validateCurrencyPolicy(this.currencyPolicy, this.fixedCurrencyCode, this.allowedCurrencyCodes);
        if (currencyError)
            errors.push(currencyError);
        // Role vs children
        if (this._hasChildren && this.accountRole === 'POSTING') {
            errors.push('POSTING accounts cannot have children. Change to HEADER or remove children.');
        }
        return errors;
    }
    /**
     * Create a JSON representation for persistence
     */
    toJSON() {
        return {
            id: this.id,
            systemCode: this.systemCode,
            companyId: this.companyId,
            userCode: this.userCode,
            name: this.name,
            description: this.description,
            accountRole: this.accountRole,
            classification: this.classification,
            balanceNature: this.balanceNature,
            balanceEnforcement: this.balanceEnforcement,
            parentId: this.parentId,
            currencyPolicy: this.currencyPolicy,
            fixedCurrencyCode: this.fixedCurrencyCode,
            allowedCurrencyCodes: this.allowedCurrencyCodes,
            status: this.status,
            isProtected: this.isProtected,
            replacedByAccountId: this.replacedByAccountId,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
            updatedAt: this.updatedAt,
            updatedBy: this.updatedBy,
            requiresApproval: this.requiresApproval,
            requiresCustodyConfirmation: this.requiresCustodyConfirmation,
            custodianUserId: this.custodianUserId
        };
    }
    /**
     * Create an Account from raw data (persistence)
     */
    static fromJSON(data) {
        var _a;
        return new Account({
            id: data.id,
            systemCode: data.systemCode || data.code || data.id,
            companyId: data.companyId,
            userCode: data.userCode || data.code || data.id,
            name: data.name,
            description: data.description,
            accountRole: data.accountRole || (data.isParent || data.hasChildren ? 'HEADER' : 'POSTING'),
            classification: normalizeClassification(data.classification || data.type || 'ASSET'),
            balanceNature: data.balanceNature || getDefaultBalanceNature(normalizeClassification(data.classification || data.type || 'ASSET')),
            balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
            parentId: data.parentId,
            currencyPolicy: data.currencyPolicy || 'INHERIT',
            fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
            allowedCurrencyCodes: data.allowedCurrencyCodes || [],
            status: data.status || (data.active === false ? 'INACTIVE' : 'ACTIVE'),
            isProtected: (_a = data.isProtected) !== null && _a !== void 0 ? _a : false,
            replacedByAccountId: data.replacedByAccountId,
            createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt || Date.now()),
            createdBy: data.createdBy || 'SYSTEM',
            updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt || Date.now()),
            updatedBy: data.updatedBy || 'SYSTEM',
            requiresApproval: data.requiresApproval,
            requiresCustodyConfirmation: data.requiresCustodyConfirmation,
            custodianUserId: data.custodianUserId
        });
    }
}
exports.Account = Account;
//# sourceMappingURL=Account.js.map