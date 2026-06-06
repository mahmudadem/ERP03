import {
  assertPostedNonFinancialEditOnly,
  scalarChanged,
  lineSignaturesEqual,
} from '../../../application/common/services/PostedDocumentEditGuard';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

describe('PostedDocumentEditGuard (edit-policy Phase 0)', () => {
  describe('assertPostedNonFinancialEditOnly', () => {
    it('allows the edit when no financial field changed (non-financial-only edit)', () => {
      expect(() =>
        assertPostedNonFinancialEditOnly({
          status: 'POSTED',
          entityLabel: 'sales invoice',
          changedFinancialFields: [],
        })
      ).not.toThrow();
    });

    it('throws POSTED_FINANCIAL_EDIT_BLOCKED when a financial field changed', () => {
      try {
        assertPostedNonFinancialEditOnly({
          status: 'POSTED',
          entityLabel: 'sales invoice',
          changedFinancialFields: ['lines', 'currency'],
        });
        fail('expected a BusinessError');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessError);
        expect((err as BusinessError).code).toBe(ErrorCode.POSTED_FINANCIAL_EDIT_BLOCKED);
        // Message names the offending fields so the user knows what to revert.
        expect((err as BusinessError).message).toContain('lines, currency');
        expect((err as BusinessError).message.toLowerCase()).toContain('reverse');
      }
    });
  });

  describe('scalarChanged', () => {
    it('is false when the incoming value is undefined (field not provided)', () => {
      expect(scalarChanged(undefined, 'USD')).toBe(false);
    });
    it('is false when the incoming value equals the current value', () => {
      expect(scalarChanged('USD', 'USD')).toBe(false);
      expect(scalarChanged(5, 5)).toBe(false);
    });
    it('is true when the incoming value differs from the current value', () => {
      expect(scalarChanged('SYP', 'USD')).toBe(true);
      expect(scalarChanged(6, 5)).toBe(true);
    });
  });

  describe('lineSignaturesEqual', () => {
    it('is true for identical signatures regardless of order', () => {
      expect(lineSignaturesEqual(['a|1', 'b|2'], ['b|2', 'a|1'])).toBe(true);
    });
    it('is false when a signature value differs', () => {
      expect(lineSignaturesEqual(['a|1', 'b|2'], ['a|1', 'b|3'])).toBe(false);
    });
    it('is false when line counts differ (added/removed line)', () => {
      expect(lineSignaturesEqual(['a|1'], ['a|1', 'b|2'])).toBe(false);
    });
    it('is true for two empty sets', () => {
      expect(lineSignaturesEqual([], [])).toBe(true);
    });
  });
});
