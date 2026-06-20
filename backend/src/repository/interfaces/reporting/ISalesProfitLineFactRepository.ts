import { ProfitFactStatus, ProfitDocumentType, SalesProfitLineFact } from '../../../domain/reporting/entities/SalesProfitLineFact';

export interface ProfitFactFilters {
  fromDate?: string; // ISO YYYY-MM-DD inclusive
  toDate?: string;   // ISO YYYY-MM-DD inclusive
  documentType?: ProfitDocumentType | ProfitDocumentType[];
  documentId?: string;
  itemId?: string;
  docCurrency?: string;
  status?: ProfitFactStatus | ProfitFactStatus[];
  limit?: number;
}

export interface ProfitFactAggregationRow {
  // group key (one of: documentId+documentType+documentNumber, or itemId)
  groupKey: string;
  // human label for the group
  groupLabel: string;
  // counts
  lineCount: number;
  // IN-side totals
  revenueAmountBaseIn: number;
  revenueAmountDocIn: number;
  costAmountBaseIn: number;
  costAmountDocIn: number;
  profitAmountBaseIn: number;
  profitAmountDocIn: number;
  // OUT-side totals
  revenueAmountBaseOut: number;
  revenueAmountDocOut: number;
  costAmountBaseOut: number;
  costAmountDocOut: number;
  profitAmountBaseOut: number;
  profitAmountDocOut: number;
  // net = IN - OUT
  profitAmountBaseNet: number;
  profitAmountDocNet: number;
}

export interface ISalesProfitLineFactRepository {
  /**
   * Atomically replaces the set of facts for one (documentId, snapshotVersion).
   * Use the same `transaction` handle that the posting use case is using,
   * so fact writes participate in the posting transaction.
   */
  replaceForDocumentVersion(
    companyId: string,
    documentId: string,
    snapshotVersion: number,
    facts: SalesProfitLineFact[],
    transaction?: unknown
  ): Promise<void>;

  /** Marks all prior-version facts for a document as SUPERSEDED. */
  markSupersededForDocument(
    companyId: string,
    documentId: string,
    supersededByVersion: number,
    transaction?: unknown
  ): Promise<void>;

  /** Marks all ACTIVE facts for a document as REVERSED. */
  markReversedForDocument(
    companyId: string,
    documentId: string,
    transaction?: unknown
  ): Promise<void>;

  /** Raw fact query. */
  queryFacts(companyId: string, filters: ProfitFactFilters): Promise<SalesProfitLineFact[]>;

  /** Group facts by document. */
  aggregateByDocument(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]>;

  /** Group facts by item. */
  aggregateByItem(companyId: string, filters: ProfitFactFilters): Promise<ProfitFactAggregationRow[]>;
}
