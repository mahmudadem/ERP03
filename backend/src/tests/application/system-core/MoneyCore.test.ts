import { roundCash, roundMoney, toBase } from '../../../application/system-core/money/roundMoney';

describe('Money Core rounding', () => {
  it('rounds with currency precision instead of a hardcoded 2 decimals', () => {
    expect(roundMoney(10.456, 'USD')).toBe(10.46);
    expect(roundMoney(10.456, 'BHD')).toBe(10.456);
    expect(roundMoney(10.456, 'JPY')).toBe(10);
  });

  it('applies POS cash rounding rules and then currency precision', () => {
    expect(roundCash(10.02, 'USD', { increment: 0.05, mode: 'NEAREST' })).toBe(10);
    expect(roundCash(10.03, 'USD', { increment: 0.05, mode: 'NEAREST' })).toBe(10.05);
    expect(roundCash(10.01, 'USD', { increment: 1, mode: 'UP' })).toBe(11);
    expect(roundCash(10.99, 'USD', { increment: 1, mode: 'DOWN' })).toBe(10);
  });

  it('converts to base using the base currency precision', () => {
    expect(toBase(12.345, 'USD', 2, 'USD')).toBe(24.69);
    expect(toBase(12.345, 'USD', 2, 'JPY')).toBe(25);
  });
});
