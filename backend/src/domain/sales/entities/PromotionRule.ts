import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export type PromotionType = 'BUY_X_GET_Y' | 'THRESHOLD_DISCOUNT';
export type PromotionScope = 'ALL' | 'ITEMS' | 'CATEGORIES';
export type PromotionStatus = 'ACTIVE' | 'INACTIVE';

export interface BuyXGetYConfig {
  buyQty: number;
  getQty: number;
  /** When omitted, the free item is the same as the purchased item */
  getItemId?: string;
}

export interface ThresholdDiscountConfig {
  thresholdBasis: 'QTY' | 'AMOUNT';
  thresholdValue: number;
  /** 0–100 inclusive */
  discountPct: number;
}

export interface PromotionRuleProps {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  type: PromotionType;
  status: PromotionStatus;
  /** Lower number = evaluated first when multiple rules match. Default 0. */
  priority?: number;
  /** YYYY-MM-DD — inclusive start of validity window */
  validFrom?: string;
  /** YYYY-MM-DD — inclusive end of validity window */
  validTo?: string;
  scope: PromotionScope;
  /** Required when scope === 'ITEMS' */
  itemIds?: string[];
  /** Required when scope === 'CATEGORIES' */
  categoryIds?: string[];
  /** Required when type === 'BUY_X_GET_Y' */
  buyXGetY?: BuyXGetYConfig;
  /** Required when type === 'THRESHOLD_DISCOUNT' */
  thresholdDiscount?: ThresholdDiscountConfig;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class PromotionRule {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly description?: string;
  readonly type: PromotionType;
  status: PromotionStatus;
  readonly priority: number;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly scope: PromotionScope;
  readonly itemIds: string[];
  readonly categoryIds: string[];
  readonly buyXGetY?: BuyXGetYConfig;
  readonly thresholdDiscount?: ThresholdDiscountConfig;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PromotionRuleProps) {
    // --- required field validation ---
    if (!props.name?.trim()) {
      throw new Error('PromotionRule: name is required');
    }

    // --- type-specific config validation ---
    if (props.type === 'BUY_X_GET_Y') {
      if (!props.buyXGetY) {
        throw new Error('PromotionRule: buyXGetY config is required for type BUY_X_GET_Y');
      }
      if (props.buyXGetY.buyQty < 1) {
        throw new Error('PromotionRule: buyXGetY.buyQty must be >= 1');
      }
      if (props.buyXGetY.getQty < 1) {
        throw new Error('PromotionRule: buyXGetY.getQty must be >= 1');
      }
    }

    if (props.type === 'THRESHOLD_DISCOUNT') {
      if (!props.thresholdDiscount) {
        throw new Error(
          'PromotionRule: thresholdDiscount config is required for type THRESHOLD_DISCOUNT'
        );
      }
      if (props.thresholdDiscount.thresholdValue <= 0) {
        throw new Error('PromotionRule: thresholdDiscount.thresholdValue must be > 0');
      }
      if (
        props.thresholdDiscount.discountPct < 0 ||
        props.thresholdDiscount.discountPct > 100 ||
        Number.isNaN(props.thresholdDiscount.discountPct)
      ) {
        throw new Error('PromotionRule: thresholdDiscount.discountPct must be between 0 and 100');
      }
    }

    // --- scope validation ---
    if (props.scope === 'ITEMS') {
      if (!props.itemIds || props.itemIds.length === 0) {
        throw new Error('PromotionRule: itemIds must be non-empty when scope is ITEMS');
      }
    }
    if (props.scope === 'CATEGORIES') {
      if (!props.categoryIds || props.categoryIds.length === 0) {
        throw new Error('PromotionRule: categoryIds must be non-empty when scope is CATEGORIES');
      }
    }

    // --- date range validation ---
    if (props.validFrom && props.validTo && props.validTo < props.validFrom) {
      throw new Error('PromotionRule: validTo must be >= validFrom');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.name = props.name;
    this.description = props.description;
    this.type = props.type;
    this.status = props.status;
    this.priority = props.priority ?? 0;
    this.validFrom = props.validFrom;
    this.validTo = props.validTo;
    this.scope = props.scope;
    this.itemIds = props.itemIds ?? [];
    this.categoryIds = props.categoryIds ?? [];
    this.buyXGetY = props.buyXGetY;
    this.thresholdDiscount = props.thresholdDiscount;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  // -------------------------------------------------------------------------
  // Domain methods
  // -------------------------------------------------------------------------

  /**
   * Returns true if the rule is ACTIVE and the given date falls within the
   * optional validity window.
   *
   * @param date YYYY-MM-DD
   */
  isActiveOn(date: string): boolean {
    if (this.status !== 'ACTIVE') return false;
    if (this.validFrom && date < this.validFrom) return false;
    if (this.validTo && date > this.validTo) return false;
    return true;
  }

  /**
   * Returns true if the rule applies to the given item.
   *
   * - scope ALL  → always true
   * - scope ITEMS → item must be in itemIds
   * - scope CATEGORIES → categoryId must be non-null and in categoryIds
   *
   * @param itemId      The item's id
   * @param categoryId  The item's category id (optional)
   */
  appliesToItem(itemId: string, categoryId?: string): boolean {
    switch (this.scope) {
      case 'ALL':
        return true;
      case 'ITEMS':
        return this.itemIds.includes(itemId);
      case 'CATEGORIES':
        return categoryId != null && this.categoryIds.includes(categoryId);
    }
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      description: this.description ?? null,
      type: this.type,
      status: this.status,
      priority: this.priority,
      validFrom: this.validFrom ?? null,
      validTo: this.validTo ?? null,
      scope: this.scope,
      itemIds: this.itemIds,
      categoryIds: this.categoryIds,
      buyXGetY: this.buyXGetY ?? null,
      thresholdDiscount: this.thresholdDiscount ?? null,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): PromotionRule {
    return new PromotionRule({
      id: data.id as string,
      companyId: data.companyId as string,
      name: data.name as string,
      description: data.description != null ? (data.description as string) : undefined,
      type: data.type as PromotionType,
      status: data.status as PromotionStatus,
      priority: data.priority as number | undefined,
      validFrom: data.validFrom != null ? (data.validFrom as string) : undefined,
      validTo: data.validTo != null ? (data.validTo as string) : undefined,
      scope: data.scope as PromotionScope,
      itemIds: data.itemIds != null ? (data.itemIds as string[]) : undefined,
      categoryIds: data.categoryIds != null ? (data.categoryIds as string[]) : undefined,
      buyXGetY: data.buyXGetY != null ? (data.buyXGetY as BuyXGetYConfig) : undefined,
      thresholdDiscount:
        data.thresholdDiscount != null
          ? (data.thresholdDiscount as ThresholdDiscountConfig)
          : undefined,
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
