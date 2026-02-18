import { FiscalPeriodGenerator } from './FiscalPeriodGenerator';
import { PeriodScheme } from '../entities/FiscalYear';

describe('FiscalPeriodGenerator', () => {
  const toDate = (s: string) => new Date(s);

  describe('MONTHLY Scheme', () => {
    it('generates 12 periods for Calendar Year (Jan start)', () => {
      const start = new Date(2026, 0, 1); // Jan 1 2026
      const end = new Date(2026, 11, 31); // Dec 31 2026
      
      const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.MONTHLY);
      
      expect(periods).toHaveLength(12);
      expect(periods[0].id).toBe('FY2026-P01');
      expect(periods[0].startDate).toBe('2026-01-01');
      expect(periods[0].endDate).toBe('2026-01-31');
      expect(periods[11].id).toBe('FY2026-P12');
      expect(periods[11].startDate).toBe('2026-12-01');
      expect(periods[11].endDate).toBe('2026-12-31');
      
      // Full Coverage & Contiguity
      expect(periods[0].startDate).toBe('2026-01-01');
      expect(periods[11].endDate).toBe('2026-12-31');
      for(let i=0; i<periods.length-1; i++) {
        const currEnd = new Date(periods[i].endDate);
        const nextStart = new Date(periods[i+1].startDate);
        currEnd.setDate(currEnd.getDate() + 1);
        expect(currEnd.toISOString().split('T')[0]).toBe(periods[i+1].startDate); // Contiguity
        expect(periods[i].endDate < periods[i+1].startDate).toBe(true); // No overlap (string compare works for ISO)
      }
    });

    it('generates 12 periods for Off-Calendar Year (Jul start)', () => {
      const start = new Date(2026, 6, 1); // Jul 1 2026
      const end = new Date(2027, 5, 30); // Jun 30 2027
      
      const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.MONTHLY);
      
      expect(periods).toHaveLength(12);
      expect(periods[0].id).toBe('FY2027-P01'); // ID derives from End Year (2027)
      expect(periods[0].startDate).toBe('2026-07-01');
      expect(periods[11].id).toBe('FY2027-P12');
      expect(periods[11].endDate).toBe('2027-06-30');
    });
  });

  describe('QUARTERLY Scheme', () => {
    it('generates 4 periods for Calendar Year', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      
      const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.QUARTERLY);
      
      expect(periods).toHaveLength(4);
      // Q1: Jan-Mar
      expect(periods[0].id).toBe('FY2026-P01');
      expect(periods[0].name).toContain('Q1');
      expect(periods[0].startDate).toBe('2026-01-01');
      expect(periods[0].endDate).toBe('2026-03-31');
      
      // Q4: Oct-Dec
      expect(periods[3].id).toBe('FY2026-P04');
      expect(periods[3].name).toContain('Q4');
      expect(periods[3].startDate).toBe('2026-10-01');
      expect(periods[3].endDate).toBe('2026-12-31');
    });

    it('generates 4 periods for Off-Calendar Year (Jul start)', () => {
      const start = new Date(2026, 6, 1);
      const end = new Date(2027, 5, 30);
      
      const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.QUARTERLY);
      
      expect(periods).toHaveLength(4);
      // Q1: Jul-Sep
      expect(periods[0].id).toBe('FY2027-P01');
      expect(periods[0].startDate).toBe('2026-07-01');
      expect(periods[0].endDate).toBe('2026-09-30');
      
      // Q4: Apr-Jun
      expect(periods[3].id).toBe('FY2027-P04');
      expect(periods[3].startDate).toBe('2027-04-01');
      expect(periods[3].endDate).toBe('2027-06-30');
    });
  });

  describe('SEMI_ANNUAL Scheme', () => {
    it('generates 2 periods', () => {
      const start = new Date(2026, 0, 1);
      const end = new Date(2026, 11, 31);
      
      const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.SEMI_ANNUAL);
      
      expect(periods).toHaveLength(2);
      expect(periods[0].id).toBe('FY2026-P01');
      expect(periods[0].name).toContain('H1');
      expect(periods[0].endDate).toBe('2026-06-30');
      
      expect(periods[1].id).toBe('FY2026-P02');
      expect(periods[1].name).toContain('H2');
      expect(periods[1].startDate).toBe('2026-07-01');
      expect(periods[1].endDate).toBe('2026-12-31');
    });
  });
  
  describe('ID Format', () => {
      it('matches FY{EndYear}-P{NN}', () => {
          const start = new Date(2025, 0, 1);
          const end = new Date(2025, 11, 31);
          const periods = FiscalPeriodGenerator.generate(start, end, PeriodScheme.MONTHLY);
          const regex = /^FY\d{4}-P\d{2}$/;
          periods.forEach(p => {
              expect(p.id).toMatch(regex);
              expect(p.id).toContain('FY2025');
          });
      });
  });
});
