import { Timestamp } from 'firebase-admin/firestore';
import { GoodsReceipt } from '../../../domain/purchases/entities/GoodsReceipt';
import { PurchaseInvoice } from '../../../domain/purchases/entities/PurchaseInvoice';
import { PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';
import { PurchaseReturn } from '../../../domain/purchases/entities/PurchaseReturn';
import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

const toTimestamp = (value: Date | undefined): Timestamp | null => {
  if (!value) return null;
  return Timestamp.fromDate(value);
};

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date || value instanceof Timestamp) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }

  const output: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const normalized = stripUndefinedDeep(entry);
    if (normalized !== undefined) {
      output[key] = normalized;
    }
  });

  return output;
};

export class PurchaseSettingsMapper {
  static toDomain(data: any): PurchaseSettings {
    return PurchaseSettings.fromJSON({
      ...data,
    });
  }

  static toPersistence(entity: PurchaseSettings): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
    });
  }
}

export class PurchaseOrderMapper {
  static toDomain(data: any): PurchaseOrder {
    return PurchaseOrder.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      confirmedAt: toDate(data.confirmedAt),
      closedAt: toDate(data.closedAt),
    });
  }

  static toPersistence(entity: PurchaseOrder): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      confirmedAt: toTimestamp(entity.confirmedAt),
      closedAt: toTimestamp(entity.closedAt),
    });
  }
}

export class GoodsReceiptMapper {
  static toDomain(data: any): GoodsReceipt {
    return GoodsReceipt.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: GoodsReceipt): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class PurchaseInvoiceMapper {
  static toDomain(data: any): PurchaseInvoice {
    return PurchaseInvoice.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: PurchaseInvoice): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class PurchaseReturnMapper {
  static toDomain(data: any): PurchaseReturn {
    return PurchaseReturn.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: PurchaseReturn): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}
