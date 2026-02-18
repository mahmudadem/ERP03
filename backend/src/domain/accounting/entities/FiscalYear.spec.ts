
import { FiscalYear, FiscalPeriod, FiscalYearStatus, PeriodStatus, PeriodScheme } from './FiscalYear';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

describe('FiscalYear Entity', () => {
  const createFY = (specialPeriods: number = 0) => {
    const periods: FiscalPeriod[] = [];
    // Regular periods 1-12
    for (let i = 1; i <= 12; i++) {
        const endDay = i === 12 ? '31' : '28';
        periods.push({
            id: `p${i}`,
            name: `Period ${i}`,
            periodNo: i,
            startDate: `2024-${String(i).padStart(2, '0')}-01`,
            endDate: `2024-${String(i).padStart(2, '0')}-${endDay}`,
            status: i === 12 ? PeriodStatus.CLOSED : PeriodStatus.OPEN, // P12 Closed for testing overlap
            isSpecial: false
        });
    }
    // Special periods 13+
    for (let i = 1; i <= specialPeriods; i++) {
        periods.push({
            id: `p${12 + i}`,
            name: `Special Period ${12 + i}`,
            periodNo: 12 + i,
            startDate: '2024-12-31',
            endDate: '2024-12-31',
            status: PeriodStatus.OPEN,
            isSpecial: true
        });
    }

    return new FiscalYear(
        'fy1',
        'c1',
        'FY 2024',
        '2024-01-01',
        '2024-12-31',
        FiscalYearStatus.OPEN,
        periods,
        undefined,
        new Date(),
        'admin',
        PeriodScheme.MONTHLY,
        specialPeriods
    );
  };

  test('Regular date resolves to regular period', () => {
    const fy = createFY(0);
    const p = fy.getPeriodForDate('2024-06-15');
    expect(p).toBeDefined();
    expect(p?.periodNo).toBe(6);
  });

  test('End date resolves to regular period by default (even if special exists)', () => {
    const fy = createFY(1); // Have P13
    const p = fy.getPeriodForDate('2024-12-31');
    expect(p).toBeDefined();
    expect(p?.periodNo).toBe(12); // P12 ends on 31st
    expect(p?.isSpecial).toBe(false);
  });

  test('Explicit special period request on End Date succeeds', () => {
    const fy = createFY(1);
    const p = fy.getPeriodForDate('2024-12-31', 13);
    expect(p).toBeDefined();
    expect(p?.periodNo).toBe(13);
    expect(p?.isSpecial).toBe(true);
  });

  test('Explicit special period request on non-End Date throws BusinessError', () => {
    const fy = createFY(1);
    expect(() => {
        fy.getPeriodForDate('2024-06-15', 13);
    }).toThrow(BusinessError);

    try {
        fy.getPeriodForDate('2024-06-15', 13);
    } catch (e: any) {
        expect(e).toBeInstanceOf(BusinessError);
        expect(e.code).toBe(ErrorCode.INVALID_SPECIAL_PERIOD_USAGE);
    }
  });

  test('Mixed status: P12 Closed, P13 Open', () => {
    const fy = createFY(1);
    // 1. Trying to post to regular P12 (implicitly) -> Should be closed
    const p12 = fy.getPeriodForDate('2024-12-31');
    expect(p12?.periodNo).toBe(12);
    expect(p12?.status).toBe(PeriodStatus.CLOSED);
    expect(fy.isDatePostable('2024-12-31')).toBe(false);

    // 2. Trying to post to special P13 (explicitly) -> Should be open
    const p13 = fy.getPeriodForDate('2024-12-31', 13);
    expect(p13?.periodNo).toBe(13);
    expect(p13?.status).toBe(PeriodStatus.OPEN);
    expect(fy.isDatePostable('2024-12-31', 13)).toBe(true);
  });
});
