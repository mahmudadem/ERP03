export type GRNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface GoodsReceiptLine {
  lineId: string;
  lineNo: number;
  poLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  uomId?: string;
  uom: string;
  unitCostDoc: number;
  unitCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface GoodsReceiptProps {
  id: string;
  companyId: string;
  grnNumber: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  warehouseId: string;
  lines: GoodsReceiptLine[];
  status?: GRNStatus;
  notes?: string;
  voucherId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const GRN_STATUSES: GRNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class GoodsReceipt {
  readonly id: string;
  readonly companyId: string;
  grnNumber: string;
  purchaseOrderId?: string;
  vendorId: string;
  vendorName: string;
  receiptDate: string;
  warehouseId: string;
  lines: GoodsReceiptLine[];
  status: GRNStatus;
  notes?: string;
  voucherId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: GoodsReceiptProps) {
    if (!props.id?.trim()) throw new Error('GoodsReceipt id is required');
    if (!props.companyId?.trim()) throw new Error('GoodsReceipt companyId is required');
    if (!props.grnNumber?.trim()) throw new Error('GoodsReceipt grnNumber is required');
    if (!props.vendorId?.trim()) throw new Error('GoodsReceipt vendorId is required');
    if (!props.receiptDate?.trim()) throw new Error('GoodsReceipt receiptDate is required');
    if (!props.warehouseId?.trim()) throw new Error('GoodsReceipt warehouseId is required');
    if (!props.createdBy?.trim()) throw new Error('GoodsReceipt createdBy is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('GoodsReceipt must contain at least one line');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.grnNumber = props.grnNumber.trim();
    this.purchaseOrderId = props.purchaseOrderId;
    this.vendorId = props.vendorId.trim();
    this.vendorName = props.vendorName || '';
    this.receiptDate = props.receiptDate;
    this.warehouseId = props.warehouseId.trim();
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    const status = props.status || 'DRAFT';
    if (!GRN_STATUSES.includes(status)) {
      throw new Error(`Invalid goods receipt status: ${status}`);
    }
    this.status = status;

    this.notes = props.notes;
    this.voucherId = props.voucherId ?? null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: GoodsReceiptLine, index: number): GoodsReceiptLine {
    if (!line.lineId?.trim()) throw new Error(`GoodsReceipt line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`GoodsReceipt line ${index + 1}: itemId is required`);
    if (line.receivedQty <= 0 || Number.isNaN(line.receivedQty)) {
      throw new Error(`GoodsReceipt line ${index + 1}: receivedQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`GoodsReceipt line ${index + 1}: uom is required`);
    if (!line.moveCurrency?.trim()) throw new Error(`GoodsReceipt line ${index + 1}: moveCurrency is required`);
    if (line.unitCostDoc < 0 || Number.isNaN(line.unitCostDoc)) {
      throw new Error(`GoodsReceipt line ${index + 1}: unitCostDoc must be greater than or equal to 0`);
    }
    if (line.fxRateMovToBase <= 0 || Number.isNaN(line.fxRateMovToBase)) {
      throw new Error(`GoodsReceipt line ${index + 1}: fxRateMovToBase must be greater than 0`);
    }
    if (line.fxRateCCYToBase <= 0 || Number.isNaN(line.fxRateCCYToBase)) {
      throw new Error(`GoodsReceipt line ${index + 1}: fxRateCCYToBase must be greater than 0`);
    }

    return {
      lineId: line.lineId,
      lineNo: line.lineNo || index + 1,
      poLineId: line.poLineId,
      itemId: line.itemId,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      receivedQty: line.receivedQty,
      uomId: line.uomId,
      uom: line.uom,
      unitCostDoc: line.unitCostDoc,
      unitCostBase: roundMoney(line.unitCostBase),
      moveCurrency: line.moveCurrency.toUpperCase().trim(),
      fxRateMovToBase: line.fxRateMovToBase,
      fxRateCCYToBase: line.fxRateCCYToBase,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      grnNumber: this.grnNumber,
      purchaseOrderId: this.purchaseOrderId,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      receiptDate: this.receiptDate,
      warehouseId: this.warehouseId,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      notes: this.notes,
      voucherId: this.voucherId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): GoodsReceipt {
    return new GoodsReceipt({
      id: data.id,
      companyId: data.companyId,
      grnNumber: data.grnNumber,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      receiptDate: data.receiptDate,
      warehouseId: data.warehouseId,
      lines: data.lines || [],
      status: data.status || 'DRAFT',
      notes: data.notes,
      voucherId: data.voucherId ?? null,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
