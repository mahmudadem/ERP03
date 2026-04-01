
import { Timestamp } from 'firebase-admin/firestore';
import { Item } from '../../../domain/inventory/entities/Item';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';
import { StockLevel } from '../../../domain/inventory/entities/StockLevel';
import { ItemCategory } from '../../../domain/inventory/entities/ItemCategory';
import { UomConversion } from '../../../domain/inventory/entities/UomConversion';
import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';
import { StockAdjustment } from '../../../domain/inventory/entities/StockAdjustment';
import { InventoryPeriodSnapshot } from '../../../domain/inventory/entities/InventoryPeriodSnapshot';
import { StockTransfer } from '../../../domain/inventory/entities/StockTransfer';

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

export class ItemMapper {
  static toDomain(data: any): Item {
    return Item.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }

  static toPersistence(entity: Item): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
    });
  }
}

export class WarehouseMapper {
  static toDomain(data: any): Warehouse {
    return Warehouse.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }

  static toPersistence(entity: Warehouse): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      updatedAt: toTimestamp(entity.updatedAt),
    });
  }
}

export class StockMovementMapper {
  static toDomain(data: any): StockMovement {
    return StockMovement.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: StockMovement): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class StockLevelMapper {
  static toDomain(data: any): StockLevel {
    return StockLevel.fromJSON({
      ...data,
      updatedAt: toDate(data.updatedAt),
    });
  }

  static toPersistence(entity: StockLevel): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      updatedAt: toTimestamp(entity.updatedAt),
    });
  }
}

export class ItemCategoryMapper {
  static toDomain(data: any): ItemCategory {
    return ItemCategory.fromJSON(data);
  }

  static toPersistence(entity: ItemCategory): any {
    return stripUndefinedDeep(entity.toJSON());
  }
}

export class UomConversionMapper {
  static toDomain(data: any): UomConversion {
    return UomConversion.fromJSON(data);
  }

  static toPersistence(entity: UomConversion): any {
    return stripUndefinedDeep(entity.toJSON());
  }
}

export class InventorySettingsMapper {
  static toDomain(data: any): InventorySettings {
    return InventorySettings.fromJSON(data);
  }

  static toPersistence(entity: InventorySettings): any {
    return stripUndefinedDeep(entity.toJSON());
  }
}

export class StockAdjustmentMapper {
  static toDomain(data: any): StockAdjustment {
    return StockAdjustment.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      postedAt: toDate(data.postedAt),
    });
  }

  static toPersistence(entity: StockAdjustment): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      postedAt: toTimestamp(entity.postedAt),
    });
  }
}

export class StockTransferMapper {
  static toDomain(data: any): StockTransfer {
    return StockTransfer.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
      completedAt: toDate(data.completedAt),
    });
  }

  static toPersistence(entity: StockTransfer): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
      completedAt: toTimestamp(entity.completedAt),
    });
  }
}

export class InventoryPeriodSnapshotMapper {
  static toDomain(data: any): InventoryPeriodSnapshot {
    return InventoryPeriodSnapshot.fromJSON({
      ...data,
      createdAt: toDate(data.createdAt),
    });
  }

  static toPersistence(entity: InventoryPeriodSnapshot): any {
    const data = entity.toJSON();
    return stripUndefinedDeep({
      ...data,
      createdAt: toTimestamp(entity.createdAt),
    });
  }
}
