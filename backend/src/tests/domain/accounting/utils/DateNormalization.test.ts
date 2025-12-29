import { describe, it, expect } from '@jest/globals';
import { normalizeAccountingDate, compareAccountingDates } from '../../../../../src/domain/accounting/utils/DateNormalization';

describe('DateNormalization', () => {
  describe('normalizeAccountingDate', () => {
    it('should normalize already formatted date (YYYY-MM-DD)', () => {
      const result = normalizeAccountingDate('2025-01-15');
      expect(result).toBe('2025-01-15');
    });

    it('should normalize ISO date with time component', () => {
      const result = normalizeAccountingDate('2025-01-15T23:30:00Z');
      expect(result).toBe('2025-01-15');
    });

    it('should normalize Date object', () => {
      const date = new Date('2025-01-15T10:30:00Z');
      const result = normalizeAccountingDate(date);
      expect(result).toBe('2025-01-15');
    });

    it('should handle timezone edge cases (UTC)', () => {
      // Date at end of day in one timezone might be different in UTC
      const result = normalizeAccountingDate('2025-01-15T23:59:59Z');
      expect(result).toBe('2025-01-15');
    });

    it('should throw for invalid date', () => {
      expect(() => normalizeAccountingDate('invalid-date')).toThrow('Invalid date');
    });

    it('should throw for empty input', () => {
      expect(() => normalizeAccountingDate('')).toThrow('Date input is required');
    });
  });

  describe('compareAccountingDates', () => {
    it('should compare equal dates', () => {
      const result = compareAccountingDates('2025-01-15', '2025-01-15');
      expect(result).toBe(0);
    });

    it('should return -1 when first date is earlier', () => {
      const result = compareAccountingDates('2025-01-14', '2025-01-15');
      expect(result).toBe(-1);
    });

    it('should return 1 when first date is later', () => {
      const result = compareAccountingDates('2025-01-16', '2025-01-15');
      expect(result).toBe(1);
    });

    it('should handle dates with time components', () => {
      const result = compareAccountingDates(
        '2025-01-15T23:30:00Z',
        '2025-01-15T01:00:00Z'
      );
      expect(result).toBe(0); // Same accounting date
    });
  });
});
