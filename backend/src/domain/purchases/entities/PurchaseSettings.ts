export interface PurchaseSettingsProps {
  companyId: string;
  allowDirectInvoicing: boolean;
  requirePOForStockItems: boolean;
  defaultAPAccountId?: string;
  defaultPurchaseExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix: string;
  poNumberNextSeq: number;
  grnNumberPrefix: string;
  grnNumberNextSeq: number;
  piNumberPrefix: string;
  piNumberNextSeq: number;
  prNumberPrefix: string;
  prNumberNextSeq: number;
  exchangeGainLossAccountId?: string;
}

export class PurchaseSettings {
  readonly companyId: string;
  allowDirectInvoicing: boolean;
  requirePOForStockItems: boolean;
  defaultAPAccountId?: string;
  defaultPurchaseExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  purchaseVoucherTypeId?: string;
  defaultWarehouseId?: string;
  poNumberPrefix: string;
  poNumberNextSeq: number;
  grnNumberPrefix: string;
  grnNumberNextSeq: number;
  piNumberPrefix: string;
  piNumberNextSeq: number;
  prNumberPrefix?: string;
  prNumberNextSeq?: number;
  exchangeGainLossAccountId?: string;

  constructor(props: PurchaseSettingsProps) {
    if (!props.companyId?.trim()) throw new Error('PurchaseSettings companyId is required');

    this.companyId = props.companyId;
    this.allowDirectInvoicing = props.allowDirectInvoicing;
    this.requirePOForStockItems = props.requirePOForStockItems;
    this.defaultAPAccountId = props.defaultAPAccountId?.trim() || undefined;
    this.defaultPurchaseExpenseAccountId = props.defaultPurchaseExpenseAccountId;
    this.allowOverDelivery = props.allowOverDelivery;
    this.overDeliveryTolerancePct = props.overDeliveryTolerancePct;
    this.overInvoiceTolerancePct = props.overInvoiceTolerancePct;
    this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
    this.purchaseVoucherTypeId = props.purchaseVoucherTypeId;
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.poNumberPrefix = props.poNumberPrefix || 'PO';
    this.poNumberNextSeq = props.poNumberNextSeq || 1;
    this.grnNumberPrefix = props.grnNumberPrefix || 'GRN';
    this.grnNumberNextSeq = props.grnNumberNextSeq || 1;
    this.piNumberPrefix = props.piNumberPrefix || 'PI';
    this.piNumberNextSeq = props.piNumberNextSeq || 1;
    this.prNumberPrefix = props.prNumberPrefix || 'PR';
    this.prNumberNextSeq = props.prNumberNextSeq || 1;
    this.exchangeGainLossAccountId = props.exchangeGainLossAccountId;
  }

  static createDefault(companyId: string, defaultAPAccountId?: string): PurchaseSettings {
    return new PurchaseSettings({
      companyId,
      allowDirectInvoicing: true,
      requirePOForStockItems: false,
      defaultAPAccountId,
      allowOverDelivery: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
      defaultPaymentTermsDays: 30,
      poNumberPrefix: 'PO',
      poNumberNextSeq: 1,
      grnNumberPrefix: 'GRN',
      grnNumberNextSeq: 1,
      piNumberPrefix: 'PI',
      piNumberNextSeq: 1,
      prNumberPrefix: 'PR',
      prNumberNextSeq: 1,
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      allowDirectInvoicing: this.allowDirectInvoicing,
      requirePOForStockItems: this.requirePOForStockItems,
      defaultAPAccountId: this.defaultAPAccountId,
      defaultPurchaseExpenseAccountId: this.defaultPurchaseExpenseAccountId,
      allowOverDelivery: this.allowOverDelivery,
      overDeliveryTolerancePct: this.overDeliveryTolerancePct,
      overInvoiceTolerancePct: this.overInvoiceTolerancePct,
      defaultPaymentTermsDays: this.defaultPaymentTermsDays,
      purchaseVoucherTypeId: this.purchaseVoucherTypeId,
      defaultWarehouseId: this.defaultWarehouseId,
      poNumberPrefix: this.poNumberPrefix,
      poNumberNextSeq: this.poNumberNextSeq,
      grnNumberPrefix: this.grnNumberPrefix,
      grnNumberNextSeq: this.grnNumberNextSeq,
      piNumberPrefix: this.piNumberPrefix,
      piNumberNextSeq: this.piNumberNextSeq,
      prNumberPrefix: this.prNumberPrefix,
      prNumberNextSeq: this.prNumberNextSeq,
      exchangeGainLossAccountId: this.exchangeGainLossAccountId,
    };
  }

  static fromJSON(data: any): PurchaseSettings {
    return new PurchaseSettings({
      companyId: data.companyId,
      allowDirectInvoicing: data.allowDirectInvoicing ?? true,
      requirePOForStockItems: data.requirePOForStockItems ?? false,
      defaultAPAccountId: data.defaultAPAccountId,
      defaultPurchaseExpenseAccountId: data.defaultPurchaseExpenseAccountId,
      allowOverDelivery: data.allowOverDelivery ?? false,
      overDeliveryTolerancePct: data.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: data.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? 30,
      purchaseVoucherTypeId: data.purchaseVoucherTypeId,
      defaultWarehouseId: data.defaultWarehouseId,
      poNumberPrefix: data.poNumberPrefix || 'PO',
      poNumberNextSeq: data.poNumberNextSeq ?? 1,
      grnNumberPrefix: data.grnNumberPrefix || 'GRN',
      grnNumberNextSeq: data.grnNumberNextSeq ?? 1,
      piNumberPrefix: data.piNumberPrefix || 'PI',
      piNumberNextSeq: data.piNumberNextSeq ?? 1,
      prNumberPrefix: data.prNumberPrefix || 'PR',
      prNumberNextSeq: data.prNumberNextSeq ?? 1,
    });
  }
}
