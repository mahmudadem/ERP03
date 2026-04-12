export interface SalesSettingsProps {
  companyId: string;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;
}

export class SalesSettings {
  readonly companyId: string;
  allowDirectInvoicing: boolean;
  requireSOForStockItems: boolean;
  defaultARAccountId?: string;
  defaultRevenueAccountId: string;
  defaultCOGSAccountId?: string;
  defaultInventoryAccountId?: string;
  defaultSalesExpenseAccountId?: string;
  allowOverDelivery: boolean;
  overDeliveryTolerancePct: number;
  overInvoiceTolerancePct: number;
  defaultPaymentTermsDays: number;
  salesVoucherTypeId?: string;
  defaultWarehouseId?: string;
  soNumberPrefix: string;
  soNumberNextSeq: number;
  dnNumberPrefix: string;
  dnNumberNextSeq: number;
  siNumberPrefix: string;
  siNumberNextSeq: number;
  srNumberPrefix: string;
  srNumberNextSeq: number;

  constructor(props: SalesSettingsProps) {
    if (!props.companyId?.trim()) throw new Error('SalesSettings companyId is required');
    if (!props.defaultRevenueAccountId?.trim()) throw new Error('SalesSettings defaultRevenueAccountId is required');

    this.companyId = props.companyId;
    this.allowDirectInvoicing = props.allowDirectInvoicing;
    this.requireSOForStockItems = props.requireSOForStockItems;
    this.defaultARAccountId = props.defaultARAccountId?.trim() || undefined;
    this.defaultRevenueAccountId = props.defaultRevenueAccountId.trim();
    this.defaultCOGSAccountId = props.defaultCOGSAccountId;
    this.defaultInventoryAccountId = props.defaultInventoryAccountId;
    this.defaultSalesExpenseAccountId = props.defaultSalesExpenseAccountId;
    this.allowOverDelivery = props.allowOverDelivery;
    this.overDeliveryTolerancePct = props.overDeliveryTolerancePct;
    this.overInvoiceTolerancePct = props.overInvoiceTolerancePct;
    this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
    this.salesVoucherTypeId = props.salesVoucherTypeId;
    this.defaultWarehouseId = props.defaultWarehouseId;
    this.soNumberPrefix = props.soNumberPrefix || 'SO';
    this.soNumberNextSeq = props.soNumberNextSeq || 1;
    this.dnNumberPrefix = props.dnNumberPrefix || 'DN';
    this.dnNumberNextSeq = props.dnNumberNextSeq || 1;
    this.siNumberPrefix = props.siNumberPrefix || 'SI';
    this.siNumberNextSeq = props.siNumberNextSeq || 1;
    this.srNumberPrefix = props.srNumberPrefix || 'SR';
    this.srNumberNextSeq = props.srNumberNextSeq || 1;
  }

  static createDefault(
    companyId: string,
    defaultARAccountId: string | undefined,
    defaultRevenueAccountId: string
  ): SalesSettings {
    return new SalesSettings({
      companyId,
      allowDirectInvoicing: true,
      requireSOForStockItems: false,
      defaultARAccountId,
      defaultRevenueAccountId,
      allowOverDelivery: false,
      overDeliveryTolerancePct: 0,
      overInvoiceTolerancePct: 0,
      defaultPaymentTermsDays: 30,
      soNumberPrefix: 'SO',
      soNumberNextSeq: 1,
      dnNumberPrefix: 'DN',
      dnNumberNextSeq: 1,
      siNumberPrefix: 'SI',
      siNumberNextSeq: 1,
      srNumberPrefix: 'SR',
      srNumberNextSeq: 1,
    });
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      allowDirectInvoicing: this.allowDirectInvoicing,
      requireSOForStockItems: this.requireSOForStockItems,
      defaultARAccountId: this.defaultARAccountId,
      defaultRevenueAccountId: this.defaultRevenueAccountId,
      defaultCOGSAccountId: this.defaultCOGSAccountId,
      defaultInventoryAccountId: this.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: this.defaultSalesExpenseAccountId,
      allowOverDelivery: this.allowOverDelivery,
      overDeliveryTolerancePct: this.overDeliveryTolerancePct,
      overInvoiceTolerancePct: this.overInvoiceTolerancePct,
      defaultPaymentTermsDays: this.defaultPaymentTermsDays,
      salesVoucherTypeId: this.salesVoucherTypeId,
      defaultWarehouseId: this.defaultWarehouseId,
      soNumberPrefix: this.soNumberPrefix,
      soNumberNextSeq: this.soNumberNextSeq,
      dnNumberPrefix: this.dnNumberPrefix,
      dnNumberNextSeq: this.dnNumberNextSeq,
      siNumberPrefix: this.siNumberPrefix,
      siNumberNextSeq: this.siNumberNextSeq,
      srNumberPrefix: this.srNumberPrefix,
      srNumberNextSeq: this.srNumberNextSeq,
    };
  }

  static fromJSON(data: any): SalesSettings {
    return new SalesSettings({
      companyId: data.companyId,
      allowDirectInvoicing: data.allowDirectInvoicing ?? true,
      requireSOForStockItems: data.requireSOForStockItems ?? false,
      defaultARAccountId: data.defaultARAccountId,
      defaultRevenueAccountId: data.defaultRevenueAccountId,
      defaultCOGSAccountId: data.defaultCOGSAccountId,
      defaultInventoryAccountId: data.defaultInventoryAccountId,
      defaultSalesExpenseAccountId: data.defaultSalesExpenseAccountId,
      allowOverDelivery: data.allowOverDelivery ?? false,
      overDeliveryTolerancePct: data.overDeliveryTolerancePct ?? 0,
      overInvoiceTolerancePct: data.overInvoiceTolerancePct ?? 0,
      defaultPaymentTermsDays: data.defaultPaymentTermsDays ?? 30,
      salesVoucherTypeId: data.salesVoucherTypeId,
      defaultWarehouseId: data.defaultWarehouseId,
      soNumberPrefix: data.soNumberPrefix || 'SO',
      soNumberNextSeq: data.soNumberNextSeq ?? 1,
      dnNumberPrefix: data.dnNumberPrefix || 'DN',
      dnNumberNextSeq: data.dnNumberNextSeq ?? 1,
      siNumberPrefix: data.siNumberPrefix || 'SI',
      siNumberNextSeq: data.siNumberNextSeq ?? 1,
      srNumberPrefix: data.srNumberPrefix || 'SR',
      srNumberNextSeq: data.srNumberNextSeq ?? 1,
    });
  }
}
