import { Prisma, PrismaClient } from '@prisma/client';
import {
  ProfitFactAggregationRow,
  ProfitFactCurrencyTotals,
  ProfitFactFilters,
  ISalesProfitLineFactRepository,
} from '../../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import {
  ProfitDocumentType,
  SalesProfitLineFact,
  isProfitDocumentType,
} from '../../../../domain/reporting/entities/SalesProfitLineFact';

type PrismaFactRow = {
  id: string;
  companyId: string;
  documentType: string;
  documentId: string;
  documentNumber: string;
  documentLineId: string;
  documentDate: string;
  itemId: string;
  qtyBase: number;
  uomId: string;
  docCurrency: string;
  baseCurrency: string;
  exchangeRateDocToBase: number;
  revenueAmountDoc: number;
  revenueAmountBase: number;
  revenueDir: string | null;
  costAmountDoc: number;
  costAmountBase: number;
  costDir: string;
  profitAmountDoc: number;
  profitAmountBase: number;
  profitDir: string;
  marginPct: number;
  snapshotVersion: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const toDomain = (row: PrismaFactRow): SalesProfitLineFact => ({
  id: row.id,
  companyId: row.companyId,
  documentType: isProfitDocumentType(row.documentType) ? row.documentType : 'SALES_INVOICE',
  documentId: row.documentId,
  documentNumber: row.documentNumber,
  documentLineId: row.documentLineId,
  documentDate: row.documentDate,
  itemId: row.itemId,
  qtyBase: row.qtyBase,
  uomId: row.uomId,
  docCurrency: row.docCurrency,
  baseCurrency: row.baseCurrency,
  exchangeRateDocToBase: row.exchangeRateDocToBase,
  revenueAmountDoc: row.revenueAmountDoc,
  revenueAmountBase: row.revenueAmountBase,
  revenueDir: row.revenueDir === 'IN' || row.revenueDir === 'OUT' ? row.revenueDir : null,
  costAmountDoc: row.costAmountDoc,
  costAmountBase: row.costAmountBase,
  costDir: row.costDir === 'IN' || row.costDir === 'OUT' ? row.costDir : 'IN',
  profitAmountDoc: row.profitAmountDoc,
  profitAmountBase: row.profitAmountBase,
  profitDir: row.profitDir === 'IN' || row.profitDir === 'OUT' ? row.profitDir : 'IN',
  marginPct: row.marginPct,
  snapshotVersion: row.snapshotVersion,
  status: row.status === 'SUPERSEDED' || row.status === 'REVERSED' ? row.status : 'ACTIVE',
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const buildWhere = (companyId: string, filters: ProfitFactFilters): Record<string, unknown> => {
  const where: Record<string, unknown> = { companyId };
  if (filters.documentId) where.documentId = filters.documentId;
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.docCurrency) where.docCurrency = filters.docCurrency;
  if (filters.documentType) {
    const types = Array.isArray(filters.documentType) ? filters.documentType : [filters.documentType];
    if (types.length === 1) where.documentType = types[0];
    else where.documentType = { in: types };
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) where.status = statuses[0];
    else where.status = { in: statuses };
  }
  if (filters.fromDate) where.documentDate = { ...(where.documentDate as object ?? {}), gte: filters.fromDate };
  if (filters.toDate) where.documentDate = { ...(where.documentDate as object ?? {}), lte: filters.toDate };
  return where;
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

export class PrismaSalesProfitLineFactRepository implements ISalesProfitLineFactRepository {
  constructor(private prisma: PrismaClient) {}

  async replaceForDocumentVersion(
    companyId: string,
    documentId: string,
    snapshotVersion: number,
    facts: SalesProfitLineFact[],
    transaction?: unknown
  ): Promise<void> {
    const tx = (transaction as Prisma.TransactionClient) || this.prisma;
    for (const fact of facts) {
      if (fact.documentId !== documentId) {
        throw new Error(`replaceForDocumentVersion: fact ${fact.id} has documentId ${fact.documentId}, expected ${documentId}`);
      }
      if (fact.snapshotVersion !== snapshotVersion) {
        throw new Error(`replaceForDocumentVersion: fact ${fact.id} has snapshotVersion ${fact.snapshotVersion}, expected ${snapshotVersion}`);
      }
      await tx.salesProfitLineFact.upsert({
        where: { id: fact.id },
        create: {
          id: fact.id,
          // companyId is set via the `company` relation connect below.
          documentType: fact.documentType,
          documentId: fact.documentId,
          documentNumber: fact.documentNumber,
          documentLineId: fact.documentLineId,
          documentDate: fact.documentDate,
          itemId: fact.itemId,
          qtyBase: fact.qtyBase,
          uomId: fact.uomId,
          docCurrency: fact.docCurrency,
          baseCurrency: fact.baseCurrency,
          exchangeRateDocToBase: fact.exchangeRateDocToBase,
          revenueAmountDoc: fact.revenueAmountDoc,
          revenueAmountBase: fact.revenueAmountBase,
          revenueDir: fact.revenueDir,
          costAmountDoc: fact.costAmountDoc,
          costAmountBase: fact.costAmountBase,
          costDir: fact.costDir,
          profitAmountDoc: fact.profitAmountDoc,
          profitAmountBase: fact.profitAmountBase,
          profitDir: fact.profitDir,
          marginPct: fact.marginPct,
          snapshotVersion: fact.snapshotVersion,
          status: fact.status,
          company: { connect: { id: fact.companyId } },
        },
        update: {
          documentType: fact.documentType,
          documentId: fact.documentId,
          documentNumber: fact.documentNumber,
          documentLineId: fact.documentLineId,
          documentDate: fact.documentDate,
          itemId: fact.itemId,
          qtyBase: fact.qtyBase,
          uomId: fact.uomId,
          docCurrency: fact.docCurrency,
          baseCurrency: fact.baseCurrency,
          exchangeRateDocToBase: fact.exchangeRateDocToBase,
          revenueAmountDoc: fact.revenueAmountDoc,
          revenueAmountBase: fact.revenueAmountBase,
          revenueDir: fact.revenueDir,
          costAmountDoc: fact.costAmountDoc,
          costAmountBase: fact.costAmountBase,
          costDir: fact.costDir,
          profitAmountDoc: fact.profitAmountDoc,
          profitAmountBase: fact.profitAmountBase,
          profitDir: fact.profitDir,
          marginPct: fact.marginPct,
          status: fact.status,
        },
      });
    }
  }

  async markSupersededForDocument(
    companyId: string,
    documentId: string,
    supersededByVersion: number,
    transaction?: unknown
  ): Promise<void> {
    const tx = (transaction as Prisma.TransactionClient) || this.prisma;
    await tx.salesProfitLineFact.updateMany({
      where: {
        companyId,
        documentId,
        snapshotVersion: { lt: supersededByVersion },
        status: 'ACTIVE',
      },
      data: { status: 'SUPERSEDED', updatedAt: new Date() },
    });
  }

  async markReversedForDocument(
    companyId: string,
    documentId: string,
    transaction?: unknown
  ): Promise<void> {
    const tx = (transaction as Prisma.TransactionClient) || this.prisma;
    await tx.salesProfitLineFact.updateMany({
      where: { companyId, documentId, status: 'ACTIVE' },
      data: { status: 'REVERSED', updatedAt: new Date() },
    });
  }

  async queryFacts(companyId: string, filters: ProfitFactFilters): Promise<SalesProfitLineFact[]> {
    const rows = await this.prisma.salesProfitLineFact.findMany({
      where: buildWhere(companyId, filters),
      orderBy: { documentDate: 'asc' },
      take: filters.limit ?? 5000,
    });
    return rows.map((r) => toDomain(r as PrismaFactRow));
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
