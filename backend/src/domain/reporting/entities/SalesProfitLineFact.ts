/**
 * SalesProfitLineFact — read model for sales/profit reporting (Task 246).
 *
 * This is a management reporting read model, NOT an accounting posting.
 * It MUST NOT change GL vouchers, COGS posting, inventory valuation,
 * stock movement costing, FX revaluation, Trading Account, P&L, tax
 * posting, or AR/AP balances. See planning/tasks/246.
 *
 * One fact per posted invoice line, generated atomically inside the
 * underlying posting transaction. The shape is type-agnostic: the
 * `documentType` field is the discriminator; the direction flags let
 * reports separate IN-side and OUT-side metrics by user choice.
 *
 * Per-type direction rules (LOCKED 2026-06-20):
 *   - SI:  revDir=IN,  costDir=OUT → profitDir follows revenue (opposite on net loss)
 *   - SR:  revDir=OUT, costDir=IN  → profitDir follows revenue (opposite on net gain)
 *   - PI:  rev=0,     costDir=IN  → profitDir=OUT (cost is a loss)
 *   - PR:  rev=0,     costDir=OUT → profitDir=IN  (cost reversal is a gain)
 */

export type ProfitDocumentType =
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN';

export type ProfitDirection = 'IN' | 'OUT';

export type ProfitFactStatus = 'ACTIVE' | 'SUPERSEDED' | 'REVERSED';

export interface SalesProfitLineFact {
  // Deterministic id: `${companyId}_${documentId}_${documentLineId}_${snapshotVersion}`
  id: string;
  companyId: string;

  documentType: ProfitDocumentType;
  documentId: string;
  documentNumber: string; // display only
  documentLineId: string;
  documentDate: string; // ISO date
  itemId: string;
  qtyBase: number;
  uomId: string;

  // Currency
  docCurrency: string;
  baseCurrency: string;
  exchangeRateDocToBase: number;

  // Revenue (absolute + direction). amount is always non-negative.
  revenueAmountDoc: number;
  revenueAmountBase: number;
  revenueDir: ProfitDirection | null; // null when revenueAmount = 0

  // Cost (absolute + direction). amount is always non-negative.
  costAmountDoc: number;
  costAmountBase: number;
  costDir: ProfitDirection;

  // Profit (absolute + direction; precomputed at snapshot time).
  profitAmountDoc: number;
  profitAmountBase: number;
  profitDir: ProfitDirection;

  // Margin in percent (denominator = absolute revenue). 0 when revenue = 0.
  marginPct: number;

  snapshotVersion: number;
  status: ProfitFactStatus;

  createdAt: string;
  updatedAt: string;
}

export interface SalesProfitLineFactInput {
  companyId: string;
  documentType: ProfitDocumentType;
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
  // Absolute amounts (always non-negative). Direction is derived from
  // the per-type table at snapshot time.
  revenueAmountDoc: number;
  revenueAmountBase: number;
  costAmountDoc: number;
  costAmountBase: number;
  snapshotVersion: number;
  status?: ProfitFactStatus;
}

export const buildSalesProfitLineFact = (input: SalesProfitLineFactInput): SalesProfitLineFact => {
  const rule = resolveDirection(input.documentType);
  const now = new Date().toISOString();

  const revenueAmountDoc = Math.abs(input.revenueAmountDoc);
  const revenueAmountBase = Math.abs(input.revenueAmountBase);
  const costAmountDoc = Math.abs(input.costAmountDoc);
  const costAmountBase = Math.abs(input.costAmountBase);

  const revenueDir: ProfitDirection | null = revenueAmountDoc > 0 ? rule.revenueDir : null;
  const costDir: ProfitDirection = rule.costDir;

  // Profit amount is the absolute difference between revenue and cost.
  const profitSignedDoc = revenueAmountDoc - costAmountDoc;
  const profitSignedBase = revenueAmountBase - costAmountBase;
  const profitAmountDoc = Math.abs(profitSignedDoc);
  const profitAmountBase = Math.abs(profitSignedBase);

  // Profit direction rule:
  //   rev > 0 → follows revenueDir; flips to opposite if net is negative
  //     (SI revDir=IN, loss  ⇒ profitDir=OUT; SR revDir=OUT, net gain ⇒ profitDir=IN)
  //   rev = 0 → always opposite of costDir
  //     (PI costDir=IN ⇒ profitDir=OUT; PR costDir=OUT ⇒ profitDir=IN)
  let profitDir: ProfitDirection;
  if (revenueAmountDoc > 0) {
    profitDir = profitSignedDoc >= 0 ? rule.revenueDir : opposite(rule.revenueDir);
  } else {
    profitDir = opposite(rule.costDir);
  }

  const marginPct = revenueAmountDoc === 0
    ? 0
    : (profitSignedDoc / revenueAmountDoc) * 100;

  return {
    id: `${input.companyId}_${input.documentId}_${input.documentLineId}_${input.snapshotVersion}`,
    companyId: input.companyId,
    documentType: input.documentType,
    documentId: input.documentId,
    documentNumber: input.documentNumber,
    documentLineId: input.documentLineId,
    documentDate: input.documentDate,
    itemId: input.itemId,
    qtyBase: input.qtyBase,
    uomId: input.uomId,
    docCurrency: input.docCurrency,
    baseCurrency: input.baseCurrency,
    exchangeRateDocToBase: input.exchangeRateDocToBase,
    revenueAmountDoc,
    revenueAmountBase,
    revenueDir,
    costAmountDoc,
    costAmountBase,
    costDir,
    profitAmountDoc,
    profitAmountBase,
    profitDir,
    marginPct,
    snapshotVersion: input.snapshotVersion,
    status: input.status ?? 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
};

const opposite = (d: ProfitDirection): ProfitDirection => (d === 'IN' ? 'OUT' : 'IN');

export interface ProfitDirectionRule {
  revenueDir: ProfitDirection; // ignored when revenueAmount = 0
  costDir: ProfitDirection;
}

const DIRECTION_TABLE: Record<ProfitDocumentType, ProfitDirectionRule> = {
  SALES_INVOICE: { revenueDir: 'IN', costDir: 'OUT' },
  SALES_RETURN: { revenueDir: 'OUT', costDir: 'IN' },
  PURCHASE_INVOICE: { revenueDir: 'IN', costDir: 'IN' },
  PURCHASE_RETURN: { revenueDir: 'IN', costDir: 'OUT' },
};

export const resolveDirection = (docType: ProfitDocumentType): ProfitDirectionRule => {
  const rule = DIRECTION_TABLE[docType];
  if (!rule) {
    throw new Error(`Unknown documentType: ${docType as string}`);
  }
  return rule;
};

export const isProfitDocumentType = (value: unknown): value is ProfitDocumentType =>
  value === 'SALES_INVOICE' ||
  value === 'SALES_RETURN' ||
  value === 'PURCHASE_INVOICE' ||
  value === 'PURCHASE_RETURN';
