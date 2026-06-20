import {
  GetGrossProfitByDocumentUseCase,
  GetGrossProfitByDocumentInput,
} from '../../../application/reporting/use-cases/GetGrossProfitByDocumentUseCase';
import {
  GetGrossProfitByItemUseCase,
  GetGrossProfitByItemInput,
} from '../../../application/reporting/use-cases/GetGrossProfitByItemUseCase';
import {
  ISalesProfitLineFactRepository,
  ProfitFactAggregationRow,
  ProfitFactFilters,
} from '../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import {
  ProfitDocumentType,
  SalesProfitLineFact,
} from '../../../domain/reporting/entities/SalesProfitLineFact';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';

class InMemoryProfitFactRepository implements ISalesProfitLineFactRepository {
  public store = new Map<string, SalesProfitLineFact>();
  public replaceCalls = 0;

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
  async markSupersededForDocument(companyId: string, documentId: string, supersededByVersion: number, _transaction?: unknown): Promise<void> {
    for (const [id, fact] of this.store) {
      if (fact.companyId === companyId && fact.documentId === documentId && fact.snapshotVersion < supersededByVersion && fact.status === 'ACTIVE') {
        this.store.set(id, { ...fact, status: 'SUPERSEDED' });
      }
    }
  }
  async markReversedForDocument(companyId: string, documentId: string, _transaction?: unknown): Promise<void> {
    for (const [id, fact] of this.store) {
      if (fact.companyId === companyId && fact.documentId === documentId && fact.status === 'ACTIVE') {
        this.store.set(id, { ...fact, status: 'REVERSED' });
      }
    }
  }
  async queryFacts(companyId: string, filters: ProfitFactFilters): Promise<SalesProfitLineFact[]> {
    return Array.from(this.store.values()).filter((f) => {
      if (f.companyId !== companyId) return false;
      if (f.status !== 'ACTIVE') return false;
      if (filters.fromDate && f.documentDate < filters.fromDate) return false;
      if (filters.toDate && f.documentDate > filters.toDate) return false;
      if (filters.documentId && f.documentId !== filters.documentId) return false;
      if (filters.itemId && f.itemId !== filters.itemId) return false;
      if (filters.docCurrency && f.docCurrency !== filters.docCurrency) return false;
      if (filters.documentType) {
        const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
        if (!types.includes(f.documentType)) return false;
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
          groupKey: key, groupLabel: label, lineCount: 0,
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
    const facts = await this.queryFacts(companyId, filters);
    return this.aggregate(facts, (f) => ({ key: `${f.documentType}::${f.documentId}`, label: `${f.documentNumber} (${f.documentType})` }));
  }
  async aggregateByItem(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]> {
    const facts = await this.queryFacts(companyId, filters);
    return this.aggregate(facts, (f) => ({ key: f.itemId, label: f.itemId }));
  }
}

class StubPermissionChecker {
  allowed: boolean;
  constructor(allowed = true) { this.allowed = allowed; }
  async assertOrThrow(_userId: string, _companyId: string, _permission: string): Promise<void> {
    if (!this.allowed) throw new Error('forbidden');
  }
}

describe('Gross Profit report use cases (Task 246)', () => {
  let repo: InMemoryProfitFactRepository;
  let byDoc: GetGrossProfitByDocumentUseCase;
  let byItem: GetGrossProfitByItemUseCase;

  beforeEach(() => {
    repo = new InMemoryProfitFactRepository();
    byDoc = new GetGrossProfitByDocumentUseCase(repo, new StubPermissionChecker() as unknown as PermissionChecker);
    byItem = new GetGrossProfitByItemUseCase(repo, new StubPermissionChecker() as unknown as PermissionChecker);
  });

  const seed = async (facts: Array<Partial<SalesProfitLineFact> & { id: string }>) => {
    for (const f of facts) {
      const full: SalesProfitLineFact = {
        id: f.id,
        companyId: f.companyId ?? 'cmp_test',
        documentType: f.documentType ?? 'SALES_INVOICE',
        documentId: f.documentId ?? 'si_1',
        documentNumber: f.documentNumber ?? 'SI-00001',
        documentLineId: f.documentLineId ?? 'l1',
        documentDate: f.documentDate ?? '2026-06-20',
        itemId: f.itemId ?? 'itm_a',
        qtyBase: f.qtyBase ?? 1,
        uomId: f.uomId ?? 'pcs',
        docCurrency: f.docCurrency ?? 'USD',
        baseCurrency: f.baseCurrency ?? 'USD',
        exchangeRateDocToBase: f.exchangeRateDocToBase ?? 1,
        revenueAmountDoc: f.revenueAmountDoc ?? 0,
        revenueAmountBase: f.revenueAmountBase ?? 0,
        revenueDir: f.revenueDir ?? null,
        costAmountDoc: f.costAmountDoc ?? 0,
        costAmountBase: f.costAmountBase ?? 0,
        costDir: f.costDir ?? 'IN',
        profitAmountDoc: f.profitAmountDoc ?? 0,
        profitAmountBase: f.profitAmountBase ?? 0,
        profitDir: f.profitDir ?? 'IN',
        marginPct: f.marginPct ?? 0,
        snapshotVersion: f.snapshotVersion ?? 1,
        status: f.status ?? 'ACTIVE',
        createdAt: '2026-06-20T00:00:00.000Z',
        updatedAt: '2026-06-20T00:00:00.000Z',
      };
      repo.store.set(full.id, full);
    }
  };

  describe('GetGrossProfitByDocumentUseCase', () => {
    it('returns one row per document, with IN/OUT/net totals and grand totals', async () => {
      // SI 1: rev 100, cost 60 → profit 40 IN
      await seed([{
        id: 'f1', documentId: 'si_1', documentType: 'SALES_INVOICE', documentNumber: 'SI-00001',
        revenueAmountDoc: 100, revenueAmountBase: 100, revenueDir: 'IN',
        costAmountDoc: 60, costAmountBase: 60, costDir: 'OUT',
        profitAmountDoc: 40, profitAmountBase: 40, profitDir: 'IN',
      }]);
      // SR 1: rev 100, cost 60 → profit 40 OUT (per type table)
      await seed([{
        id: 'f2', documentId: 'sr_1', documentType: 'SALES_RETURN', documentNumber: 'SR-00001',
        revenueAmountDoc: 100, revenueAmountBase: 100, revenueDir: 'OUT',
        costAmountDoc: 60, costAmountBase: 60, costDir: 'IN',
        profitAmountDoc: 40, profitAmountBase: 40, profitDir: 'OUT',
      }]);

      const out = await byDoc.execute({ companyId: 'cmp_test', userId: 'u1' });
      expect(out.rows).toHaveLength(2);
      const siRow = out.rows.find(r => r.groupKey === 'SALES_INVOICE::si_1')!;
      const srRow = out.rows.find(r => r.groupKey === 'SALES_RETURN::sr_1')!;
      expect(siRow.profitAmountBaseIn).toBe(40);
      expect(siRow.profitAmountBaseOut).toBe(0);
      expect(srRow.profitAmountBaseIn).toBe(0);
      expect(srRow.profitAmountBaseOut).toBe(40);

      expect(out.totals.profitBaseIn).toBe(40);
      expect(out.totals.profitBaseOut).toBe(40);
      expect(out.totals.profitBaseNet).toBe(0);
      expect(out.totals.lineCount).toBe(2);
    });

    it('filters by documentType when provided', async () => {
      await seed([
        { id: 'si', documentId: 'si_1', documentType: 'SALES_INVOICE' },
        { id: 'pi', documentId: 'pi_1', documentType: 'PURCHASE_INVOICE' },
      ]);
      const out = await byDoc.execute({
        companyId: 'cmp_test',
        userId: 'u1',
        documentType: 'SALES_INVOICE',
      });
      expect(out.rows).toHaveLength(1);
      expect(out.rows[0].groupKey).toBe('SALES_INVOICE::si_1');
    });

    it('filters by date range', async () => {
      await seed([
        { id: 'old', documentId: 'si_old', documentDate: '2026-01-15' },
        { id: 'new', documentId: 'si_new', documentDate: '2026-06-15' },
      ]);
      const out = await byDoc.execute({
        companyId: 'cmp_test',
        userId: 'u1',
        fromDate: '2026-06-01',
        toDate: '2026-06-30',
      });
      expect(out.rows).toHaveLength(1);
      expect(out.rows[0].groupKey).toBe('SALES_INVOICE::si_new');
    });

    it('requires the permission to be held', async () => {
      byDoc = new GetGrossProfitByDocumentUseCase(
        repo,
        new StubPermissionChecker(false) as unknown as PermissionChecker
      );
      await expect(byDoc.execute({ companyId: 'cmp_test', userId: 'u1' })).rejects.toThrow('forbidden');
    });

    it('ignores SUPERSEDED facts (only ACTIVE counted)', async () => {
      await seed([{
        id: 'f1', documentId: 'si_1', documentType: 'SALES_INVOICE', status: 'SUPERSEDED',
        profitAmountBase: 100, profitDir: 'IN',
      }]);
      const out = await byDoc.execute({ companyId: 'cmp_test', userId: 'u1' });
      expect(out.rows).toHaveLength(0);
      expect(out.totals.profitBaseIn).toBe(0);
    });
  });

  describe('GetGrossProfitByItemUseCase', () => {
    it('groups facts by itemId and returns IN/OUT/net per item', async () => {
      await seed([
        { id: 'a1', itemId: 'itm_x', documentId: 'si_1', documentType: 'SALES_INVOICE',
          profitAmountBase: 50, profitDir: 'IN' },
        { id: 'a2', itemId: 'itm_x', documentId: 'si_2', documentType: 'SALES_INVOICE',
          profitAmountBase: 30, profitDir: 'IN' },
        { id: 'b1', itemId: 'itm_y', documentId: 'si_3', documentType: 'SALES_INVOICE',
          profitAmountBase: 20, profitDir: 'OUT' },
      ]);
      const out = await byItem.execute({ companyId: 'cmp_test', userId: 'u1' });
      expect(out.rows).toHaveLength(2);
      const x = out.rows.find(r => r.groupKey === 'itm_x')!;
      const y = out.rows.find(r => r.groupKey === 'itm_y')!;
      expect(x.profitAmountBaseIn).toBe(80);
      expect(x.profitAmountBaseOut).toBe(0);
      expect(x.profitAmountBaseNet).toBe(80);
      expect(y.profitAmountBaseIn).toBe(0);
      expect(y.profitAmountBaseOut).toBe(20);
      expect(y.profitAmountBaseNet).toBe(-20);
      expect(out.totals.lineCount).toBe(3);
    });
  });
});
