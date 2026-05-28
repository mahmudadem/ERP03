import { randomUUID } from 'crypto';

export interface PurchasePriceListLine {
  /** Inventory item identifier */
  itemId: string;
  /** Quantity break threshold — the minimum qty for this tier (default 1) */
  minQty: number;
  /** Unit price for this tier (must be > 0) */
  unitPrice: number;
  /** Optional discount percentage override (0–100) */
  discountPct?: number;
  /** Free-text note */
  comment?: string;
}

export interface PurchasePriceListProps {
  id?: string;
  companyId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date;
  validTo?: Date;
  isDefault: boolean;
  lines: PurchasePriceListLine[];
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class PurchasePriceList {
  readonly id: string;
  readonly companyId: string;
  name: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE';
  validFrom?: Date;
  validTo?: Date;
  isDefault: boolean;
  lines: PurchasePriceListLine[];
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PurchasePriceListProps) {
    if (!props.name?.trim()) {
      throw new Error('PurchasePriceList name is required');
    }
    if (!props.currency || props.currency.trim().length !== 3) {
      throw new Error('PurchasePriceList currency must be exactly 3 characters (ISO 4217)');
    }

    if (props.validFrom && props.validTo && props.validTo < props.validFrom) {
      throw new Error('PurchasePriceList validTo must be >= validFrom');
    }

    const seen = new Map<string, Set<number>>();
    for (const line of props.lines) {
      if (line.unitPrice <= 0) {
        throw new Error(
          `PurchasePriceList line for item "${line.itemId}" has unitPrice <= 0`
        );
      }
      const minQty = line.minQty ?? 1;
      if (minQty < 0) {
        throw new Error(
          `PurchasePriceList line for item "${line.itemId}" has minQty < 0`
        );
      }
      const key = line.itemId;
      if (!seen.has(key)) seen.set(key, new Set());
      const qtys = seen.get(key)!;
      if (qtys.has(minQty)) {
        throw new Error(
          `PurchasePriceList has duplicate line for itemId "${line.itemId}" with minQty ${minQty}`
        );
      }
      qtys.add(minQty);
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.currency = props.currency.trim().toUpperCase();
    this.status = props.status;
    this.validFrom = props.validFrom;
    this.validTo = props.validTo;
    this.isDefault = props.isDefault;
    this.lines = props.lines.map((l) => ({
      ...l,
      minQty: l.minQty ?? 1,
    }));
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  isActiveOn(date: Date): boolean {
    if (this.status !== 'ACTIVE') return false;
    if (this.validFrom && date < this.validFrom) return false;
    if (this.validTo && date > this.validTo) return false;
    return true;
  }

  getEffectiveLine(itemId: string, qty: number): PurchasePriceListLine | null {
    const itemLines = this.lines
      .filter((l) => l.itemId === itemId && l.minQty <= qty)
      .sort((a, b) => b.minQty - a.minQty); // descending → highest tier first

    return itemLines[0] ?? null;
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      currency: this.currency,
      status: this.status,
      validFrom: this.validFrom?.toISOString() ?? null,
      validTo: this.validTo?.toISOString() ?? null,
      isDefault: this.isDefault,
      lines: this.lines,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): PurchasePriceList {
    return new PurchasePriceList({
      id: data.id as string,
      companyId: data.companyId as string,
      name: data.name as string,
      currency: data.currency as string,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      validFrom: data.validFrom ? new Date(data.validFrom as string) : undefined,
      validTo: data.validTo ? new Date(data.validTo as string) : undefined,
      isDefault: Boolean(data.isDefault),
      lines: (data.lines as PurchasePriceListLine[]) ?? [],
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
