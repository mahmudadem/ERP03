/**
 * Account Entity Tests
 * 
 * Tests for Account entity validation, normalization, and business methods.
 */

import {
  Account,
  normalizeUserCode,
  validateUserCodeFormat,
  normalizeClassification,
  getDefaultBalanceNature,
  validateBalanceNature,
  validateCurrencyPolicy
} from '../../../../domain/accounting/entities/Account';

describe('Account Entity', () => {
  // ==========================================================================
  // User Code Normalization Tests
  // ==========================================================================
  
  describe('normalizeUserCode', () => {
    it('should trim and uppercase the code', () => {
      expect(normalizeUserCode('  abc123  ')).toBe('ABC123');
    });

    it('should remove spaces', () => {
      expect(normalizeUserCode('ABC 123 DEF')).toBe('ABC123DEF');
    });

    it('should remove invalid characters', () => {
      expect(normalizeUserCode('ABC!@#$%^&*()123')).toBe('ABC123');
    });

    it('should allow dots, dashes, and underscores', () => {
      expect(normalizeUserCode('ABC-123.DEF_456')).toBe('ABC-123.DEF_456');
    });

    it('should return empty string for null/undefined', () => {
      expect(normalizeUserCode('')).toBe('');
      expect(normalizeUserCode(null as any)).toBe('');
    });
  });

  describe('validateUserCodeFormat', () => {
    it('should return error for empty code', () => {
      expect(validateUserCodeFormat('')).toBe('User code is required');
    });

    it('should return error for code with only invalid characters', () => {
      expect(validateUserCodeFormat('!@#$%')).toBeTruthy();
    });

    it('should return null for valid codes', () => {
      expect(validateUserCodeFormat('ABC123')).toBeNull();
      expect(validateUserCodeFormat('1001')).toBeNull();
      expect(validateUserCodeFormat('ACC-001')).toBeNull();
      expect(validateUserCodeFormat('ACC.001.CASH')).toBeNull();
      expect(validateUserCodeFormat('ACC_001')).toBeNull();
    });
  });

  // ==========================================================================
  // Classification Tests
  // ==========================================================================
  
  describe('normalizeClassification', () => {
    it('should accept valid classifications', () => {
      expect(normalizeClassification('ASSET')).toBe('ASSET');
      expect(normalizeClassification('LIABILITY')).toBe('LIABILITY');
      expect(normalizeClassification('EQUITY')).toBe('EQUITY');
      expect(normalizeClassification('REVENUE')).toBe('REVENUE');
      expect(normalizeClassification('EXPENSE')).toBe('EXPENSE');
    });

    it('should map INCOME to REVENUE (legacy compatibility)', () => {
      expect(normalizeClassification('INCOME')).toBe('REVENUE');
      expect(normalizeClassification('income')).toBe('REVENUE');
      expect(normalizeClassification('Income')).toBe('REVENUE');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeClassification('asset')).toBe('ASSET');
      expect(normalizeClassification('Asset')).toBe('ASSET');
    });

    it('should throw for invalid classifications', () => {
      expect(() => normalizeClassification('INVALID')).toThrow();
      expect(() => normalizeClassification('')).toThrow();
    });
  });

  // ==========================================================================
  // Balance Nature Tests
  // ==========================================================================
  
  describe('getDefaultBalanceNature', () => {
    it('should return DEBIT for ASSET and EXPENSE', () => {
      expect(getDefaultBalanceNature('ASSET')).toBe('DEBIT');
      expect(getDefaultBalanceNature('EXPENSE')).toBe('DEBIT');
    });

    it('should return CREDIT for LIABILITY, EQUITY, and REVENUE', () => {
      expect(getDefaultBalanceNature('LIABILITY')).toBe('CREDIT');
      expect(getDefaultBalanceNature('EQUITY')).toBe('CREDIT');
      expect(getDefaultBalanceNature('REVENUE')).toBe('CREDIT');
    });
  });

  describe('validateBalanceNature', () => {
    it('should allow BOTH for ASSET, LIABILITY, EQUITY', () => {
      expect(validateBalanceNature('BOTH', 'ASSET')).toBeNull();
      expect(validateBalanceNature('BOTH', 'LIABILITY')).toBeNull();
      expect(validateBalanceNature('BOTH', 'EQUITY')).toBeNull();
    });

    it('should reject BOTH for REVENUE and EXPENSE', () => {
      expect(validateBalanceNature('BOTH', 'REVENUE')).toBeTruthy();
      expect(validateBalanceNature('BOTH', 'EXPENSE')).toBeTruthy();
    });

    it('should allow DEBIT/CREDIT for all classifications', () => {
      const classifications = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
      for (const c of classifications) {
        expect(validateBalanceNature('DEBIT', c)).toBeNull();
        expect(validateBalanceNature('CREDIT', c)).toBeNull();
      }
    });
  });

  // ==========================================================================
  // Currency Policy Tests
  // ==========================================================================
  
  describe('validateCurrencyPolicy', () => {
    it('should require fixedCurrencyCode when policy is FIXED', () => {
      expect(validateCurrencyPolicy('FIXED', null, null)).toBeTruthy();
      expect(validateCurrencyPolicy('FIXED', '', null)).toBeTruthy();
      expect(validateCurrencyPolicy('FIXED', 'USD', null)).toBeNull();
    });

    it('should require allowedCurrencyCodes when policy is RESTRICTED', () => {
      expect(validateCurrencyPolicy('RESTRICTED', null, null)).toBeTruthy();
      expect(validateCurrencyPolicy('RESTRICTED', null, [])).toBeTruthy();
      expect(validateCurrencyPolicy('RESTRICTED', null, ['USD', 'EUR'])).toBeNull();
    });

    it('should allow INHERIT and OPEN without additional fields', () => {
      expect(validateCurrencyPolicy('INHERIT', null, null)).toBeNull();
      expect(validateCurrencyPolicy('OPEN', null, null)).toBeNull();
    });
  });

  // ==========================================================================
  // Account Entity Tests
  // ==========================================================================
  
  describe('Account class', () => {
    const baseProps = {
      id: 'uuid-123',
      systemCode: 'ACC-000001',
      companyId: 'company-1',
      userCode: '1001',
      name: 'Cash',
      accountRole: 'POSTING' as const,
      classification: 'ASSET' as const,
      balanceNature: 'DEBIT' as const,
      balanceEnforcement: 'WARN_ABNORMAL' as const,
      currencyPolicy: 'INHERIT' as const,
      status: 'ACTIVE' as const,
      isProtected: false,
      createdAt: new Date(),
      createdBy: 'user-1',
      updatedAt: new Date(),
      updatedBy: 'user-1'
    };

    it('should create an account with all properties', () => {
      const account = new Account(baseProps);
      expect(account.id).toBe('uuid-123');
      expect(account.systemCode).toBe('ACC-000001');
      expect(account.userCode).toBe('1001');
      expect(account.classification).toBe('ASSET');
      expect(account.accountRole).toBe('POSTING');
    });

    it('should provide legacy compatibility getters', () => {
      const account = new Account(baseProps);
      expect(account.code).toBe('1001');
      expect(account.type).toBe('ASSET');
      expect(account.active).toBe(true);
      expect(account.isActive).toBe(true);
    });

    it('should return true for canPost when POSTING, ACTIVE, and not replaced', () => {
      const account = new Account(baseProps);
      expect(account.canPost()).toBe(true);
    });

    it('should return false for canPost when HEADER role', () => {
      const account = new Account({ ...baseProps, accountRole: 'HEADER' });
      expect(account.canPost()).toBe(false);
    });

    it('should return false for canPost when INACTIVE', () => {
      const account = new Account({ ...baseProps, status: 'INACTIVE' });
      expect(account.canPost()).toBe(false);
    });

    it('should return false for canPost when replaced', () => {
      const account = new Account({ ...baseProps, replacedByAccountId: 'other-account' });
      expect(account.canPost()).toBe(false);
    });

    it('should validate successfully for a valid account', () => {
      const account = new Account(baseProps);
      const errors = account.validate();
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for BOTH with REVENUE', () => {
      const account = new Account({
        ...baseProps,
        classification: 'REVENUE',
        balanceNature: 'BOTH'
      });
      const errors = account.validate();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('BOTH');
    });

    it('should serialize to JSON correctly', () => {
      const account = new Account(baseProps);
      const json = account.toJSON();
      expect(json.id).toBe('uuid-123');
      expect(json.systemCode).toBe('ACC-000001');
      expect(json.classification).toBe('ASSET');
    });

    it('should deserialize from JSON with legacy fields', () => {
      const legacyData = {
        id: 'legacy-id',
        code: '1001',
        name: 'Cash',
        type: 'INCOME', // Should map to REVENUE
        companyId: 'company-1',
        active: false
      };
      const account = Account.fromJSON(legacyData);
      expect(account.userCode).toBe('1001');
      expect(account.systemCode).toBe('1001'); // Fallback
      expect(account.classification).toBe('REVENUE'); // Mapped from INCOME
      expect(account.status).toBe('INACTIVE'); // From active: false
    });
  });
});
