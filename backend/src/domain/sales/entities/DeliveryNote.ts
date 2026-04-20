export type DNStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface DeliveryNoteLine {
  lineId: string;
  lineNo: number;
  soLineId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  deliveredQty: number;
  uomId?: string;
  uom: string;
  unitCostBase: number;
  lineCostBase: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  stockMovementId?: string | null;
  description?: string;
}

export interface DeliveryNoteProps {
  id: string;
  companyId: string;
  dnNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  deliveryDate: string;
  warehouseId: string;
  lines: DeliveryNoteLine[];
  status?: DNStatus;
  notes?: string;
  cogsVoucherId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;
}

const DN_STATUSES: DNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class DeliveryNote {
  readonly id: string;
  readonly companyId: string;
  dnNumber: string;
  salesOrderId?: string;
  customerId: string;
  customerName: string;
  deliveryDate: string;
  warehouseId: string;
  lines: DeliveryNoteLine[];
  status: DNStatus;
  notes?: string;
  cogsVoucherId?: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;
  postedAt?: Date;

  constructor(props: DeliveryNoteProps) {
    if (!props.id?.trim()) throw new Error('DeliveryNote id is required');
    if (!props.companyId?.trim()) throw new Error('DeliveryNote companyId is required');
    if (!props.dnNumber?.trim()) throw new Error('DeliveryNote dnNumber is required');
    if (!props.customerId?.trim()) throw new Error('DeliveryNote customerId is required');
    if (!props.deliveryDate?.trim()) throw new Error('DeliveryNote deliveryDate is required');
    if (!props.warehouseId?.trim()) throw new Error('DeliveryNote warehouseId is required');
    if (!props.createdBy?.trim()) throw new Error('DeliveryNote createdBy is required');
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('DeliveryNote must contain at least one line');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.dnNumber = props.dnNumber.trim();
    this.salesOrderId = props.salesOrderId;
    this.customerId = props.customerId.trim();
    this.customerName = props.customerName || '';
    this.deliveryDate = props.deliveryDate;
    this.warehouseId = props.warehouseId.trim();
    this.lines = props.lines.map((line, index) => this.normalizeLine(line, index));

    const status = props.status || 'DRAFT';
    if (!DN_STATUSES.includes(status)) {
      throw new Error(`Invalid delivery note status: ${status}`);
    }
    this.status = status;

    this.notes = props.notes;
    this.cogsVoucherId = props.cogsVoucherId ?? null;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.postedAt = props.postedAt;
  }

  private normalizeLine(line: DeliveryNoteLine, index: number): DeliveryNoteLine {
    if (!line.lineId?.trim()) throw new Error(`DeliveryNote line ${index + 1}: lineId is required`);
    if (!line.itemId?.trim()) throw new Error(`DeliveryNote line ${index + 1}: itemId is required`);
    if (line.deliveredQty <= 0 || Number.isNaN(line.deliveredQty)) {
      throw new Error(`DeliveryNote line ${index + 1}: deliveredQty must be greater than 0`);
    }
    if (!line.uom?.trim()) throw new Error(`DeliveryNote line ${index + 1}: uom is required`);

    const unitCostBase = roundMoney(line.unitCostBase ?? 0);
    const lineCostBase = roundMoney(line.lineCostBase ?? (line.deliveredQty * unitCostBase));

    return {
      lineId: line.lineId,
      lineNo: line.lineNo || index + 1,
      soLineId: line.soLineId,
      itemId: line.itemId,
      itemCode: line.itemCode || '',
      itemName: line.itemName || '',
      deliveredQty: line.deliveredQty,
      uomId: line.uomId,
      uom: line.uom,
      unitCostBase,
      lineCostBase,
      moveCurrency: (line.moveCurrency || 'USD').toUpperCase().trim(),
      fxRateMovToBase: line.fxRateMovToBase || 1,
      fxRateCCYToBase: line.fxRateCCYToBase || 1,
      stockMovementId: line.stockMovementId ?? null,
      description: line.description,
    };
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      dnNumber: this.dnNumber,
      salesOrderId: this.salesOrderId,
      customerId: this.customerId,
      customerName: this.customerName,
      deliveryDate: this.deliveryDate,
      warehouseId: this.warehouseId,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      notes: this.notes,
      cogsVoucherId: this.cogsVoucherId ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): DeliveryNote {
    return new DeliveryNote({
      id: data.id,
      companyId: data.companyId,
      dnNumber: data.dnNumber,
      salesOrderId: data.salesOrderId,
      customerId: data.customerId,
      customerName: data.customerName,
      deliveryDate: data.deliveryDate,
      warehouseId: data.warehouseId,
      lines: data.lines || [],
      status: data.status || 'DRAFT',
      notes: data.notes,
      cogsVoucherId: data.cogsVoucherId ?? null,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: data.postedAt ? toDate(data.postedAt) : undefined,
    });
  }
}
