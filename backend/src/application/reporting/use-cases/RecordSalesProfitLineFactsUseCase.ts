import {
  ProfitDocumentType,
  SalesProfitLineFact,
  buildSalesProfitLineFact,
} from '../../../domain/reporting/entities/SalesProfitLineFact';
import {
  ISalesProfitLineFactRepository,
} from '../../../repository/interfaces/reporting/ISalesProfitLineFactRepository';

/**
 * Posted line shape consumed by the snapshot generator.
 *
 * The caller is the SI/SR/PI/PR posting use case. Amounts are always
 * non-negative; direction is determined by the per-type table inside
 * `buildSalesProfitLineFact`, NOT by the caller. This keeps the rule
 * out of every posting use case.
 *
 * Per-type mapping rules (caller must apply):
 *   - SI / SR:  revenueBase = lineTotalBase, revenueDoc = lineTotalDoc,
 *               costBase = lineCostBase, costDoc = lineCostBase / exchangeRate
 *   - PI / PR:  revenueBase/Doc = 0,
 *               costBase = lineTotalBase, costDoc = lineTotalDoc
 *
 * SR special: line.lineCostBase on a posted SR already reflects the
 *   cost basis selection done by the SR posting (original SI cost for
 *   post-invoice returns, or stock-level avg for direct returns). The
 *   fact just records whatever was actually posted. No re-derivation.
 */
export interface PostedLineForProfitFact {
  lineId: string;
  itemId: string;
  qtyBase: number;
  uomId: string;
  revenueAmountDoc: number;
  revenueAmountBase: number;
  costAmountDoc: number;
  costAmountBase: number;
  exchangeRateDocToBase: number;
}

export interface RecordSalesProfitFactsInput {
  companyId: string;
  documentType: ProfitDocumentType;
  documentId: string;
  documentNumber: string;
  documentDate: string; // ISO YYYY-MM-DD
  docCurrency: string; // document currency (e.g. "USD" on a USD invoice)
  baseCurrency: string; // company base currency (e.g. "SYP")
  snapshotVersion: number;
  lines: PostedLineForProfitFact[];
  /**
   * Optional Firestore/Prisma transaction handle. When provided, the fact
   * writes participate in the underlying posting transaction so reports
   * never miss a posted invoice and fact failure rolls back the posting.
   */
  transaction?: unknown;
}

export interface RecordSalesProfitFactsOutput {
  facts: SalesProfitLineFact[];
  writtenCount: number;
}

export class RecordSalesProfitLineFactsUseCase {
  constructor(private readonly factRepo: ISalesProfitLineFactRepository) {}

  async execute(input: RecordSalesProfitFactsInput): Promise<RecordSalesProfitFactsOutput> {
    if (input.lines.length === 0) {
      return { facts: [], writtenCount: 0 };
    }

    const facts: SalesProfitLineFact[] = input.lines.map((line) =>
      buildSalesProfitLineFact({
        companyId: input.companyId,
        documentType: input.documentType,
        documentId: input.documentId,
        documentNumber: input.documentNumber,
        documentLineId: line.lineId,
        documentDate: input.documentDate,
        itemId: line.itemId,
        qtyBase: line.qtyBase,
        uomId: line.uomId,
        docCurrency: input.docCurrency,
        baseCurrency: input.baseCurrency,
        exchangeRateDocToBase: line.exchangeRateDocToBase,
        revenueAmountDoc: line.revenueAmountDoc,
        revenueAmountBase: line.revenueAmountBase,
        costAmountDoc: line.costAmountDoc,
        costAmountBase: line.costAmountBase,
        snapshotVersion: input.snapshotVersion,
      })
    );

    await this.factRepo.replaceForDocumentVersion(
      input.companyId,
      input.documentId,
      input.snapshotVersion,
      facts,
      input.transaction
    );

    return { facts, writtenCount: facts.length };
  }
}
