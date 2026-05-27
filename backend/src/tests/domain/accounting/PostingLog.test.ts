import { describe, it, expect } from '@jest/globals';
import { PostingLog, LineDecision } from '../../../domain/accounting/entities/PostingLog';

const baseDecisions: LineDecision[] = [
  {
    lineNo: 1,
    itemId: 'item-1',
    accounts: {
      revenue: { resolvedId: 'acc-rev', fallbackLevel: 'item' },
      tax: { resolvedId: 'acc-tax', fallbackLevel: 'taxCode' },
      cogs: { resolvedId: 'acc-cogs', fallbackLevel: 'category' },
      inventory: { resolvedId: 'acc-inv', fallbackLevel: 'inventorySettings' },
    },
    cogsPostingStatus: 'POSTED',
  },
];

const baseProps = {
  id: 'log-1',
  companyId: 'cmp-1',
  sourceModule: 'sales' as const,
  sourceType: 'SALES_INVOICE' as const,
  sourceId: 'si-1',
  sourceDocNumber: 'SI-00001',
  strategy: 'SalesInvoiceStrategy',
  voucherIds: ['v-1', 'v-2'],
  decisions: baseDecisions,
  warnings: [],
  postedAt: new Date('2026-05-19T12:00:00Z'),
  postedBy: 'user-1',
};

describe('PostingLog entity', () => {
  it('constructs with all required fields', () => {
    const log = new PostingLog(baseProps);
    expect(log.id).toBe('log-1');
    expect(log.companyId).toBe('cmp-1');
    expect(log.sourceModule).toBe('sales');
    expect(log.voucherIds).toHaveLength(2);
    expect(log.decisions).toHaveLength(1);
    expect(log.decisions[0].cogsPostingStatus).toBe('POSTED');
  });

  it('throws when id is missing', () => {
    expect(() => new PostingLog({ ...baseProps, id: '' })).toThrow('PostingLog id is required');
  });

  it('throws when companyId is missing', () => {
    expect(() => new PostingLog({ ...baseProps, companyId: '' })).toThrow('PostingLog companyId is required');
  });

  it('throws when sourceId is missing', () => {
    expect(() => new PostingLog({ ...baseProps, sourceId: '' })).toThrow('PostingLog sourceId is required');
  });

  it('throws when strategy is missing', () => {
    expect(() => new PostingLog({ ...baseProps, strategy: '' })).toThrow('PostingLog strategy is required');
  });

  it('defensively copies arrays so external mutations cannot leak in', () => {
    const props = {
      ...baseProps,
      voucherIds: ['v-1'],
      warnings: ['initial warning'],
      decisions: [{ ...baseDecisions[0] }],
    };
    const log = new PostingLog(props);
    props.voucherIds.push('v-injected');
    props.warnings.push('injected warning');
    expect(log.voucherIds).toEqual(['v-1']);
    expect(log.warnings).toEqual(['initial warning']);
  });

  it('serializes to JSON with all fields', () => {
    const log = new PostingLog({ ...baseProps, warnings: ['Line 2 unsettled cost'] });
    const json = log.toJSON();
    expect(json).toMatchObject({
      id: 'log-1',
      sourceModule: 'sales',
      sourceType: 'SALES_INVOICE',
      sourceId: 'si-1',
      strategy: 'SalesInvoiceStrategy',
      voucherIds: ['v-1', 'v-2'],
      warnings: ['Line 2 unsettled cost'],
    });
    expect(json.decisions).toHaveLength(1);
    expect(json.decisions[0].accounts.revenue).toEqual({
      resolvedId: 'acc-rev',
      fallbackLevel: 'item',
    });
  });

  it('accepts SKIPPED_* status values on decisions', () => {
    const log = new PostingLog({
      ...baseProps,
      decisions: [
        { lineNo: 1, accounts: {}, cogsPostingStatus: 'SKIPPED_SERVICE_ITEM' },
        { lineNo: 2, accounts: {}, cogsPostingStatus: 'SKIPPED_POSTED_AT_DN' },
        { lineNo: 3, accounts: {}, cogsPostingStatus: 'SKIPPED_UNSETTLED_COST' },
        { lineNo: 4, accounts: {}, cogsPostingStatus: 'SKIPPED_DEFERRED_POLICY' },
      ],
    });
    const statuses = log.decisions.map((d) => d.cogsPostingStatus);
    expect(statuses).toEqual([
      'SKIPPED_SERVICE_ITEM',
      'SKIPPED_POSTED_AT_DN',
      'SKIPPED_UNSETTLED_COST',
      'SKIPPED_DEFERRED_POLICY',
    ]);
  });
});
