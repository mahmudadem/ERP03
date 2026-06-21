/**
 * PosSettings — Company-level configuration for the POS module.
 *
 * Holds operational policy (require open shift, walk-in customer, over/short
 * accounts), receipt-numbering sequence, payment-method → settlement-account
 * mapping, and the `allowPosDirectSales` governance toggle that mirrors the
 * Sales `formType:'pos_sale'` governance rule for the `direct` persona.
 */

export type PosPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';

export interface PosPaymentMethodConfig {
  code: PosPaymentMethodCode;
  /** GL settlement account id (mirrors SalesSettings.paymentMethodConfigs). */
  settlementAccountId: string;
  label?: string;
  /** Some methods (card, bank transfer) require a customer reference. */
  requiresReference: boolean;
  /** Only CASH may give change. */
  allowsChange: boolean;
  isEnabled: boolean;
}

export type PosCashRounding = 'none' | 'nearest_05' | 'nearest_1';

export interface PosSettingsProps {
  companyId: string;
  requireOpenShift?: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix?: string;
  receiptNextSeq?: number;
  cashRounding?: PosCashRounding;
  allowPosDirectSales?: boolean;
  paymentMethods?: PosPaymentMethodConfig[];
}

const VALID_METHODS: PosPaymentMethodCode[] = ['CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOM'];
const VALID_ROUNDING: PosCashRounding[] = ['none', 'nearest_05', 'nearest_1'];

export class PosSettings {
  readonly companyId: string;
  requireOpenShift: boolean;
  walkInCustomerId?: string;
  cashOverAccountId?: string;
  cashShortAccountId?: string;
  receiptPrefix: string;
  receiptNextSeq: number;
  cashRounding: PosCashRounding;
  allowPosDirectSales: boolean;
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
    this.receiptPrefix = props.receiptPrefix?.trim() || 'R';
    this.receiptNextSeq = Number.isFinite(props.receiptNextSeq) ? Number(props.receiptNextSeq) : 1;
    this.cashRounding = rounding;
    this.allowPosDirectSales = props.allowPosDirectSales === true;
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
      receiptPrefix: this.receiptPrefix,
      receiptNextSeq: this.receiptNextSeq,
      cashRounding: this.cashRounding,
      allowPosDirectSales: this.allowPosDirectSales,
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
      receiptPrefix: data.receiptPrefix || 'R',
      receiptNextSeq: Number(data.receiptNextSeq) || 1,
      cashRounding: VALID_ROUNDING.includes(data.cashRounding) ? data.cashRounding : 'none',
      allowPosDirectSales: data.allowPosDirectSales === true,
      paymentMethods: Array.isArray(data.paymentMethods) ? data.paymentMethods : [],
    });
  }
}
