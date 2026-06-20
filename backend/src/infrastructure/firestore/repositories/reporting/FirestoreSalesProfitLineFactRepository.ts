import { Firestore, Transaction } from 'firebase-admin/firestore';
import {
  ProfitFactAggregationRow,
  ProfitFactCurrencyTotals,
  ProfitFactFilters,
  ISalesProfitLineFactRepository,
} from '../../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import {
  SalesProfitLineFact,
  isProfitDocumentType,
} from '../../../../domain/reporting/entities/SalesProfitLineFact';

const COLLECTION = 'profit_line_facts';

const getCollection = (db: Firestore, companyId: string) =>
  db.collection('companies').doc(companyId).collection('reporting').doc('Data').collection(COLLECTION);

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
};

const toPersistence = (f: SalesProfitLineFact): Record<string, unknown> => stripUndefined({
  id: f.id,
  companyId: f.companyId,
  documentType: f.documentType,
  documentId: f.documentId,
  documentNumber: f.documentNumber,
  documentLineId: f.documentLineId,
  documentDate: f.documentDate,
  itemId: f.itemId,
  qtyBase: f.qtyBase,
  uomId: f.uomId,
  docCurrency: f.docCurrency,
  baseCurrency: f.baseCurrency,
  exchangeRateDocToBase: f.exchangeRateDocToBase,
  revenueAmountDoc: f.revenueAmountDoc,
  revenueAmountBase: f.revenueAmountBase,
  revenueDir: f.revenueDir,
  costAmountDoc: f.costAmountDoc,
  costAmountBase: f.costAmountBase,
  costDir: f.costDir,
  profitAmountDoc: f.profitAmountDoc,
  profitAmountBase: f.profitAmountBase,
  profitDir: f.profitDir,
  marginPct: f.marginPct,
  snapshotVersion: f.snapshotVersion,
  status: f.status,
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});

const toDomain = (data: any): SalesProfitLineFact => {
  const documentType = isProfitDocumentType(data.documentType) ? data.documentType : 'SALES_INVOICE';
  return {
    id: String(data.id),
    companyId: String(data.companyId),
    documentType,
    documentId: String(data.documentId),
    documentNumber: String(data.documentNumber ?? ''),
    documentLineId: String(data.documentLineId),
    documentDate: String(data.documentDate),
    itemId: String(data.itemId),
    qtyBase: Number(data.qtyBase ?? 0),
    uomId: String(data.uomId ?? ''),
    docCurrency: String(data.docCurrency),
    baseCurrency: String(data.baseCurrency),
    exchangeRateDocToBase: Number(data.exchangeRateDocToBase ?? 1),
    revenueAmountDoc: Number(data.revenueAmountDoc ?? 0),
    revenueAmountBase: Number(data.revenueAmountBase ?? 0),
    revenueDir: data.revenueDir === 'IN' || data.revenueDir === 'OUT' ? data.revenueDir : null,
    costAmountDoc: Number(data.costAmountDoc ?? 0),
    costAmountBase: Number(data.costAmountBase ?? 0),
    costDir: data.costDir === 'IN' || data.costDir === 'OUT' ? data.costDir : 'IN',
    profitAmountDoc: Number(data.profitAmountDoc ?? 0),
    profitAmountBase: Number(data.profitAmountBase ?? 0),
    profitDir: data.profitDir === 'IN' || data.profitDir === 'OUT' ? data.profitDir : 'IN',
    marginPct: Number(data.marginPct ?? 0),
    snapshotVersion: Number(data.snapshotVersion ?? 1),
    status: data.status === 'SUPERSEDED' || data.status === 'REVERSED' ? data.status : 'ACTIVE',
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
  };
};

const matchesFilters = (fact: SalesProfitLineFact, filters: ProfitFactFilters): boolean => {
  if (filters.fromDate && fact.documentDate < filters.fromDate) return false;
  if (filters.toDate && fact.documentDate > filters.toDate) return false;
  if (filters.documentId && fact.documentId !== filters.documentId) return false;
  if (filters.itemId && fact.itemId !== filters.itemId) return false;
  if (filters.docCurrency && fact.docCurrency !== filters.docCurrency) return false;
  if (filters.documentType) {
    const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
    if (!types.includes(fact.documentType)) return false;
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (!statuses.includes(fact.status)) return false;
  }
  return true;
};

const emptyCurrencyTotals = (docCurrency: string): ProfitFactCurrencyTotals => ({
  docCurrency,
  revenueAmountDocIn: 0,
  costAmountDocIn: 0,
  profitAmountDocIn: 0,
  revenueAmountDocOut: 0,
  costAmountDocOut: 0,
  profitAmountDocOut: 0,
  profitAmountDocNet: 0,
});

const finalizeCurrencyTotals = (
  row: ProfitFactAggregationRow & { _label: string; _docCurrencies: Map<string, ProfitFactCurrencyTotals> }
) => {
  const breakdown = Array.from(row._docCurrencies.values()).map((totals) => ({
    ...totals,
    profitAmountDocNet: totals.profitAmountDocIn - totals.profitAmountDocOut,
  }));
  row.docCurrencyBreakdown = breakdown;
  row.hasMixedDocCurrencies = breakdown.length > 1;
  row.docCurrency = breakdown.length === 1 ? breakdown[0].docCurrency : null;
  if (breakdown.length === 1) {
    const only = breakdown[0];
    row.revenueAmountDocIn = only.revenueAmountDocIn;
    row.costAmountDocIn = only.costAmountDocIn;
    row.profitAmountDocIn = only.profitAmountDocIn;
    row.revenueAmountDocOut = only.revenueAmountDocOut;
    row.costAmountDocOut = only.costAmountDocOut;
    row.profitAmountDocOut = only.profitAmountDocOut;
    row.profitAmountDocNet = only.profitAmountDocNet;
  } else {
    row.revenueAmountDocIn = 0;
    row.costAmountDocIn = 0;
    row.profitAmountDocIn = 0;
    row.revenueAmountDocOut = 0;
    row.costAmountDocOut = 0;
    row.profitAmountDocOut = 0;
    row.profitAmountDocNet = 0;
  }
};

const aggregateFacts = (
  facts: SalesProfitLineFact[],
  groupBy: (f: SalesProfitLineFact) => { key: string; label: string }
): ProfitFactAggregationRow[] => {
  const map = new Map<string, ProfitFactAggregationRow & { _label: string; _docCurrencies: Map<string, ProfitFactCurrencyTotals> }>();
  for (const f of facts) {
    const { key, label } = groupBy(f);
    let row = map.get(key);
    if (!row) {
      row = {
        _label: label,
        groupKey: key,
        groupLabel: label,
        lineCount: 0,
        revenueAmountBaseIn: 0,
        revenueAmountDocIn: 0,
        costAmountBaseIn: 0,
        costAmountDocIn: 0,
        profitAmountBaseIn: 0,
        profitAmountDocIn: 0,
        revenueAmountBaseOut: 0,
        revenueAmountDocOut: 0,
        costAmountBaseOut: 0,
        costAmountDocOut: 0,
        profitAmountBaseOut: 0,
        profitAmountDocOut: 0,
        profitAmountBaseNet: 0,
        profitAmountDocNet: 0,
        docCurrency: null,
        hasMixedDocCurrencies: false,
        docCurrencyBreakdown: [],
        _docCurrencies: new Map(),
      };
      map.set(key, row);
    }
    let currencyTotals = row._docCurrencies.get(f.docCurrency);
    if (!currencyTotals) {
      currencyTotals = emptyCurrencyTotals(f.docCurrency);
      row._docCurrencies.set(f.docCurrency, currencyTotals);
    }
    row.lineCount += 1;
    if (f.revenueDir === 'IN') {
      row.revenueAmountBaseIn += f.revenueAmountBase;
      currencyTotals.revenueAmountDocIn += f.revenueAmountDoc;
    } else if (f.revenueDir === 'OUT') {
      row.revenueAmountBaseOut += f.revenueAmountBase;
      currencyTotals.revenueAmountDocOut += f.revenueAmountDoc;
    }
    if (f.costDir === 'IN') {
      row.costAmountBaseIn += f.costAmountBase;
      currencyTotals.costAmountDocIn += f.costAmountDoc;
    } else {
      row.costAmountBaseOut += f.costAmountBase;
      currencyTotals.costAmountDocOut += f.costAmountDoc;
    }
    if (f.profitDir === 'IN') {
      row.profitAmountBaseIn += f.profitAmountBase;
      currencyTotals.profitAmountDocIn += f.profitAmountDoc;
    } else {
      row.profitAmountBaseOut += f.profitAmountBase;
      currencyTotals.profitAmountDocOut += f.profitAmountDoc;
    }
    row.profitAmountBaseNet = row.profitAmountBaseIn - row.profitAmountBaseOut;
  }
  return Array.from(map.values()).map((row) => {
    finalizeCurrencyTotals(row);
    const { _label, _docCurrencies, ...rest } = row;
    return rest;
  });
};

export class FirestoreSalesProfitLineFactRepository implements ISalesProfitLineFactRepository {
  constructor(private db: Firestore) {}

  async replaceForDocumentVersion(
    companyId: string,
    documentId: string,
    snapshotVersion: number,
    facts: SalesProfitLineFact[],
    transaction?: unknown
  ): Promise<void> {
    const tx = transaction as Transaction | undefined;
    const col = getCollection(this.db, companyId);
    for (const fact of facts) {
      if (fact.documentId !== documentId) {
        throw new Error(`replaceForDocumentVersion: fact ${fact.id} has documentId ${fact.documentId}, expected ${documentId}`);
      }
      if (fact.snapshotVersion !== snapshotVersion) {
        throw new Error(`replaceForDocumentVersion: fact ${fact.id} has snapshotVersion ${fact.snapshotVersion}, expected ${snapshotVersion}`);
      }
      const data = toPersistence(fact);
      if (tx) {
        tx.set(col.doc(fact.id), data);
      } else {
        await col.doc(fact.id).set(data);
      }
    }
  }

  async markSupersededForDocument(
    companyId: string,
    documentId: string,
    supersededByVersion: number,
    transaction?: unknown
  ): Promise<void> {
    const tx = transaction as Transaction | undefined;
    const col = getCollection(this.db, companyId);
    const query = col.where('documentId', '==', documentId).where('snapshotVersion', '<', supersededByVersion);
    const snap = tx ? await tx.get(query) : await query.get();
    const now = new Date().toISOString();
    for (const d of snap.docs) {
      const data = d.data() as any;
      if (data.status === 'REVERSED') continue;
      if (tx) {
        tx.update(d.ref, { status: 'SUPERSEDED', updatedAt: now });
      } else {
        await d.ref.update({ status: 'SUPERSEDED', updatedAt: now });
      }
    }
  }

  async markReversedForDocument(
    companyId: string,
    documentId: string,
    transaction?: unknown
  ): Promise<void> {
    const tx = transaction as Transaction | undefined;
    const col = getCollection(this.db, companyId);
    const query = col.where('documentId', '==', documentId).where('status', '==', 'ACTIVE');
    const snap = tx ? await tx.get(query) : await query.get();
    const now = new Date().toISOString();
    for (const d of snap.docs) {
      if (tx) {
        tx.update(d.ref, { status: 'REVERSED', updatedAt: now });
      } else {
        await d.ref.update({ status: 'REVERSED', updatedAt: now });
      }
    }
  }

  async queryFacts(companyId: string, filters: ProfitFactFilters): Promise<SalesProfitLineFact[]> {
    const col = getCollection(this.db, companyId);
    let query: FirebaseFirestore.Query = col;
    if (filters.documentId) query = query.where('documentId', '==', filters.documentId);
    if (filters.itemId) query = query.where('itemId', '==', filters.itemId);
    if (filters.docCurrency) query = query.where('docCurrency', '==', filters.docCurrency);
    if (filters.fromDate) query = query.where('documentDate', '>=', filters.fromDate);
    if (filters.toDate) query = query.where('documentDate', '<=', filters.toDate);
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (statuses.length === 1) query = query.where('status', '==', statuses[0]);
    }
    if (filters.documentType) {
      const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
      if (types.length === 1) query = query.where('documentType', '==', types[0]);
    }
    if (filters.fromDate || filters.toDate) {
      query = query.orderBy('documentDate', 'asc');
    }
    const limit = filters.limit ?? 5000;
    const snap = await query.limit(limit).get();
    const all = snap.docs.map((d) => toDomain(d.data()));
    return all.filter((f) => matchesFilters(f, filters));
  }

  async aggregateByDocument(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]> {
    const facts = await this.queryFacts(companyId, { ...filters, status: filters.status ?? 'ACTIVE' });
    return aggregateFacts(facts, (f) => ({
      key: `${f.documentType}::${f.documentId}`,
      label: `${f.documentNumber} (${f.documentType})`,
    }));
  }

  async aggregateByItem(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]> {
    const facts = await this.queryFacts(companyId, { ...filters, status: filters.status ?? 'ACTIVE' });
    return aggregateFacts(facts, (f) => ({ key: f.itemId, label: f.itemId }));
  }
}
