import {
  SubledgerDocumentPoster,
  SubledgerPostingPlan,
  SubledgerPostingEntry,
  ISubledgerPostingService,
} from '../../../application/accounting/services/SubledgerDocumentPoster';
import { VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { AccountMappingError } from '../../../domain/accounting/errors/AccountMappingError';

/** Minimal plan builder so each test only states what it cares about. */
function makePlan(entries: SubledgerPostingEntry[], overrides: Partial<SubledgerPostingPlan> = {}): SubledgerPostingPlan {
  return {
    companyId: 'co-1',
    voucherType: VoucherType.PURCHASE_INVOICE,
    voucherNo: 'PI-1',
    date: '2026-06-07',
    description: 'test',
    currency: 'SYP',
    exchangeRate: 1,
    createdBy: 'user-1',
    approved: true,
    entries,
    ...overrides,
  };
}

const debit = (accountId: string | undefined, base: number, doc = base, extra: Partial<SubledgerPostingEntry> = {}): SubledgerPostingEntry => ({
  role: 'expense', accountId, side: 'Debit', baseAmount: base, docAmount: doc, ...extra,
});
const credit = (accountId: string | undefined, base: number, doc = base, extra: Partial<SubledgerPostingEntry> = {}): SubledgerPostingEntry => ({
  role: 'ap', accountId, side: 'Credit', baseAmount: base, docAmount: doc, ...extra,
});

describe('SubledgerDocumentPoster.assembleLines (Task 178 Stage A)', () => {
  const poster = new SubledgerDocumentPoster({} as ISubledgerPostingService);

  it('assembles a simple balanced two-line voucher', () => {
    const lines = poster.assembleLines(makePlan([debit('inv-acct', 100), credit('ap-acct', 100)]));
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.accountId === 'inv-acct')).toMatchObject({ side: 'Debit', baseAmount: 100 });
    expect(lines.find((l) => l.accountId === 'ap-acct')).toMatchObject({ side: 'Credit', baseAmount: 100 });
  });

  it('preserves caller granularity — same account + side stays as separate lines', () => {
    // PI posts one debit line per source line for drill-down; the poster must
    // NOT silently merge them.
    const lines = poster.assembleLines(makePlan([
      debit('inv-acct', 60),
      debit('inv-acct', 40),
      credit('ap-acct', 100),
    ]));
    expect(lines).toHaveLength(3);
    expect(lines.filter((l) => l.accountId === 'inv-acct')).toHaveLength(2);
  });

  it('drops zero-amount entries before assembly', () => {
    const lines = poster.assembleLines(makePlan([
      debit('inv-acct', 100),
      debit('tax-acct', 0, 0), // zero tax → contributes nothing
      credit('ap-acct', 100),
    ]));
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.accountId === 'tax-acct')).toBe(false);
  });

  it('throws AccountMappingError when a non-zero entry has no account', () => {
    try {
      poster.assembleLines(makePlan([
        debit('inv-acct', 100),
        { role: 'tax', accountId: undefined, side: 'Debit', baseAmount: 10, docAmount: 10,
          missingAccountContext: { lineNo: 1, fallbackChain: ['taxCode.purchaseTaxAccountId'], hint: 'configure it' } },
        credit('ap-acct', 110),
      ]));
      fail('expected AccountMappingError');
    } catch (err) {
      expect(err).toBeInstanceOf(AccountMappingError);
      expect((err as AccountMappingError).message).toContain('tax');
    }
  });

  it('does NOT throw for a missing account on a ZERO-amount entry (unused role)', () => {
    expect(() =>
      poster.assembleLines(makePlan([
        debit('inv-acct', 100),
        { role: 'tax', accountId: undefined, side: 'Debit', baseAmount: 0, docAmount: 0 },
        credit('ap-acct', 100),
      ]))
    ).not.toThrow();
  });

  it('throws when the assembled lines do not balance in base currency', () => {
    expect(() =>
      poster.assembleLines(makePlan([debit('inv-acct', 100), credit('ap-acct', 90)]))
    ).toThrow(/not balanced in base currency/);
  });

  it('throws when document-currency totals do not balance', () => {
    expect(() =>
      poster.assembleLines(makePlan([
        debit('inv-acct', 100, 10),
        credit('ap-acct', 100, 11), // base balances, doc does not
      ]))
    ).toThrow(/not balanced in document currency/);
  });

  it('throws when fewer than two lines survive assembly', () => {
    expect(() =>
      poster.assembleLines(makePlan([debit('inv-acct', 0, 0), credit('ap-acct', 0, 0)]))
    ).toThrow(/at least two lines/);
  });
});

describe('SubledgerDocumentPoster.accumulateByAccount (Task 178 Stage A)', () => {
  it('sums entries that share the same account + side into one entry', () => {
    const folded = SubledgerDocumentPoster.accumulateByAccount([
      debit('rev', 60), debit('rev', 40), credit('ar', 100),
    ]);
    expect(folded).toHaveLength(2);
    expect(folded.find((e) => e.accountId === 'rev')!.baseAmount).toBe(100);
  });

  it('keeps opposite sides of the same account separate', () => {
    const folded = SubledgerDocumentPoster.accumulateByAccount([
      debit('x', 30), credit('x', 10),
    ]);
    expect(folded).toHaveLength(2);
  });

  it('passes through entries with no account so assembleLines can still raise AccountMappingError', () => {
    const folded = SubledgerDocumentPoster.accumulateByAccount([
      { role: 'tax', accountId: undefined, side: 'Debit', baseAmount: 10, docAmount: 10 },
      debit('inv', 100),
    ]);
    expect(folded.some((e) => e.accountId === undefined)).toBe(true);
  });
});

describe('SubledgerDocumentPoster.post (Task 178 Stage A)', () => {
  it('hands the assembled lines + forwarded flags to the posting service', async () => {
    const calls: any[] = [];
    const mockService: ISubledgerPostingService = {
      async postInTransaction(input) {
        calls.push(input);
        return { id: 'voucher-123' };
      },
    };
    const poster = new SubledgerDocumentPoster(mockService);

    const result = await poster.post(
      makePlan([debit('inv-acct', 100), credit('ap-acct', 100)], {
        approved: false,
        postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
        metadata: { sourceModule: 'purchases' },
      })
    );

    expect(result.id).toBe('voucher-123');
    expect(calls).toHaveLength(1);
    expect(calls[0].lines).toHaveLength(2);
    expect(calls[0].approved).toBe(false); // real approval state forwarded (Law 7)
    expect(calls[0].postingLockPolicy).toBe(PostingLockPolicy.FLEXIBLE_LOCKED);
    expect(calls[0].metadata).toMatchObject({ sourceModule: 'purchases' });
  });

  it('does not call the posting service when assembly fails (missing account)', async () => {
    const calls: any[] = [];
    const mockService: ISubledgerPostingService = {
      async postInTransaction(input) { calls.push(input); return { id: 'x' }; },
    };
    const poster = new SubledgerDocumentPoster(mockService);

    await expect(
      poster.post(makePlan([
        { role: 'tax', accountId: undefined, side: 'Debit', baseAmount: 10, docAmount: 10 },
        credit('ap-acct', 10),
      ]))
    ).rejects.toBeInstanceOf(AccountMappingError);
    expect(calls).toHaveLength(0); // nothing posted
  });
});
