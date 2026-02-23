import { FXRevaluationStrategy } from '../FXRevaluationStrategy';
import { VoucherLineEntity } from '../../../entities/VoucherLineEntity';

describe('FXRevaluationStrategy', () => {
    let strategy: FXRevaluationStrategy;
    const baseCurrency = 'AED';
    const companyId = 'comp-1';
    const targetAccountId = 'gain-loss-acc';

    beforeEach(() => {
        strategy = new FXRevaluationStrategy();
    });

    it('generates revaluation lines and balances correctly', async () => {
        const header = {
            targetAccountId,
            lines: [
                {
                    accountId: 'acc-1',
                    deltaBase: 100, // Gain
                    currency: 'USD',
                    foreignBalance: 1000,
                    newRate: 4.0
                },
                {
                    accountId: 'acc-2',
                    deltaBase: -40, // Loss
                    currency: 'EUR',
                    foreignBalance: 500,
                    newRate: 4.5
                }
            ]
        };

        const lines = await strategy.generateLines(header, companyId, baseCurrency);

        // Expect 2 adjustment lines + 1 offset line = 3 total
        expect(lines).toHaveLength(3);

        // Check line 1 (Gain on USD account)
        const line1 = lines.find(l => l.accountId === 'acc-1')!;
        expect(line1.side).toBe('Debit');
        expect(line1.baseAmount).toBe(100);
        expect(line1.currency).toBe(baseCurrency);
        expect(line1.exchangeRate).toBe(1.0);

        // Check line 2 (Loss on EUR account)
        const line2 = lines.find(l => l.accountId === 'acc-2')!;
        expect(line2.side).toBe('Credit');
        expect(line2.baseAmount).toBe(40);
        expect(line2.currency).toBe(baseCurrency);

        // Check offset line (Unrealized Gain/Loss)
        // Net delta = 100 - 40 = 60 (Net Gain)
        // Offset line should be Credit of 60 to Gain/Loss account
        const offsetLine = lines.find(l => l.accountId === targetAccountId)!;
        expect(offsetLine.side).toBe('Credit'); // Balancing line for net gain
        expect(offsetLine.baseAmount).toBe(60);
        expect(offsetLine.currency).toBe(baseCurrency);
    });

    it('throws error if no lines provided', async () => {
        const header = { targetAccountId, lines: [] };
        await expect(strategy.generateLines(header, companyId, baseCurrency)).rejects.toThrow('FX Revaluation must have at least one account line');
    });

    it('throws error if targetAccountId is missing', async () => {
        const header = { lines: [{ accountId: 'acc-1', deltaBase: 100 }] };
        await expect(strategy.generateLines(header, companyId, baseCurrency)).rejects.toThrow('FX Revaluation Strategy requires a targetAccountId for Unrealized Gains/Losses');
    });

    it('throws error if no net delta found (all zeros)', async () => {
        const header = {
            targetAccountId,
            lines: [
                { accountId: 'acc-1', deltaBase: 0 }
            ]
        };
        await expect(strategy.generateLines(header, companyId, baseCurrency)).rejects.toThrow('No foreign exchange differences found to revalue.');
    });
});
