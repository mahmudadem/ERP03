/**
 * Account model re-export
 * Provides backward compatibility exports for legacy code
 */
export { 
  Account, 
  AccountProps,
  AccountClassification,
  AccountRole,
  BalanceNature,
  BalanceEnforcement,
  AccountStatus,
  CurrencyPolicy,
  AccountType,
  normalizeUserCode,
  validateUserCodeFormat,
  normalizeClassification,
  getDefaultBalanceNature,
  validateBalanceNature,
  validateCurrencyPolicy
} from '../entities/Account';
