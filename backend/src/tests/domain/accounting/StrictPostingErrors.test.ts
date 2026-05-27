import { describe, it, expect } from '@jest/globals';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';
import { PersonaNotAllowedError } from '../../../domain/accounting/errors/PersonaNotAllowedError';
import { UnsettledCostError } from '../../../domain/inventory/errors/UnsettledCostError';

describe('AccountMappingError', () => {
  it('serializes with role-specific code', () => {
    const err = new AccountMappingError({
      companyId: 'cmp-1',
      itemId: 'item-1',
      accountRole: 'cogs',
      fallbackChain: ['item.cogsAccountId', 'category.defaultCogsAccountId'],
      lineNo: 3,
    });
    expect(err.name).toBe('AccountMappingError');
    const payload = err.toJSON() as any;
    expect(payload.error.code).toBe('ACCOUNT_MAPPING_MISSING');
    expect(payload.error.details.violations[0].code).toBe('ACCOUNT_MAPPING_MISSING_COGS');
    expect(payload.error.message).toContain('No cogs account configured');
    expect(payload.error.message).toContain('line 3');
    expect(payload.error.message).toContain('item.cogsAccountId → category.defaultCogsAccountId');
  });

  it('includes hint when supplied', () => {
    const err = new AccountMappingError({
      companyId: 'cmp-1',
      accountRole: 'tax',
      fallbackChain: ['taxCode.salesTaxAccountId'],
      hint: 'Tax code TX-01 needs salesTaxAccountId configured.',
    });
    expect(err.message).toContain('Tax code TX-01 needs salesTaxAccountId configured.');
  });
});

describe('PersonaNotAllowedError', () => {
  it('encodes module and persona', () => {
    const err = new PersonaNotAllowedError({
      companyId: 'cmp-1',
      module: 'sales',
      persona: 'direct',
      formType: 'sales_invoice_direct',
    });
    expect(err.name).toBe('PersonaNotAllowedError');
    const payload = err.toJSON() as any;
    expect(payload.error.code).toBe('PERSONA_NOT_ALLOWED');
    expect(payload.error.category).toBe('POLICY');
    expect(payload.error.message).toContain("persona 'direct'");
    expect(payload.error.message).toContain('sales_invoice_direct');
  });
});

describe('UnsettledCostError', () => {
  it('points users at the recovery paths', () => {
    const err = new UnsettledCostError({
      companyId: 'cmp-1',
      itemId: 'item-9',
      lineNo: 1,
    });
    expect(err.name).toBe('UnsettledCostError');
    const payload = err.toJSON() as any;
    expect(payload.error.code).toBe('UNSETTLED_COST_BLOCKED');
    expect(payload.error.message).toContain('no recorded cost basis');
    expect(payload.error.message).toContain('allowDeferredCost');
  });
});
