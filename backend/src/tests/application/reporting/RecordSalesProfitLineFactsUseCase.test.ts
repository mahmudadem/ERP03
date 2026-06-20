import {
  RecordSalesProfitLineFactsUseCase,
  PostedLineForProfitFact,
  RecordSalesProfitFactsInput,
} from '../../../application/reporting/use-cases/RecordSalesProfitLineFactsUseCase';
import {
  ISalesProfitLineFactRepository,
  ProfitFactFilters,
  ProfitFactAggregationRow,
} from '../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import {
  ProfitFactStatus,
  SalesProfitLineFact,
} from '../../../domain/reporting/entities/SalesProfitLineFact';

class InMemoryProfitFactRepository implements ISalesProfitLineFactRepository {
  public store = new Map<string, SalesProfitLineFact>();
  public replaceCalls = 0;
  public markSupersededCalls = 0;
  public markReversedCalls = 0;

  async replaceForDocumentVersion(
    companyId: string,
    documentId: string,
    snapshotVersion: number,
    facts: SalesProfitLineFact[],
    _transaction?: unknown
  ): Promise<void> {
    this.replaceCalls += 1;
    for (const fact of facts) {
      this.store.set(fact.id, { ...fact, snapshotVersion });
    }
  }

  async markSupersededForDocument(
    companyId: string,
    documentId: string,
    supersededByVersion: number,
    _transaction?: unknown
  ): Promise<void> {
    this.markSupersededCalls += 1;
    for (const [id, fact] of this.store) {
      if (
        fact.companyId === companyId &&
        fact.documentId === documentId &&
        fact.snapshotVersion < supersededByVersion &&
        fact.status === 'ACTIVE'
      ) {
        this.store.set(id, { ...fact, status: 'SUPERSEDED' });
      }
    }
  }

  async markReversedForDocument(
    companyId: string,
    documentId: string,
    _transaction?: unknown
  ): Promise<void> {
    this.markReversedCalls += 1;
    for (const [id, fact] of this.store) {
      if (
        fact.companyId === companyId &&
        fact.documentId === documentId &&
        fact.status === 'ACTIVE'
      ) {
        this.store.set(id, { ...fact, status: 'REVERSED' });
      }
    }
  }

  async queryFacts(companyId: string, filters: ProfitFactFilters): Promise<SalesProfitLineFact[]> {
    return Array.from(this.store.values()).filter((f) => {
      if (f.companyId !== companyId) return false;
      if (filters.fromDate && f.documentDate < filters.fromDate) return false;
      if (filters.toDate && f.documentDate > filters.toDate) return false;
      if (filters.documentId && f.documentId !== filters.documentId) return false;
      if (filters.itemId && f.itemId !== filters.itemId) return false;
      if (filters.docCurrency && f.docCurrency !== filters.docCurrency) return false;
      if (filters.documentType) {
        const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
        if (!types.includes(f.documentType)) return false;
      }
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(f.status)) return false;
      }
      return true;
    });
  }

  private aggregate(
    facts: SalesProfitLineFact[],
    groupBy: (f: SalesProfitLineFact) => { key: string; label: string }
  ): ProfitFactAggregationRow[] {
    const map = new Map<string, ProfitFactAggregationRow>();
    for (const f of facts) {
      const { key, label } = groupBy(f);
      let row = map.get(key);
      if (!row) {
        row = {
          groupKey: key,
          groupLabel: label,
          lineCount: 0,
          revenueAmountBaseIn: 0, revenueAmountDocIn: 0,
          costAmountBaseIn: 0, costAmountDocIn: 0,
          profitAmountBaseIn: 0, profitAmountDocIn: 0,
          revenueAmountBaseOut: 0, revenueAmountDocOut: 0,
          costAmountBaseOut: 0, costAmountDocOut: 0,
          profitAmountBaseOut: 0, profitAmountDocOut: 0,
          profitAmountBaseNet: 0, profitAmountDocNet: 0,
        };
        map.set(key, row);
      }
      row.lineCount += 1;
      if (f.revenueDir === 'IN') { row.revenueAmountBaseIn += f.revenueAmountBase; row.revenueAmountDocIn += f.revenueAmountDoc; }
      else if (f.revenueDir === 'OUT') { row.revenueAmountBaseOut += f.revenueAmountBase; row.revenueAmountDocOut += f.revenueAmountDoc; }
      if (f.costDir === 'IN') { row.costAmountBaseIn += f.costAmountBase; row.costAmountDocIn += f.costAmountDoc; }
      else { row.costAmountBaseOut += f.costAmountBase; row.costAmountDocOut += f.costAmountDoc; }
      if (f.profitDir === 'IN') { row.profitAmountBaseIn += f.profitAmountBase; row.profitAmountDocIn += f.profitAmountDoc; }
      else { row.profitAmountBaseOut += f.profitAmountBase; row.profitAmountDocOut += f.profitAmountDoc; }
      row.profitAmountBaseNet = row.profitAmountBaseIn - row.profitAmountBaseOut;
      row.profitAmountDocNet = row.profitAmountDocIn - row.profitAmountDocOut;
    }
    return Array.from(map.values());
  }

  async aggregateByDocument(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]> {
    const facts = await this.queryFacts(companyId, { ...filters, status: filters.status ?? 'ACTIVE' });
    return this.aggregate(facts, (f) => ({ key: `${f.documentType}::${f.documentId}`, label: `${f.documentNumber} (${f.documentType})` }));
  }

  async aggregateByItem(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]> {
    const facts = await this.queryFacts(companyId, { ...filters, status: filters.status ?? 'ACTIVE' });
    return this.aggregate(facts, (f) => ({ key: f.itemId, label: f.itemId }));
  }
}

const siInput = (lines: PostedLineForProfitFact[]): RecordSalesProfitFactsInput => ({
  companyId: 'cmp_test',
  documentType: 'SALES_INVOICE',
  documentId: 'si_1',
  documentNumber: 'SI-00001',
  documentDate: '2026-06-20',
  docCurrency: 'USD',
  baseCurrency: 'USD',
  snapshotVersion: 1,
  lines,
});

describe('RecordSalesProfitLineFactsUseCase', () => {
  let repo: InMemoryProfitFactRepository;
  let useCase: RecordSalesProfitLineFactsUseCase;

  beforeEach(() => {
    repo = new InMemoryProfitFactRepository();
    useCase = new RecordSalesProfitLineFactsUseCase(repo);
  });

  it('writes one fact per line for a base-currency SI', async () => {
    await useCase.execute(siInput([
      { lineId: 'l1', itemId: 'itm_a', qtyBase: 1, uomId: 'pcs', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60, exchangeRateDocToBase: 1 },
      { lineId: 'l2', itemId: 'itm_b', qtyBase: 2, uomId: 'pcs', revenueAmountDoc: 50, revenueAmountBase: 50, costAmountDoc: 30, costAmountBase: 30, exchangeRateDocToBase: 1 },
    ]));
    expect(repo.store.size).toBe(2);
    expect(repo.replaceCalls).toBe(1);
    const a = repo.store.get('cmp_test_si_1_l1_1')!;
    expect(a.revenueDir).toBe('IN');
    expect(a.costDir).toBe('OUT');
    expect(a.profitDir).toBe('IN');
    expect(a.profitAmountBase).toBe(40);
  });

  it('uses historical FX rate for base-currency profit on a foreign-currency SI', async () => {
    // SI in EUR (rate 1.2 to USD). Revenue 100 EUR → 120 USD. Cost 60 EUR → 72 USD. Profit 40 EUR → 48 USD.
    await useCase.execute({
      ...siInput([
        { lineId: 'l1', itemId: 'itm_a', qtyBase: 1, uomId: 'pcs', revenueAmountDoc: 100, revenueAmountBase: 120, costAmountDoc: 60, costAmountBase: 72, exchangeRateDocToBase: 1.2 },
      ]),
    });
    const a = repo.store.get('cmp_test_si_1_l1_1')!;
    expect(a.profitAmountDoc).toBe(40);
    expect(a.profitAmountBase).toBe(48);
  });

  it('is idempotent: re-running with the same (company, doc, line, version) replaces without duplicating', async () => {
    const input = siInput([
      { lineId: 'l1', itemId: 'itm_a', qtyBase: 1, uomId: 'pcs', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60, exchangeRateDocToBase: 1 },
    ]);
    await useCase.execute(input);
    await useCase.execute(input); // repost
    expect(repo.store.size).toBe(1);
    expect(repo.replaceCalls).toBe(2);
    const a = repo.store.get('cmp_test_si_1_l1_1')!;
    expect(a.profitAmountBase).toBe(40);
  });

  it('supports a new snapshotVersion on amend/repost (different id, old one stays until superseded)', async () => {
    const v1 = siInput([
      { lineId: 'l1', itemId: 'itm_a', qtyBase: 1, uomId: 'pcs', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60, exchangeRateDocToBase: 1 },
    ]);
    const v2 = { ...v1, snapshotVersion: 2 };
    await useCase.execute(v1);
    await useCase.execute(v2);
    expect(repo.store.size).toBe(2);
    expect(repo.store.get('cmp_test_si_1_l1_1')!.snapshotVersion).toBe(1);
    expect(repo.store.get('cmp_test_si_1_l1_2')!.snapshotVersion).toBe(2);
  });

  it('builds an SR fact with revenueDir=OUT, costDir=IN (preserves the SR’s recorded cost)', async () => {
    await useCase.execute({
      companyId: 'cmp_test',
      documentType: 'SALES_RETURN',
      documentId: 'sr_1',
      documentNumber: 'SR-00001',
      documentDate: '2026-06-21',
      docCurrency: 'USD',
      baseCurrency: 'USD',
      snapshotVersion: 1,
      lines: [{
        lineId: 'l1', itemId: 'itm_a', qtyBase: 1, uomId: 'pcs',
        revenueAmountDoc: 15, revenueAmountBase: 15, // refund (line.lineTotalDoc/Base from SR)
        costAmountDoc: 3, costAmountBase: 3,         // cost added back at time of return (preserved from posting)
        exchangeRateDocToBase: 1,
      }],
    });
    const a = repo.store.get('cmp_test_sr_1_l1_1')!;
    expect(a.revenueDir).toBe('OUT');
    expect(a.costDir).toBe('IN');
    expect(a.profitAmountBase).toBe(12);
    expect(a.profitDir).toBe('OUT');
  });

  it('builds a PI fact with revenueAmount=0, costDir=IN, profitDir=OUT', async () => {
    await useCase.execute({
      companyId: 'cmp_test',
      documentType: 'PURCHASE_INVOICE',
      documentId: 'pi_1',
      documentNumber: 'PI-00001',
      documentDate: '2026-06-22',
      docCurrency: 'USD',
      baseCurrency: 'USD',
      snapshotVersion: 1,
      lines: [{
        lineId: 'l1', itemId: 'itm_b', qtyBase: 5, uomId: 'pcs',
        revenueAmountDoc: 0, revenueAmountBase: 0,
        costAmountDoc: 50, costAmountBase: 50,
        exchangeRateDocToBase: 1,
      }],
    });
    const a = repo.store.get('cmp_test_pi_1_l1_1')!;
    expect(a.revenueAmountDoc).toBe(0);
    expect(a.revenueDir).toBeNull();
    expect(a.costDir).toBe('IN');
    expect(a.profitAmountBase).toBe(50);
    expect(a.profitDir).toBe('OUT');
  });

  it('builds a PR fact with revenueAmount=0, costDir=OUT, profitDir=IN', async () => {
    await useCase.execute({
      companyId: 'cmp_test',
      documentType: 'PURCHASE_RETURN',
      documentId: 'pr_1',
      documentNumber: 'PR-00001',
      documentDate: '2026-06-23',
      docCurrency: 'USD',
      baseCurrency: 'USD',
      snapshotVersion: 1,
      lines: [{
        lineId: 'l1', itemId: 'itm_b', qtyBase: 2, uomId: 'pcs',
        revenueAmountDoc: 0, revenueAmountBase: 0,
        costAmountDoc: 20, costAmountBase: 20,
        exchangeRateDocToBase: 1,
      }],
    });
    const a = repo.store.get('cmp_test_pr_1_l1_1')!;
    expect(a.revenueDir).toBeNull();
    expect(a.costDir).toBe('OUT');
    expect(a.profitAmountBase).toBe(20);
    expect(a.profitDir).toBe('IN');
  });

  it('aggregates net profit = IN − OUT across mixed types on the same item', async () => {
    await useCase.execute(siInput([
      { lineId: 'l1', itemId: 'itm_x', qtyBase: 1, uomId: 'pcs', revenueAmountDoc: 100, revenueAmountBase: 100, costAmountDoc: 60, costAmountBase: 60, exchangeRateDocToBase: 1 },
    ]));
    await useCase.execute({
      companyId: 'cmp_test',
      documentType: 'SALES_RETURN',
      documentId: 'sr_1',
      documentNumber: 'SR-00001',
      documentDate: '2026-06-21',
      docCurrency: 'USD',
      baseCurrency: 'USD',
      snapshotVersion: 1,
      lines: [{
        lineId: 'l1', itemId: 'itm_x', qtyBase: 1, uomId: 'pcs',
        revenueAmountDoc: 100, revenueAmountBase: 100,
        costAmountDoc: 60, costAmountBase: 60,
        exchangeRateDocToBase: 1,
      }],
    });
    await useCase.execute({
      companyId: 'cmp_test',
      documentType: 'PURCHASE_INVOICE',
      documentId: 'pi_1',
      documentNumber: 'PI-00001',
      documentDate: '2026-06-22',
      docCurrency: 'USD',
      baseCurrency: 'USD',
      snapshotVersion: 1,
      lines: [{
        lineId: 'l1', itemId: 'itm_x', qtyBase: 1, uomId: 'pcs',
        revenueAmountDoc: 0, revenueAmountBase: 0,
        costAmountDoc: 50, costAmountBase: 50,
        exchangeRateDocToBase: 1,
      }],
    });

    const rows = await repo.aggregateByItem('cmp_test', {});
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.profitAmountBaseIn).toBe(40);  // SI profit IN
    expect(row.profitAmountBaseOut).toBe(90); // SR 40 OUT + PI 50 OUT
    expect(row.profitAmountBaseNet).toBe(40 - 90); // -50 net loss driven by purchase cost
  });
});
