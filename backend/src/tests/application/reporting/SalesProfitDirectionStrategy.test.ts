import {
  ProfitDocumentType,
  buildSalesProfitLineFact,
  isProfitDocumentType,
  resolveDirection,
} from '../../../domain/reporting/entities/SalesProfitLineFact';

const baseInput = {
  companyId: 'cmp_test',
  documentId: 'si_1',
  documentNumber: 'SI-00001',
  documentLineId: 'si_1_l1',
  documentDate: '2026-06-20',
  qtyBase: 1,
  uomId: 'pcs',
  docCurrency: 'USD',
  baseCurrency: 'USD',
  exchangeRateDocToBase: 1,
  snapshotVersion: 1,
} as const;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

describe('SalesProfitLineFact — direction strategy', () => {
  describe('resolveDirection', () => {
    it('SI: revenue IN, cost OUT', () => {
      expect(resolveDirection('SALES_INVOICE')).toEqual({ revenueDir: 'IN', costDir: 'OUT' });
    });
    it('SR: revenue OUT, cost IN', () => {
      expect(resolveDirection('SALES_RETURN')).toEqual({ revenueDir: 'OUT', costDir: 'IN' });
    });
    it('PI: cost IN (revenue ignored when amount=0)', () => {
      expect(resolveDirection('PURCHASE_INVOICE').costDir).toBe('IN');
    });
    it('PR: cost OUT (revenue ignored when amount=0)', () => {
      expect(resolveDirection('PURCHASE_RETURN').costDir).toBe('OUT');
    });
    it('throws for unknown document type', () => {
      expect(() => resolveDirection('UNKNOWN' as ProfitDocumentType)).toThrow(/Unknown documentType/);
    });
  });

  describe('isProfitDocumentType', () => {
    it('accepts all 4 known types', () => {
      expect(isProfitDocumentType('SALES_INVOICE')).toBe(true);
      expect(isProfitDocumentType('SALES_RETURN')).toBe(true);
      expect(isProfitDocumentType('PURCHASE_INVOICE')).toBe(true);
      expect(isProfitDocumentType('PURCHASE_RETURN')).toBe(true);
    });
    it('rejects unknown types', () => {
      expect(isProfitDocumentType('QUOTE')).toBe(false);
      expect(isProfitDocumentType('')).toBe(false);
      expect(isProfitDocumentType(null)).toBe(false);
      expect(isProfitDocumentType(undefined)).toBe(false);
    });
  });

  describe('SI happy path (base ccy)', () => {
    it('records revenue IN, cost OUT, profit IN, marginPct positive', () => {
      // SI: 1 unit @ 100. Cost 60. Profit 40. Margin 40%.
      const fact = buildSalesProfitLineFact({
        ...baseInput,
        itemId: 'itm_a',
        documentType: 'SALES_INVOICE',
        revenueAmountDoc: 100,
        revenueAmountBase: 100,
        costAmountDoc: 60,
        costAmountBase: 60,
      });
      expect(fact.revenueAmountDoc).toBe(100);
      expect(fact.revenueAmountBase).toBe(100);
      expect(fact.revenueDir).toBe('IN');
      expect(fact.costAmountDoc).toBe(60);
      expect(fact.costAmountBase).toBe(60);
      expect(fact.costDir).toBe('OUT');
      expect(fact.profitAmountDoc).toBe(40);
      expect(fact.profitAmountBase).toBe(40);
      expect(fact.profitDir).toBe('IN');
      expect(round2(fact.marginPct)).toBe(40);
      expect(fact.status).toBe('ACTIVE');
    });
  });

  describe('SI happy path (foreign ccy)', () => {
    it('records stable doc-currency and historical-rate base-currency profit', () => {
      // SI in EUR, base USD. Rate 1.2. Revenue 100 EUR → 120 USD. Cost 60 EUR → 72 USD. Profit 40 EUR → 48 USD.
      const fact = buildSalesProfitLineFact({
        ...baseInput,
        docCurrency: 'EUR',
        baseCurrency: 'USD',
        exchangeRateDocToBase: 1.2,
        itemId: 'itm_a',
        documentType: 'SALES_INVOICE',
        revenueAmountDoc: 100,
        revenueAmountBase: 120,
        costAmountDoc: 60,
        costAmountBase: 72,
      });
      expect(fact.revenueAmountDoc).toBe(100);
      expect(fact.revenueAmountBase).toBe(120);
      expect(fact.revenueDir).toBe('IN');
      expect(fact.costAmountDoc).toBe(60);
      expect(fact.costAmountBase).toBe(72);
      expect(fact.costDir).toBe('OUT');
      expect(fact.profitAmountDoc).toBe(40);
      expect(fact.profitAmountBase).toBe(48);
      expect(fact.profitDir).toBe('IN');
    });
  });

  describe('SR — owner scenario (SR cost basis differs from SI cost basis)', () => {
    // User's worked example:
    //   Original SI: rev 15, cost 3, profit 12
    //   Later, current avg cost = 5
    //   SR (return): revenue 15, cost 3 (preserved from SI), profit = 12, dir OUT
    it('preserves the SR’s actual recorded cost on the fact (does not back-derive from SI)', () => {
      const srFact = buildSalesProfitLineFact({
        ...baseInput,
        documentId: 'sr_1',
        documentNumber: 'SR-00001',
        documentLineId: 'sr_1_l1',
        documentType: 'SALES_RETURN',
        itemId: 'itm_a',
        revenueAmountDoc: 15,
        revenueAmountBase: 15,
        costAmountDoc: 3,
        costAmountBase: 3,
      });
      expect(srFact.revenueDir).toBe('OUT');
      expect(srFact.costDir).toBe('IN');
      expect(srFact.revenueAmountDoc).toBe(15);
      expect(srFact.costAmountDoc).toBe(3);
      // |15 - 3| = 12; revenue>0 and positive net, so profitDir = revenueDir = OUT
      expect(srFact.profitAmountDoc).toBe(12);
      expect(srFact.profitDir).toBe('OUT');
    });

    it('SR with cost > revenue (net gain on return) flips profitDir to IN', () => {
      // SR: revenue 15 (refund), cost 30 (cost added back exceeds refund). Net = 15-30 = -15.
      // |net| = 15. Direction: revenue>0 and net<0, so profitDir = opposite(OUT) = IN.
      const srFact = buildSalesProfitLineFact({
        ...baseInput,
        documentId: 'sr_2',
        documentNumber: 'SR-00002',
        documentLineId: 'sr_2_l1',
        documentType: 'SALES_RETURN',
        itemId: 'itm_a',
        revenueAmountDoc: 15,
        revenueAmountBase: 15,
        costAmountDoc: 30,
        costAmountBase: 30,
      });
      expect(srFact.profitAmountDoc).toBe(15);
      expect(srFact.profitDir).toBe('IN');
    });
  });

  describe('PI (purchase invoice)', () => {
    it('records revenue=0, cost IN, profit OUT (loss)', () => {
      // PI: 5 units @ 10 each. Cost 50. No revenue. Profit = 0 - 50 = -50, abs 50 OUT.
      const fact = buildSalesProfitLineFact({
        ...baseInput,
        documentId: 'pi_1',
        documentNumber: 'PI-00001',
        documentLineId: 'pi_1_l1',
        documentType: 'PURCHASE_INVOICE',
        itemId: 'itm_b',
        revenueAmountDoc: 0,
        revenueAmountBase: 0,
        costAmountDoc: 50,
        costAmountBase: 50,
      });
      expect(fact.revenueAmountDoc).toBe(0);
      expect(fact.revenueAmountBase).toBe(0);
      expect(fact.revenueDir).toBeNull();
      expect(fact.costDir).toBe('IN');
      expect(fact.costAmountDoc).toBe(50);
      expect(fact.profitAmountDoc).toBe(50);
      expect(fact.profitDir).toBe('OUT');
      expect(fact.marginPct).toBe(0); // no revenue → 0 margin (don't divide by zero)
    });
  });

  describe('PR (purchase return)', () => {
    it('records revenue=0, cost OUT, profit IN (gain)', () => {
      // PR: return 2 units originally bought @ 10. Cost removed 20. No revenue. Profit = 0 - (-20) = 20 IN.
      const fact = buildSalesProfitLineFact({
        ...baseInput,
        documentId: 'pr_1',
        documentNumber: 'PR-00001',
        documentLineId: 'pr_1_l1',
        documentType: 'PURCHASE_RETURN',
        itemId: 'itm_b',
        revenueAmountDoc: 0,
        revenueAmountBase: 0,
        costAmountDoc: 20,
        costAmountBase: 20,
      });
      expect(fact.revenueDir).toBeNull();
      expect(fact.costDir).toBe('OUT');
      expect(fact.costAmountDoc).toBe(20);
      expect(fact.costAmountBase).toBe(20);
      expect(fact.profitAmountDoc).toBe(20);
      expect(fact.profitDir).toBe('IN');
    });
  });

  describe('SI loss case (cost > revenue)', () => {
    it('records profit OUT (opposite of revenueDir) when cost exceeds revenue', () => {
      // SI: 1 unit @ 15. Cost 20. Net = 15-20 = -5. abs 5. Dir: revenue>0 and net<0 → opposite(IN)=OUT.
      const fact = buildSalesProfitLineFact({
        ...baseInput,
        itemId: 'itm_loss',
        documentType: 'SALES_INVOICE',
        revenueAmountDoc: 15,
        revenueAmountBase: 15,
        costAmountDoc: 20,
        costAmountBase: 20,
      });
      expect(fact.profitAmountDoc).toBe(5);
      expect(fact.profitDir).toBe('OUT');
    });
  });

  describe('idempotency (deterministic id)', () => {
    it('produces the same id for the same (company, document, line, version)', () => {
      const input = {
        ...baseInput,
        itemId: 'itm_a',
        documentType: 'SALES_INVOICE' as ProfitDocumentType,
        revenueAmountDoc: 100,
        revenueAmountBase: 100,
        costAmountDoc: 60,
        costAmountBase: 60,
      };
      const a = buildSalesProfitLineFact(input);
      const b = buildSalesProfitLineFact(input);
      expect(a.id).toBe(b.id);
      expect(a.id).toBe('cmp_test_si_1_si_1_l1_1');
    });
    it('produces a different id when snapshotVersion changes', () => {
      const input = {
        ...baseInput,
        itemId: 'itm_a',
        documentType: 'SALES_INVOICE' as ProfitDocumentType,
        revenueAmountDoc: 100,
        revenueAmountBase: 100,
        costAmountDoc: 60,
        costAmountBase: 60,
      };
      const a = buildSalesProfitLineFact({ ...input, snapshotVersion: 1 });
      const b = buildSalesProfitLineFact({ ...input, snapshotVersion: 2 });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('mixed-direction net (multi-type scenario)', () => {
    it('net profit across SI + SR + PI on same item is IN − OUT in base ccy', () => {
      const si = buildSalesProfitLineFact({
        ...baseInput, documentId: 'si_1', documentLineId: 'l1', documentType: 'SALES_INVOICE',
        itemId: 'itm_x', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60,
      });
      const sr = buildSalesProfitLineFact({
        ...baseInput, documentId: 'sr_1', documentLineId: 'l1', documentType: 'SALES_RETURN',
        itemId: 'itm_x', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60,
      });
      const pi = buildSalesProfitLineFact({
        ...baseInput, documentId: 'pi_1', documentLineId: 'l1', documentType: 'PURCHASE_INVOICE',
        itemId: 'itm_x', revenueAmountDoc: 0, revenueAmountBase: 0, costAmountDoc: 50, costAmountBase: 50,
      });

      // SI profit IN 40, SR profit OUT 40, PI profit OUT 50.
      expect(si.profitDir).toBe('IN'); expect(si.profitAmountBase).toBe(40);
      expect(sr.profitDir).toBe('OUT'); expect(sr.profitAmountBase).toBe(40);
      expect(pi.profitDir).toBe('OUT'); expect(pi.profitAmountBase).toBe(50);

      const totalIn = si.profitAmountBase + (sr.profitDir === 'IN' ? sr.profitAmountBase : 0) + (pi.profitDir === 'IN' ? pi.profitAmountBase : 0);
      const totalOut = (sr.profitDir === 'OUT' ? sr.profitAmountBase : 0) + (pi.profitDir === 'OUT' ? pi.profitAmountBase : 0);
      expect(totalIn).toBe(40);
      expect(totalOut).toBe(90);
      expect(totalIn - totalOut).toBe(-50); // net loss driven by purchase cost
    });
  });
});
