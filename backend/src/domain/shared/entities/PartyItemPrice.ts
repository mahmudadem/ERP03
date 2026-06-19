import { CostPoint } from '../../inventory/entities/Item';

export type PartyItemPriceDirection = 'SALE' | 'PURCHASE';

export interface PartyItemPriceProps {
  companyId: string;
  partyId: string;
  itemId: string;
  lastSaleByCcyUom?: Record<string, CostPoint>;
  lastPurchaseByCcyUom?: Record<string, CostPoint>;
  contractSale?: Record<string, CostPoint>;
  contractPurchase?: Record<string, CostPoint>;
  extra?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value || Date.now());
};

const clonePoint = (point: CostPoint): CostPoint => ({
  base: Number(point.base),
  ccy: Number(point.ccy),
  currency: String(point.currency).toUpperCase().trim(),
  fxRateToBase: Number(point.fxRateToBase),
  asOf: String(point.asOf),
  qty: point.qty === undefined || point.qty === null ? undefined : Number(point.qty),
  uomId: point.uomId ? String(point.uomId) : undefined,
  source: point.source ? { ...point.source } : undefined,
});

const normalizeCcyUomKey = (key: string): string => {
  const [currency, ...rest] = String(key || '').split('__');
  return `${currency.toUpperCase()}__${rest.join('__')}`;
};

const normalizePointMap = (map?: Record<string, CostPoint>): Record<string, CostPoint> | undefined => {
  if (!map) return undefined;
  const entries = Object.entries(map)
    .filter(([, point]) => !!point)
    .map(([key, point]) => [normalizeCcyUomKey(key), clonePoint(point)]);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

export class PartyItemPrice {
  readonly companyId: string;
  readonly partyId: string;
  readonly itemId: string;
  lastSaleByCcyUom?: Record<string, CostPoint>;
  lastPurchaseByCcyUom?: Record<string, CostPoint>;
  contractSale?: Record<string, CostPoint>;
  contractPurchase?: Record<string, CostPoint>;
  extra?: Record<string, any>;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PartyItemPriceProps) {
    if (!props.companyId?.trim()) throw new Error('PartyItemPrice companyId is required');
    if (!props.partyId?.trim()) throw new Error('PartyItemPrice partyId is required');
    if (!props.itemId?.trim()) throw new Error('PartyItemPrice itemId is required');

    this.companyId = props.companyId.trim();
    this.partyId = props.partyId.trim();
    this.itemId = props.itemId.trim();
    this.lastSaleByCcyUom = normalizePointMap(props.lastSaleByCcyUom);
    this.lastPurchaseByCcyUom = normalizePointMap(props.lastPurchaseByCcyUom);
    this.contractSale = normalizePointMap(props.contractSale);
    this.contractPurchase = normalizePointMap(props.contractPurchase);
    this.extra = props.extra ? { ...props.extra } : undefined;
    this.createdAt = toDate(props.createdAt);
    this.updatedAt = toDate(props.updatedAt);
  }

  static compositeId(partyId: string, itemId: string): string {
    return `${partyId}__${itemId}`;
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      partyId: this.partyId,
      itemId: this.itemId,
      lastSaleByCcyUom: normalizePointMap(this.lastSaleByCcyUom),
      lastPurchaseByCcyUom: normalizePointMap(this.lastPurchaseByCcyUom),
      contractSale: normalizePointMap(this.contractSale),
      contractPurchase: normalizePointMap(this.contractPurchase),
      extra: this.extra ? { ...this.extra } : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): PartyItemPrice {
    return new PartyItemPrice({
      companyId: data.companyId,
      partyId: data.partyId,
      itemId: data.itemId,
      lastSaleByCcyUom: data.lastSaleByCcyUom,
      lastPurchaseByCcyUom: data.lastPurchaseByCcyUom,
      contractSale: data.contractSale,
      contractPurchase: data.contractPurchase,
      extra: data.extra,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}
