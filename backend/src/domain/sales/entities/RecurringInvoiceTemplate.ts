export type RecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
export type RecurringInvoiceStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface RecurringInvoiceLine {
  itemId: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPriceDoc: number;
  taxCodeId?: string;
  taxCode?: string;
  taxRate: number;
  description?: string;
}

export interface RecurringInvoiceTemplateProps {
  id: string;
  companyId: string;
  name: string;
  sourceInvoiceId?: string;
  customerId: string;
  customerName: string;
  currency: string;
  exchangeRate: number;
  lines: RecurringInvoiceLine[];
  notes?: string;
  paymentTermsDays: number;
  frequency: RecurrenceFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  occurrencesGenerated: number;
  nextGenerationDate: string;
  status: RecurringInvoiceStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

const FREQUENCIES: RecurrenceFrequency[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
const STATUSES: RecurringInvoiceStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

const toStringRef = (value: any): string => {
  if (value === undefined || value === null || value === '') return '';
  return String(value).trim();
};

const toOptionalStringRef = (value: any): string | undefined => {
  const text = toStringRef(value);
  return text || undefined;
};

const toDisplayText = (value: any): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'object') {
    const candidate = value.name || value.label || value.text || value.id || value.code;
    if (candidate) return String(candidate).trim();
    return '';
  }
  return String(value).trim();
};

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const isValidDateOnly = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
};

export class RecurringInvoiceTemplate {
  readonly id: string;
  readonly companyId: string;
  name: string;
  readonly sourceInvoiceId?: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly currency: string;
  readonly exchangeRate: number;
  readonly lines: RecurringInvoiceLine[];
  notes?: string;
  readonly paymentTermsDays: number;
  readonly frequency: RecurrenceFrequency;
  readonly dayOfMonth?: number;
  readonly dayOfWeek?: number;
  readonly startDate: string;
  readonly endDate?: string;
  readonly maxOccurrences?: number;
  readonly occurrencesGenerated: number;
  readonly nextGenerationDate: string;
  status: RecurringInvoiceStatus;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt?: Date;
  updatedBy?: string;

  constructor(props: RecurringInvoiceTemplateProps) {
    const id = toStringRef(props.id);
    const companyId = toStringRef(props.companyId);
    const customerId = toStringRef(props.customerId);
    const currency = toStringRef(props.currency);
    const createdBy = toStringRef(props.createdBy);
    const exchangeRate = Number(props.exchangeRate);

    if (!id) throw new Error('RecurringInvoiceTemplate id is required');
    if (!companyId) throw new Error('RecurringInvoiceTemplate companyId is required');
    if (!customerId) throw new Error('RecurringInvoiceTemplate customerId is required');
    if (!currency) throw new Error('RecurringInvoiceTemplate currency is required');
    if (!createdBy) throw new Error('RecurringInvoiceTemplate createdBy is required');
    if (exchangeRate <= 0 || Number.isNaN(exchangeRate)) {
      throw new Error('RecurringInvoiceTemplate exchangeRate must be greater than 0');
    }
    if (!Array.isArray(props.lines) || props.lines.length === 0) {
      throw new Error('RecurringInvoiceTemplate must have at least one line');
    }
    if (!FREQUENCIES.includes(props.frequency)) {
      throw new Error(`Invalid frequency: ${props.frequency}`);
    }
    if (!toDisplayText(props.name)) {
      throw new Error('RecurringInvoiceTemplate name is required');
    }
    if (!toStringRef(props.startDate) || !isValidDateOnly(toStringRef(props.startDate))) {
      throw new Error('RecurringInvoiceTemplate startDate must be a valid YYYY-MM-DD date');
    }
    if (!toStringRef(props.nextGenerationDate) || !isValidDateOnly(toStringRef(props.nextGenerationDate))) {
      throw new Error('RecurringInvoiceTemplate nextGenerationDate must be a valid YYYY-MM-DD date');
    }
    if (toOptionalStringRef(props.endDate) && !isValidDateOnly(toStringRef(props.endDate))) {
      throw new Error('RecurringInvoiceTemplate endDate must be a valid YYYY-MM-DD date');
    }
    if (Number(props.paymentTermsDays ?? 0) < 0) {
      throw new Error('RecurringInvoiceTemplate paymentTermsDays cannot be negative');
    }

    this.id = id;
    this.companyId = companyId;
    this.name = toDisplayText(props.name);
    this.sourceInvoiceId = toOptionalStringRef(props.sourceInvoiceId);
    this.customerId = customerId;
    this.customerName = toDisplayText(props.customerName);
    this.currency = currency.toUpperCase();
    this.exchangeRate = exchangeRate;
    this.lines = props.lines.map((line) => ({
      itemId: toStringRef(line.itemId),
      itemCode: toDisplayText(line.itemCode),
      itemName: toDisplayText(line.itemName),
      qty: Number(line.qty) || 0,
      unitPriceDoc: Math.max(0, Number(line.unitPriceDoc) || 0),
      taxCodeId: toOptionalStringRef(line.taxCodeId),
      taxCode: toOptionalStringRef(line.taxCode),
      taxRate: Number(line.taxRate) || 0,
      description: toOptionalStringRef(line.description),
    }));
    if (this.lines.some((line) => line.qty <= 0)) {
      throw new Error('RecurringInvoiceTemplate line quantity must be greater than 0');
    }
    this.notes = toOptionalStringRef(props.notes);
    this.paymentTermsDays = props.paymentTermsDays ?? 0;
    this.frequency = props.frequency;
    this.dayOfMonth = props.dayOfMonth;
    this.dayOfWeek = props.dayOfWeek;
    this.startDate = toStringRef(props.startDate);
    this.endDate = toOptionalStringRef(props.endDate);
    this.maxOccurrences = props.maxOccurrences;
    this.occurrencesGenerated = props.occurrencesGenerated ?? 0;
    this.nextGenerationDate = toStringRef(props.nextGenerationDate);

    const status = (toStringRef(props.status) || 'ACTIVE') as RecurringInvoiceStatus;
    if (!STATUSES.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    this.status = status;
    this.createdBy = createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.updatedBy = props.updatedBy;
  }

  pause(by: string, at: Date) {
    return new RecurringInvoiceTemplate({
      ...this._toProps(),
      status: 'PAUSED',
      updatedAt: at,
      updatedBy: by,
    });
  }

  resume(by: string, at: Date) {
    return new RecurringInvoiceTemplate({
      ...this._toProps(),
      status: 'ACTIVE',
      updatedAt: at,
      updatedBy: by,
    });
  }

  cancel(by: string, at: Date) {
    return new RecurringInvoiceTemplate({
      ...this._toProps(),
      status: 'CANCELLED',
      updatedAt: at,
      updatedBy: by,
    });
  }

  advance(by: string, at: Date): RecurringInvoiceTemplate {
    const nextDate = computeNextDate(this.frequency, this.dayOfMonth, this.dayOfWeek, this.nextGenerationDate);
    const occurrences = this.occurrencesGenerated + 1;
    const completed =
      (this.maxOccurrences && occurrences >= this.maxOccurrences) ||
      (this.endDate && nextDate > this.endDate);

    return new RecurringInvoiceTemplate({
      ...this._toProps(),
      occurrencesGenerated: occurrences,
      nextGenerationDate: completed ? this.nextGenerationDate : nextDate,
      status: completed ? 'COMPLETED' : this.status,
      updatedAt: at,
      updatedBy: by,
    });
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      sourceInvoiceId: this.sourceInvoiceId,
      customerId: this.customerId,
      customerName: this.customerName,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines.map((l) => ({ ...l })),
      notes: this.notes,
      paymentTermsDays: this.paymentTermsDays,
      frequency: this.frequency,
      dayOfMonth: this.dayOfMonth,
      dayOfWeek: this.dayOfWeek,
      startDate: this.startDate,
      endDate: this.endDate,
      maxOccurrences: this.maxOccurrences,
      occurrencesGenerated: this.occurrencesGenerated,
      nextGenerationDate: this.nextGenerationDate,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }

  static fromJSON(data: any): RecurringInvoiceTemplate {
    return new RecurringInvoiceTemplate({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      sourceInvoiceId: data.sourceInvoiceId,
      customerId: data.customerId,
      customerName: data.customerName,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      lines: data.lines || [],
      notes: data.notes,
      paymentTermsDays: data.paymentTermsDays ?? 0,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth,
      dayOfWeek: data.dayOfWeek,
      startDate: data.startDate,
      endDate: data.endDate,
      maxOccurrences: data.maxOccurrences,
      occurrencesGenerated: data.occurrencesGenerated ?? 0,
      nextGenerationDate: data.nextGenerationDate,
      status: data.status || 'ACTIVE',
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt),
      updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
      updatedBy: data.updatedBy,
    });
  }

  private _toProps(): RecurringInvoiceTemplateProps {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      sourceInvoiceId: this.sourceInvoiceId,
      customerId: this.customerId,
      customerName: this.customerName,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      lines: this.lines,
      notes: this.notes,
      paymentTermsDays: this.paymentTermsDays,
      frequency: this.frequency,
      dayOfMonth: this.dayOfMonth,
      dayOfWeek: this.dayOfWeek,
      startDate: this.startDate,
      endDate: this.endDate,
      maxOccurrences: this.maxOccurrences,
      occurrencesGenerated: this.occurrencesGenerated,
      nextGenerationDate: this.nextGenerationDate,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy,
    };
  }
}

function computeNextDate(
  freq: RecurrenceFrequency,
  dayOfMonth: number | undefined,
  dayOfWeek: number | undefined,
  currentDate: string
): string {
  const parts = currentDate.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10) - 1;
  let day = parseInt(parts[2], 10);

  if (freq === 'WEEKLY') {
    const d = new Date(year, month, day);
    d.setDate(d.getDate() + 7);
    if (dayOfWeek !== undefined) {
      d.setDate(d.getDate() + (dayOfWeek - d.getDay() + 7) % 7);
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const addMonths = freq === 'MONTHLY' ? 1 : freq === 'QUARTERLY' ? 3 : 12;
  month += addMonths;
  while (month >= 12) {
    month -= 12;
    year += 1;
  }

  const targetDay = dayOfMonth ?? Math.min(day, 28);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const finalDay = Math.min(targetDay, daysInMonth);

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
}
