/**
 * Account Entity
 * 
 * Chart of Accounts domain entity with full specification compliance.
 * Implements: Identity, Classification, Role, Balance controls, Currency policy, Audit.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountRole = 'HEADER' | 'POSTING';
export type BalanceNature = 'DEBIT' | 'CREDIT' | 'BOTH';
export type BalanceEnforcement = 'ALLOW_ABNORMAL' | 'WARN_ABNORMAL' | 'BLOCK_ABNORMAL';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';
export type CurrencyPolicy = 'INHERIT' | 'FIXED' | 'OPEN' | 'RESTRICTED';

// Legacy compatibility - map to new enum
export type AccountType = AccountClassification;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Normalize user code: trim, uppercase, replace any invalid chars
 * Allowed: A-Z, 0-9, '.', '-', '_'
 */
export function normalizeUserCode(code: string): string {
  if (!code) return '';
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^A-Z0-9.\-_]/g, ''); // Remove invalid chars
}

/**
 * Validate user code format
 * Returns error message or null if valid
 */
export function validateUserCodeFormat(code: string): string | null {
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

/**
 * Map legacy INCOME to REVENUE
 */
export function normalizeClassification(input: string): AccountClassification {
  const upper = (input || '').toUpperCase().trim();
  if (upper === 'INCOME') return 'REVENUE';
  if (['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(upper)) {
    return upper as AccountClassification;
  }
  throw new Error(`Invalid classification: ${input}. Must be ASSET, LIABILITY, EQUITY, REVENUE, or EXPENSE.`);
}

/**
 * Get default balance nature for a classification
 */
export function getDefaultBalanceNature(classification: AccountClassification): BalanceNature {
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

/**
 * Validate balance nature against classification
 * BOTH is only allowed for ASSET, LIABILITY, EQUITY
 */
export function validateBalanceNature(
  balanceNature: BalanceNature,
  classification: AccountClassification
): string | null {
  if (balanceNature === 'BOTH') {
    if (classification === 'REVENUE' || classification === 'EXPENSE') {
      return `Balance nature BOTH is not allowed for ${classification} accounts. Use DEBIT or CREDIT.`;
    }
  }
  return null;
}

/**
 * Validate currency policy requirements
 */
export function validateCurrencyPolicy(
  policy: CurrencyPolicy,
  fixedCurrencyCode?: string | null,
  allowedCurrencyCodes?: string[] | null
): string | null {
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

// ============================================================================
// ACCOUNT ENTITY
// ============================================================================

export interface AccountProps {
  // Identity (immutable)
  id: string;
  systemCode: string;
  companyId: string;
  
  // User-editable identity
  userCode: string;
  name: string;
  description?: string | null;
  
  // Accounting semantics
  accountRole: AccountRole;
  classification: AccountClassification;
  balanceNature: BalanceNature;
  balanceEnforcement: BalanceEnforcement;
  
  // Hierarchy
  parentId?: string | null;
  
  // Currency
  currencyPolicy: CurrencyPolicy;
  fixedCurrencyCode?: string | null;
  allowedCurrencyCodes?: string[] | null;
  
  // Lifecycle
  status: AccountStatus;
  isProtected: boolean;
  replacedByAccountId?: string | null;
  
  // Audit
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  
  // Legacy compat fields (optional, for approval policy)
  requiresApproval?: boolean;
  requiresCustodyConfirmation?: boolean;
  custodianUserId?: string | null;
}

export class Account {
  // Identity (immutable)
  readonly id: string;
  readonly systemCode: string;
  readonly companyId: string;
  readonly createdAt: Date;
  readonly createdBy: string;
  
  // User-editable identity
  userCode: string;
  name: string;
  description: string | null;
  
  // Accounting semantics
  accountRole: AccountRole;
  classification: AccountClassification;
  balanceNature: BalanceNature;
  balanceEnforcement: BalanceEnforcement;
  
  // Hierarchy
  parentId: string | null;
  
  // Currency
  currencyPolicy: CurrencyPolicy;
  fixedCurrencyCode: string | null;
  allowedCurrencyCodes: string[];
  
  // Lifecycle
  status: AccountStatus;
  isProtected: boolean;
  replacedByAccountId: string | null;
  
  // Audit
  updatedAt: Date;
  updatedBy: string;
  
  // Runtime flags (computed, not persisted directly)
  private _hasChildren: boolean = false;
  private _isUsed: boolean = false;
  
  // Legacy compat fields
  requiresApproval: boolean;
  requiresCustodyConfirmation: boolean;
  custodianUserId: string | null;
  
  constructor(props: AccountProps) {
    // Identity
    this.id = props.id;
    this.systemCode = props.systemCode;
    this.companyId = props.companyId;
    this.createdAt = props.createdAt;
    this.createdBy = props.createdBy;
    
    // User-editable
    this.userCode = props.userCode;
    this.name = props.name;
    this.description = props.description ?? null;
    
    // Semantics
    this.accountRole = props.accountRole;
    this.classification = props.classification;
    this.balanceNature = props.balanceNature;
    this.balanceEnforcement = props.balanceEnforcement;
    
    // Hierarchy
    this.parentId = props.parentId ?? null;
    
    // Currency
    this.currencyPolicy = props.currencyPolicy;
    this.fixedCurrencyCode = props.fixedCurrencyCode ?? null;
    this.allowedCurrencyCodes = props.allowedCurrencyCodes ?? [];
    
    // Lifecycle
    this.status = props.status;
    this.isProtected = props.isProtected;
    this.replacedByAccountId = props.replacedByAccountId ?? null;
    
    // Audit
    this.updatedAt = props.updatedAt;
    this.updatedBy = props.updatedBy;
    
    // Legacy
    this.requiresApproval = props.requiresApproval ?? false;
    this.requiresCustodyConfirmation = props.requiresCustodyConfirmation ?? false;
    this.custodianUserId = props.custodianUserId ?? null;
  }
  
  // =========================================================================
  // COMPUTED PROPERTIES (Legacy compatibility)
  // =========================================================================
  
  /** Legacy: alias for userCode */
  get code(): string {
    return this.userCode;
  }
  
  /** Legacy: alias for classification */
  get type(): AccountClassification {
    return this.classification;
  }
  
  /** Legacy: get currency (from fixedCurrencyCode or empty) */
  get currency(): string {
    return this.fixedCurrencyCode || '';
  }
  
  /** Legacy: active boolean based on status */
  get active(): boolean {
    return this.status === 'ACTIVE';
  }
  
  /** Legacy: isActive alias */
  get isActive(): boolean {
    return this.status === 'ACTIVE';
  }
  
  /** Runtime: whether account has children */
  get hasChildren(): boolean {
    return this._hasChildren;
  }
  
  /** Runtime: whether account is a parent (has children) */
  get isParent(): boolean {
    return this._hasChildren;
  }
  
  /** Runtime: whether account has been used in vouchers */
  get isUsed(): boolean {
    return this._isUsed;
  }
  
  // =========================================================================
  // RUNTIME SETTERS (called by repository/use-case)
  // =========================================================================
  
  setHasChildren(value: boolean): void {
    this._hasChildren = value;
    // If has children, must be HEADER
    if (value && this.accountRole !== 'HEADER') {
      console.warn(`Account ${this.userCode} has children but role is ${this.accountRole}. Should be HEADER.`);
    }
  }
  
  setIsUsed(value: boolean): void {
    this._isUsed = value;
  }
  
  // =========================================================================
  // BUSINESS METHODS
  // =========================================================================
  
  /**
   * Check if account can be used for posting (voucher lines)
   */
  canPost(): boolean {
    return (
      this.accountRole === 'POSTING' &&
      this.status === 'ACTIVE' &&
      this.replacedByAccountId === null
    );
  }
  
  /**
   * Get immutable fields that cannot change after USED
   */
  static getUsedImmutableFields(): string[] {
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
  static getMutableFields(): string[] {
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
  validate(): string[] {
    const errors: string[] = [];
    
    // User code format
    const codeError = validateUserCodeFormat(this.userCode);
    if (codeError) errors.push(codeError);
    
    // Balance nature constraint
    const balanceError = validateBalanceNature(this.balanceNature, this.classification);
    if (balanceError) errors.push(balanceError);
    
    // Currency policy
    const currencyError = validateCurrencyPolicy(
      this.currencyPolicy,
      this.fixedCurrencyCode,
      this.allowedCurrencyCodes
    );
    if (currencyError) errors.push(currencyError);
    
    // Role vs children
    if (this._hasChildren && this.accountRole === 'POSTING') {
      errors.push('POSTING accounts cannot have children. Change to HEADER or remove children.');
    }
    
    return errors;
  }
  
  /**
   * Create a JSON representation for persistence
   */
  toJSON(): Record<string, any> {
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
  static fromJSON(data: any): Account {
    return new Account({
      id: data.id,
      systemCode: data.systemCode || data.code || data.id, // Fallback for migration
      companyId: data.companyId,
      userCode: data.userCode || data.code || data.id, // Fallback for migration
      name: data.name,
      description: data.description,
      accountRole: data.accountRole || (data.isParent || data.hasChildren ? 'HEADER' : 'POSTING'),
      classification: normalizeClassification(data.classification || data.type || 'ASSET'),
      balanceNature: data.balanceNature || getDefaultBalanceNature(
        normalizeClassification(data.classification || data.type || 'ASSET')
      ),
      balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
      parentId: data.parentId,
      currencyPolicy: data.currencyPolicy || 'INHERIT',
      fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
      allowedCurrencyCodes: data.allowedCurrencyCodes || [],
      status: data.status || (data.active === false ? 'INACTIVE' : 'ACTIVE'),
      isProtected: data.isProtected ?? false,
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
