import { Timestamp } from 'firebase-admin/firestore';
import { Party } from '../../../domain/shared/entities/Party';
import { TaxCode } from '../../../domain/shared/entities/TaxCode';

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

export class PartyMapper {
  static toDomain(data: any): Party {
    return Party.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }

  static toPersistence(entity: Party): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
    });
  }
}

export class TaxCodeMapper {
  static toDomain(data: any): TaxCode {
    return TaxCode.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }

  static toPersistence(entity: TaxCode): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
    });
  }
}
