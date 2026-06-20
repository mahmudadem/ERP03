/**
 * GetGrossProfitByItemUseCase — Task 246
 *
 * Groups profit facts by item for the given filters. Same output shape
 * as the by-document report, but the group key is itemId.
 */
import { PermissionChecker } from '../../rbac/PermissionChecker';
import {
  ISalesProfitLineFactRepository,
  ProfitFactAggregationRow,
  ProfitFactFilters,
} from '../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';
import { ProfitDocumentType } from '../../../domain/reporting/entities/SalesProfitLineFact';

const DEFAULT_SALES_PROFIT_DOCUMENT_TYPES: ProfitDocumentType[] = [
  'SALES_INVOICE',
  'SALES_RETURN',
];

export interface GetGrossProfitByItemInput {
  companyId: string;
  userId: string;
  fromDate?: string;
  toDate?: string;
  documentType?: ProfitDocumentType | ProfitDocumentType[];
  itemId?: string;
  docCurrency?: string;
  limit?: number;
}

export interface GetGrossProfitByItemOutput {
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

export class GetGrossProfitByItemUseCase {
  constructor(
    private readonly factRepo: ISalesProfitLineFactRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(input: GetGrossProfitByItemInput): Promise<GetGrossProfitByItemOutput> {
    await this.permissionChecker.assertOrThrow(
      input.userId,
      input.companyId,
      'accounting.reports.tradingAccount.view'
    );

    const filters: ProfitFactFilters = {
      fromDate: input.fromDate,
      toDate: input.toDate,
      documentType: input.documentType ?? DEFAULT_SALES_PROFIT_DOCUMENT_TYPES,
      itemId: input.itemId,
      docCurrency: input.docCurrency,
      status: 'ACTIVE',
      limit: input.limit ?? 5000,
    };

    const rows = await this.factRepo.aggregateByItem(input.companyId, filters);
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
