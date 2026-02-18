import { FiscalYear, FiscalYearStatus, PeriodStatus } from '../../../../domain/accounting/entities/FiscalYear';

const buildYear = () =>
  new FiscalYear(
    'FY2026',
    'c1',
    'Fiscal Year 2026',
    '2026-01-01',
    '2026-12-31',
    FiscalYearStatus.OPEN,
    [
      { id: '2026-01', name: 'Jan', startDate: '2026-01-01', endDate: '2026-01-31', status: PeriodStatus.OPEN, periodNo: 1, isSpecial: false },
      { id: '2026-02', name: 'Feb', startDate: '2026-02-01', endDate: '2026-02-28', status: PeriodStatus.OPEN, periodNo: 2, isSpecial: false },
    ]
  );

describe('FiscalYear entity', () => {
  it('locates period for date', () => {
    const fy = buildYear();
    expect(fy.getPeriodForDate('2026-01-15')?.id).toBe('2026-01');
    expect(fy.getPeriodForDate('2026-02-10')?.id).toBe('2026-02');
    expect(fy.getPeriodForDate('2025-12-31')).toBeUndefined();
  });

  it('marks periods closed and reopened immutably', () => {
    const fy = buildYear();
    const closed = fy.closePeriod('2026-01', 'u1');
    expect(closed.getPeriodForDate('2026-01-15')?.status).toBe(PeriodStatus.CLOSED);
    const reopened = closed.reopenPeriod('2026-01');
    expect(reopened.getPeriodForDate('2026-01-15')?.status).toBe(PeriodStatus.OPEN);
  });

  it('isDatePostable respects open status', () => {
    const fy = buildYear();
    expect(fy.isDatePostable('2026-01-05')).toBe(true);
    const closed = fy.closePeriod('2026-01', 'u1');
    expect(closed.isDatePostable('2026-01-05')).toBe(false);
  });
});
