export type OpeningStockDocumentStatus = 'DRAFT' | 'POSTED';

export interface OpeningStockDocumentLine {
  lineId: string;
  itemId: string;
  quantity: number;
  unitCostInMoveCurrency: number;
  moveCurrency: string;
  fxRateMovToBase: number;
  fxRateCCYToBase: number;
  unitCostBase: number;
  totalValueBase: number;
}

export interface OpeningStockDocumentProps {
  id: string;
  companyId: string;
  warehouseId: string;
  date: string;
  notes?: string;
  lines: OpeningStockDocumentLine[];
  status: OpeningStockDocumentStatus;
  createAccountingEffect: boolean;
  openingBalanceAccountId?: string;
  voucherId?: string;
  totalValueBase: number;
  createdBy: string;
  createdAt: Date;
  postedAt?: Date;
}

const OPENING_STOCK_DOCUMENT_STATUSES: OpeningStockDocumentStatus[] = ['DRAFT', 'POSTED'];

const toDate = (value: any): Date => {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class OpeningStockDocument {
  readonly id: string;
  readonly companyId: string;
  warehouseId: string;
  date: string;
  notes?: string;
  lines: OpeningStockDocumentLine[];
  status: OpeningStockDocumentStatus;
  createAccountingEffect: boolean;
  openingBalanceAccountId?: string;
  voucherId?: string;
  totalValueBase: number;
  readonly createdBy: string;
  readonly createdAt: Date;
  postedAt?: Date;

  constructor(props: OpeningStockDocumentProps) {
    if (!props.id?.trim()) throw new Error('OpeningStockDocument id is required');
    if (!props.companyId?.trim()) throw new Error('OpeningStockDocument companyId is required');
    if (!props.warehouseId?.trim()) throw new Error('OpeningStockDocument warehouseId is required');
    if (!props.createdBy?.trim()) throw new Error('OpeningStockDocument createdBy is required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(props.date)) {
      throw new Error('OpeningStockDocument date must be in YYYY-MM-DD format');
    }
    if (!OPENING_STOCK_DOCUMENT_STATUSES.includes(props.status)) {
      throw new Error(`Invalid OpeningStockDocument status: ${props.status}`);
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('OpeningStockDocument lines are required');
    }

    props.lines.forEach((line, index) => {
      if (!line.lineId?.trim()) {
        throw new Error(`OpeningStockDocument line ${index + 1}: lineId is required`);
      }
      if (!line.itemId?.trim()) {
        throw new Error(`OpeningStockDocument line ${index + 1}: itemId is required`);
      }
      if (line.quantity <= 0 || Number.isNaN(line.quantity)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: quantity must be greater than 0`);
      }
      if (line.unitCostInMoveCurrency < 0 || Number.isNaN(line.unitCostInMoveCurrency)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: unitCostInMoveCurrency must be non-negative`);
      }
      if (!line.moveCurrency?.trim()) {
        throw new Error(`OpeningStockDocument line ${index + 1}: moveCurrency is required`);
      }
      if (line.fxRateMovToBase <= 0 || Number.isNaN(line.fxRateMovToBase)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: fxRateMovToBase must be greater than 0`);
      }
      if (line.fxRateCCYToBase <= 0 || Number.isNaN(line.fxRateCCYToBase)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: fxRateCCYToBase must be greater than 0`);
      }
      if (line.unitCostBase < 0 || Number.isNaN(line.unitCostBase)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: unitCostBase must be non-negative`);
      }
      if (line.totalValueBase < 0 || Number.isNaN(line.totalValueBase)) {
        throw new Error(`OpeningStockDocument line ${index + 1}: totalValueBase must be non-negative`);
      }
    });

    this.id = props.id;
    this.companyId = props.companyId;
    this.warehouseId = props.warehouseId;
    this.date = props.date;
    this.notes = props.notes;
    this.lines = props.lines.map((line) => ({
      ...line,
      moveCurrency: line.moveCurrency.toUpperCase().trim(),
    }));
    this.status = props.status;
    this.createAccountingEffect = props.createAccountingEffect;
    this.openingBalanceAccountId = props.openingBalanceAccountId?.trim() || undefined;
    this.voucherId = props.voucherId?.trim() || undefined;
    this.totalValueBase = props.totalValueBase;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.postedAt = props.postedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      warehouseId: this.warehouseId,
      date: this.date,
      notes: this.notes,
      lines: this.lines.map((line) => ({ ...line })),
      status: this.status,
      createAccountingEffect: this.createAccountingEffect,
      openingBalanceAccountId: this.openingBalanceAccountId,
      voucherId: this.voucherId,
      totalValueBase: this.totalValueBase,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      postedAt: this.postedAt,
    };
  }

  static fromJSON(data: any): OpeningStockDocument {
    return new OpeningStockDocument({
      id: data.id,
      companyId: data.companyId,
      warehouseId: data.warehouseId,
      date: data.date,
      notes: data.notes,
      lines: Array.isArray(data.lines) ? data.lines : [],
      status: data.status || 'DRAFT',
      createAccountingEffect: data.createAccountingEffect ?? false,
      openingBalanceAccountId: data.openingBalanceAccountId,
      voucherId: data.voucherId,
      totalValueBase: data.totalValueBase ?? 0,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      postedAt: toDate(data.postedAt),
    });
  }
}
