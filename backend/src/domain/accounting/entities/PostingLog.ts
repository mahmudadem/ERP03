/**
 * PostingLog — auditability record for cross-module postings.
 *
 * Every time a Sales / Purchases / Inventory document is posted and produces one
 * or more vouchers + ledger entries, a single PostingLog row is written in the
 * same Firestore transaction. The log answers the questions:
 *   - Which vouchers did this document generate?
 *   - Which posting strategy ran?
 *   - For each line, which account was resolved, and from where?
 *   - Was anything skipped? Why?
 *   - Were any warnings produced (e.g. unsettled cost basis)?
 *
 * Reads: GET /tenant/accounting/posting-logs?sourceId=<id> (PR2.4) returns the
 * record(s) for a given source document. The frontend GL Impact preview (P1)
 * will consume this directly.
 */

export type PostingSourceModule = 'sales' | 'purchases' | 'inventory' | 'accounting' | 'pos';

export type PostingSourceType =
  | 'SALES_INVOICE'
  | 'SALES_RETURN'
  | 'DELIVERY_NOTE'
  | 'SALES_RECEIPT'
  | 'PURCHASE_INVOICE'
  | 'PURCHASE_RETURN'
  | 'GOODS_RECEIPT'
  | 'PURCHASE_PAYMENT'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'OPENING_STOCK'
  | 'MANUAL_VOUCHER'
  | 'POS_SALE'
  | 'POS_RETURN'
  | 'POS_SHIFT';

export type CogsPostingStatus =
  | 'POSTED'
  | 'SKIPPED_POSTED_AT_DN'
  | 'SKIPPED_SERVICE_ITEM'
  | 'SKIPPED_DEFERRED_POLICY'
  | 'SKIPPED_UNSETTLED_COST';

export type AccountFallbackLevel = 'item' | 'category' | 'inventorySettings' | 'salesSettings' | 'purchaseSettings' | 'customer' | 'vendor' | 'taxCode' | 'companyDefault';

export interface ResolvedAccount {
  /** Account ID that was actually used in the voucher line. */
  resolvedId: string;
  /** Which configuration level provided this account. */
  fallbackLevel: AccountFallbackLevel;
}

export interface LineDecision {
  /** Source line identifier (e.g. SalesInvoiceLine.lineNo or a generated id). */
  lineNo: number;
  /** Optional item reference for stock lines. */
  itemId?: string;
  /** Account resolutions for this line. Keys correspond to roles in the voucher. */
  accounts: {
    revenue?: ResolvedAccount;
    cogs?: ResolvedAccount;
    inventory?: ResolvedAccount;
    tax?: ResolvedAccount;
    ar?: ResolvedAccount;
    ap?: ResolvedAccount;
    discount?: ResolvedAccount;
    grni?: ResolvedAccount;
    expense?: ResolvedAccount;
  };
  /** Reason if COGS posting was skipped on this line. null when COGS posted normally or N/A. */
  cogsPostingStatus?: CogsPostingStatus | null;
  /** Per-line note. */
  note?: string;
}

export interface PostingLogProps {
  id: string;
  companyId: string;
  sourceModule: PostingSourceModule;
  sourceType: PostingSourceType;
  sourceId: string;
  /** Document number for human readability. */
  sourceDocNumber?: string;
  /** Posting strategy name (e.g. 'SalesInvoiceStrategy'). */
  strategy: string;
  /** IDs of every voucher produced. Includes COGS voucher, receipt/payment voucher, etc. */
  voucherIds: string[];
  /** Decisions per line. */
  decisions: LineDecision[];
  /** Free-form warnings (e.g. "Line 3 used LAST_KNOWN cost basis"). */
  warnings: string[];
  /** Idempotency-Key header from the originating HTTP request, if any. */
  idempotencyKey?: string;
  postedAt: Date;
  postedBy: string;
}

export class PostingLog {
  readonly id: string;
  readonly companyId: string;
  readonly sourceModule: PostingSourceModule;
  readonly sourceType: PostingSourceType;
  readonly sourceId: string;
  readonly sourceDocNumber?: string;
  readonly strategy: string;
  readonly voucherIds: string[];
  readonly decisions: LineDecision[];
  readonly warnings: string[];
  readonly idempotencyKey?: string;
  readonly postedAt: Date;
  readonly postedBy: string;

  constructor(props: PostingLogProps) {
    if (!props.id?.trim()) throw new Error('PostingLog id is required');
    if (!props.companyId?.trim()) throw new Error('PostingLog companyId is required');
    if (!props.sourceId?.trim()) throw new Error('PostingLog sourceId is required');
    if (!props.strategy?.trim()) throw new Error('PostingLog strategy is required');
    if (!Array.isArray(props.voucherIds)) throw new Error('PostingLog voucherIds must be an array');
    if (!Array.isArray(props.decisions)) throw new Error('PostingLog decisions must be an array');
    if (!Array.isArray(props.warnings)) throw new Error('PostingLog warnings must be an array');

    this.id = props.id;
    this.companyId = props.companyId;
    this.sourceModule = props.sourceModule;
    this.sourceType = props.sourceType;
    this.sourceId = props.sourceId;
    this.sourceDocNumber = props.sourceDocNumber;
    this.strategy = props.strategy;
    this.voucherIds = [...props.voucherIds];
    this.decisions = props.decisions.map((d) => ({ ...d, accounts: { ...d.accounts } }));
    this.warnings = [...props.warnings];
    this.idempotencyKey = props.idempotencyKey;
    this.postedAt = props.postedAt;
    this.postedBy = props.postedBy;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      sourceModule: this.sourceModule,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceDocNumber: this.sourceDocNumber,
      strategy: this.strategy,
      voucherIds: this.voucherIds,
      decisions: this.decisions,
      warnings: this.warnings,
      idempotencyKey: this.idempotencyKey,
      postedAt: this.postedAt,
      postedBy: this.postedBy,
    };
  }
}
