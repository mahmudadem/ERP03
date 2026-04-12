
/**
 * ERP Code Generator Utility
 * Handles prefix-aware auto-incrementing of codes (e.g., CUST-001 -> CUST-002)
 */

export interface CodeGenConfig {
  prefix: string;
  padding: number;
}

export const generateNextCode = (existingCodes: string[], config: CodeGenConfig): string => {
  const { prefix, padding } = config;
  
  if (!existingCodes || existingCodes.length === 0) {
    return `${prefix}${String(1).padStart(padding, '0')}`;
  }

  // Filter codes that match the prefix and have a numeric suffix
  const numericParts = existingCodes
    .map(code => {
      if (!code || !code.startsWith(prefix)) return -1;
      const suffix = code.substring(prefix.length);
      const num = parseInt(suffix, 10);
      return isNaN(num) ? -1 : num;
    })
    .filter(num => num !== -1);

  const lastNum = numericParts.length > 0 ? Math.max(...numericParts) : 0;
  const nextNum = lastNum + 1;

  return `${prefix}${String(nextNum).padStart(padding, '0')}`;
};

/**
 * Common ERP Prefixes Configuration
 */
export const CODE_PATTERNS = {
  ITEM: { prefix: 'ITM-', padding: 4 },
  CUSTOMER: { prefix: 'CUST-', padding: 4 },
  VENDOR: { prefix: 'SUP-', padding: 4 },
  WAREHOUSE: { prefix: 'WH-', padding: 3 },
};
