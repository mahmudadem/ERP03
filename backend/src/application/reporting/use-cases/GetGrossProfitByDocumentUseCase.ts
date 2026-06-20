/**
 * GetGrossProfitByDocumentUseCase — Task 246
 *
 * Groups profit facts by document (any invoice type) for the given filters.
 * Returns base-currency IN/OUT/net totals AND per-doc-currency IN/OUT/net
 * totals. Read-only; the user/owner decides how to display IN vs OUT.
 */
import { PermissionChecker } from '../../rbac/PermissionChecker';
import {
  ISalesProfitLineFactRepository,
  ProfitFactAggregationRow,
  ProfitFactFilters,
} from '../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import { ProfitDocumentType } from '../../../domain/reporting/entities/SalesProfitLineFact';

export interface GetGrossProfitByDocumentInput {
  companyId: string;
  userId: string;
  fromDate?: string;
  toDate?: string;
  documentType?: ProfitDocumentType | ProfitDocumentType[];
  itemId?: string;
  docCurrency?: string;
  limit?: number;
}

export interface GetGrossProfitByDocumentOutput {
  fromDate?: string;
  toDate?: string;
  documentType?: ProfitDocumentType | ProfitDocumentType[];
  rows: ProfitFactAggregationRow[];
  totals: {
    lineCount: number;
    profitBaseNet: number;
    profitBaseIn: number;
    profitBaseOut: number;
    revenueBaseIn: number;
    revenueBaseOut: number;
    costBaseIn: number;
    costBaseOut: number;
  };
}

export class GetGrossProfitByDocumentUseCase {
  constructor(
    private readonly factRepo: ISalesProfitLineFactRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(input: GetGrossProfitByDocumentInput): Promise<GetGrossProfitByDocumentOutput> {
    // Use a broad read permission for v1; tighten via a dedicated
    // 'reporting.salesProfit.view' permission later if needed.
    await this.permissionChecker.assertOrThrow(
      input.userId,
      input.companyId,
      'accounting.reports.tradingAccount.view'
    );

    const filters: ProfitFactFilters = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      documentType: input.documentType,
      itemId: input.itemId,
      docCurrency: input.docCurrency,
      status: 'ACTIVE',
      limit: input.limit ?? 5000,
    };

    const rows = await this.factRepo.aggregateByDocument(input.companyId, filters);
    const totals = rows.reduce(
      (acc, r) => ({
        lineCount: acc.lineCount + r.lineCount,
        profitBaseNet: acc.profitBaseNet + r.profitAmountBaseNet,
        profitBaseIn: acc.profitBaseIn + r.profitAmountBaseIn,
        profitBaseOut: acc.profitBaseOut + r.profitAmountBaseOut,
        revenueBaseIn: acc.revenueBaseIn + r.revenueAmountBaseIn,
        revenueBaseOut: acc.revenueBaseOut + r.revenueAmountBaseOut,
        costBaseIn: acc.costBaseIn + r.costAmountBaseIn,
        costBaseOut: acc.costBaseOut + r.costAmountBaseOut,
      }),
      {
        lineCount: 0,
        profitBaseNet: 0,
        profitBaseIn: 0,
        profitBaseOut: 0,
        revenueBaseIn: 0,
        revenueBaseOut: 0,
        costBaseIn: 0,
        costBaseOut: 0,
      }
    );

    return {
      fromDate: input.fromDate,
      toDate: input.toDate,
      documentType: input.documentType,
      rows,
      totals,
    };
  }
}
