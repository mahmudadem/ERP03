import { Timestamp } from 'firebase-admin/firestore';
import { DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';
import { SalesOrder } from '../../../domain/sales/entities/SalesOrder';
import { SalesReturn } from '../../../domain/sales/entities/SalesReturn';
import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';

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

export class SalesSettingsMapper {
  static toDomain(data: any): SalesSettings {
    return SalesSettings.fromJSON({ ...data });
  }

  static toPersistence(entity: SalesSettings): any {
    return stripUndefinedDeep({ ...entity.toJSON() });
  }
}

export class SalesOrderMapper {
  static toDomain(data: any): SalesOrder {
    return SalesOrder.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      confirmedAt: toDate(data.confirmedAt),
      closedAt: toDate(data.closedAt),
    });
  }

  static toPersistence(entity: SalesOrder): any {
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

export class DeliveryNoteMapper {
  static toDomain(data: any): DeliveryNote {
    return DeliveryNote.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: DeliveryNote): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class SalesInvoiceMapper {
  static toDomain(data: any): SalesInvoice {
    return SalesInvoice.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: SalesInvoice): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class SalesReturnMapper {
  static toDomain(data: any): SalesReturn {
    return SalesReturn.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: SalesReturn): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}
