/**
 * PosSettings — Company-level configuration for the POS module.
 *
 * Holds operational policy (require open shift, walk-in customer, over/short
 * accounts), receipt-numbering sequence, payment-method → settlement-account
 * mapping, and the `allowPosDirectSales` toggle resolved by the POS/System Core
 * policy layer.
 */

export type PosPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

export interface PosPaymentMethodConfig {
  code: PosPaymentMethodCode;
  /** GL settlement account id used by the Sales compatibility posting path. */
  settlementAccountId: string;
  label?: string;
  /** Some methods (card, bank transfer) require a customer reference. */
  requiresReference: boolean;
  /** Only CASH may give change. */
  allowsChange: boolean;
  isEnabled: boolean;
}

export type PosCashRounding = 'none' | 'nearest_05' | 'nearest_1';

/**
 * POS-specific negative-stock policy. This is deliberately distinct from the
 * company-wide `InventorySettings.allowNegativeStock` flag: a POS sale is a
 * physical hand-over at the till, so it must be able to refuse overselling even
 * when back-office (invoice-driven) sales are allowed to go negative.
 *
 *  - `BLOCK` (default) — POS refuses a sale that would drive on-hand below zero,
 *    regardless of the company inventory flag. POS is independently strict.
 *  - `ALLOW`           — POS defers to the company inventory flag (which may
 *    still block via `NegativeStockError` inside the inventory OUT).
 *
 * POS can therefore only be the *same as* or *stricter than* the company flag,
 * never looser. ("Allow with manager approval" is a reserved future value that
 * will land with the Approval-Engine override work — see Task 257.)
 */
export type PosNegativeStockPolicy = 'BLOCK' | 'ALLOW';

export interface PosSettingsProps {
  companyId: string;
  requireOpenShift?: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  defaultRevenueAccountId?: string;
  receiptPrefix?: string;
  receiptNextSeq?: number;
  cashRounding?: PosCashRounding;
  allowPosDirectSales?: boolean;
  allowCreditSales?: boolean;
  creditSaleManagerOverride?: boolean;
  negativeStockPolicy?: PosNegativeStockPolicy;
  paymentMethods?: PosPaymentMethodConfig[];
}

const VALID_METHODS: PosPaymentMethodCode[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];
const VALID_ROUNDING: PosCashRounding[] = ['none', 'nearest_05', 'nearest_1'];
const VALID_NEGATIVE_STOCK_POLICIES: PosNegativeStockPolicy[] = ['BLOCK', 'ALLOW'];

export class PosSettings {
  readonly companyId: string;
  requireOpenShift: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  defaultRevenueAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: PosCashRounding;
  allowPosDirectSales: boolean;
  allowCreditSales: boolean;
  creditSaleManagerOverride: boolean;
  negativeStockPolicy: PosNegativeStockPolicy;
  paymentMethods: PosPaymentMethodConfig[];

  constructor(props: PosSettingsProps) {
    if (!props.companyId?.trim()) throw new Error('PosSettings companyId is required');
    const rounding: PosCashRounding = (props.cashRounding && VALID_ROUNDING.includes(props.cashRounding))
      ? props.cashRounding
      : 'none';
    const rawMethods = props.paymentMethods ?? [];
    const normalized: PosPaymentMethodConfig[] = [];
    const seen = new Set<PosPaymentMethodCode>();
    for (const m of rawMethods) {
      if (!m || !VALID_METHODS.includes(m.code)) continue;
      if (seen.has(m.code)) continue; // de-dupe by code
      seen.add(m.code);
      normalized.push({
        code: m.code,
        settlementAccountId: m.settlementAccountId?.trim() || '',
        label: m.label?.trim() || undefined,
        requiresReference: m.requiresReference === true,
        allowsChange: m.allowsChange === true,
        isEnabled: m.isEnabled !== false,
      });
    }

    this.companyId = props.companyId;
    this.requireOpenShift = props.requireOpenShift !== false; // default true
    this.walkInCustomerId = props.walkInCustomerId?.trim() || undefined;
    this.cashOverAccountId = props.cashOverAccountId?.trim() || undefined;
    this.cashShortAccountId = props.cashShortAccountId?.trim() || undefined;
    this.defaultRevenueAccountId = props.defaultRevenueAccountId?.trim() || undefined;
    this.receiptPrefix = props.receiptPrefix?.trim() || 'R';
    this.receiptNextSeq = Number.isFinite(props.receiptNextSeq) ? Number(props.receiptNextSeq) : 1;
    this.cashRounding = rounding;
    this.allowPosDirectSales = props.allowPosDirectSales === true;
    this.allowCreditSales = props.allowCreditSales === true;
    this.creditSaleManagerOverride = props.creditSaleManagerOverride === true;
    // Default to BLOCK: POS never silently oversells, even if the company has
    // turned on negative stock for back-office invoice-driven sales.
    this.negativeStockPolicy = VALID_NEGATIVE_STOCK_POLICIES.includes(props.negativeStockPolicy as PosNegativeStockPolicy)
      ? (props.negativeStockPolicy as PosNegativeStockPolicy)
      : 'BLOCK';
    this.paymentMethods = normalized;
  }

  static createDefault(companyId: string): PosSettings {
    return new PosSettings({
      companyId,
      requireOpenShift: true,
      receiptPrefix: 'R',
      receiptNextSeq: 1,
      cashRounding: 'none',
      allowPosDirectSales: false,
      allowCreditSales: false,
      creditSaleManagerOverride: false,
      negativeStockPolicy: 'BLOCK',
      paymentMethods: [
        // CASH is the only always-on method; settlementAccountId empty until the
        // operator configures it on the POS settings page.
        { code: 'CASH', settlementAccountId: '', requiresReference: false, allowsChange: true, isEnabled: true },
      ],
    });
  }

  /** Find a configured payment method by its POS code. */
  getPaymentMethod(code: PosPaymentMethodCode): PosPaymentMethodConfig | undefined {
    return this.paymentMethods.find((m) => m.code === code);
  }

  /** Mutator: increment the next receipt sequence and return the formatted receipt number. */
  nextReceiptNumber(): string {
    const n = this.receiptNextSeq;
    this.receiptNextSeq = n + 1;
    return `${this.receiptPrefix}-${String(n).padStart(6, '0')}`;
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      requireOpenShift: this.requireOpenShift,
      walkInCustomerId: this.walkInCustomerId,
      cashOverAccountId: this.cashOverAccountId,
      cashShortAccountId: this.cashShortAccountId,
      defaultRevenueAccountId: this.defaultRevenueAccountId,
      receiptPrefix: this.receiptPrefix,
      receiptNextSeq: this.receiptNextSeq,
      cashRounding: this.cashRounding,
      allowPosDirectSales: this.allowPosDirectSales,
      allowCreditSales: this.allowCreditSales,
      creditSaleManagerOverride: this.creditSaleManagerOverride,
      negativeStockPolicy: this.negativeStockPolicy,
      paymentMethods: this.paymentMethods,
    };
  }

  static fromJSON(data: any): PosSettings {
    return new PosSettings({
      companyId: data.companyId,
      requireOpenShift: data.requireOpenShift !== false,
      walkInCustomerId: data.walkInCustomerId,
      cashOverAccountId: data.cashOverAccountId,
      cashShortAccountId: data.cashShortAccountId,
      defaultRevenueAccountId: data.defaultRevenueAccountId,
      receiptPrefix: data.receiptPrefix || 'R',
      receiptNextSeq: Number(data.receiptNextSeq) || 1,
      cashRounding: VALID_ROUNDING.includes(data.cashRounding) ? data.cashRounding : 'none',
      allowPosDirectSales: data.allowPosDirectSales === true,
      allowCreditSales: data.allowCreditSales === true,
      creditSaleManagerOverride: data.creditSaleManagerOverride === true,
      negativeStockPolicy: VALID_NEGATIVE_STOCK_POLICIES.includes(data.negativeStockPolicy) ? data.negativeStockPolicy : 'BLOCK',
      paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
    });
  }
}
