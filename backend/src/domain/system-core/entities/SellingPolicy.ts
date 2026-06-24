/**
 * SellingPolicy — Company-level commercial selling policy.
 *
 * A SHARED System Core policy: it is owned by no single module and consumed by
 * several. Today it carries the below-cost / minimum-margin rule that both the
 * POS app (`PostPosSaleUseCase`) and the Sales app (`PostSalesInvoiceUseCase`)
 * honour through the Commercial Core's `validateCostMargin` and the Policy
 * Engine's `commercial/belowCostSale` resolve.
 *
 * This is deliberately NOT stored on `PosSettings` or `SalesSettings`: the rule
 * is a single company-wide commercial control, so one store keeps POS and Sales
 * in agreement instead of letting two module settings drift apart.
 *
 *  - `belowCostMode`:
 *      - `BLOCK`            — a below-cost (or below-min-margin) sale line is
 *        refused outright; no approval can let it through.
 *      - `REQUIRE_APPROVAL` (default) — the line is blocked pending a manager
 *        approval/override; an approved override lets it post. This is the
 *        behaviour POS had before the policy existed.
 *      - `ALLOW`            — below-cost sale lines post freely, no check.
 *  - `minMarginPercent`    — optional minimum gross-margin %. When set, a line
 *    whose margin is below it is treated like a below-cost line for the mode.
 *  - `allowManagerOverride` — when `false`, even an approved override cannot
 *    bypass a BLOCK/REQUIRE_APPROVAL violation (absolute control).
 */

export type BelowCostMode = 'BLOCK' | 'REQUIRE_APPROVAL' | 'ALLOW';

export interface SellingPolicyProps {
  companyId: string;
  belowCostMode?: BelowCostMode;
  minMarginPercent?: number;
  allowManagerOverride?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const VALID_BELOW_COST_MODES: BelowCostMode[] = ['BLOCK', 'REQUIRE_APPROVAL', 'ALLOW'];

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const normalizeMargin = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

export class SellingPolicy {
  readonly companyId: string;
  belowCostMode: BelowCostMode;
  minMarginPercent?: number;
  allowManagerOverride: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: SellingPolicyProps) {
    if (!props.companyId?.trim()) throw new Error('SellingPolicy companyId is required');
    this.companyId = props.companyId.trim();
    this.belowCostMode = VALID_BELOW_COST_MODES.includes(props.belowCostMode as BelowCostMode)
      ? (props.belowCostMode as BelowCostMode)
      : 'REQUIRE_APPROVAL';
    this.minMarginPercent = normalizeMargin(props.minMarginPercent);
    this.allowManagerOverride = props.allowManagerOverride !== false; // default true
    this.createdAt = toDate(props.createdAt);
    this.updatedAt = toDate(props.updatedAt);
  }

  /**
   * Safe default: preserve the protective behaviour POS had before the policy
   * existed (below-cost requires approval), applied company-wide.
   */
  static createDefault(companyId: string): SellingPolicy {
    return new SellingPolicy({ companyId, belowCostMode: 'REQUIRE_APPROVAL', allowManagerOverride: true });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      belowCostMode: this.belowCostMode,
      minMarginPercent: this.minMarginPercent,
      allowManagerOverride: this.allowManagerOverride,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): SellingPolicy {
    return new SellingPolicy({
      companyId: data.companyId,
      belowCostMode: data.belowCostMode,
      minMarginPercent: data.minMarginPercent,
      allowManagerOverride: data.allowManagerOverride,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
