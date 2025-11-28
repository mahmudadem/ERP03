
import * as admin from 'firebase-admin';
import { Item } from '../../../domain/inventory/entities/Item';
import { Warehouse } from '../../../domain/inventory/entities/Warehouse';
import { StockMovement } from '../../../domain/inventory/entities/StockMovement';

export class ItemMapper {
  static toDomain(data: any): Item {
    return new Item(
      data.id,
      data.companyId,
      data.name,
      data.code,
      data.unit,
      data.categoryId,
      data.active,
      data.price,
      data.cost
    );
  }
  static toPersistence(entity: Item): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      name: entity.name,
      code: entity.code,
      unit: entity.unit,
      categoryId: entity.categoryId,
      active: entity.active,
      price: entity.price || 0,
      cost: entity.cost || 0
    };
  }
}

export class WarehouseMapper {
  static toDomain(data: any): Warehouse {
    return new Warehouse(data.id, data.companyId, data.name, data.location);
  }
  static toPersistence(entity: Warehouse): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      name: entity.name,
      location: entity.location || null
    };
  }
}

export class StockMovementMapper {
  static toDomain(data: any): StockMovement {
    return new StockMovement(
      data.id,
      data.companyId,
      data.itemId,
      data.warehouseId,
      data.qty,
      data.direction,
      data.referenceType,
      data.referenceId,
      data.date?.toDate?.() || new Date(data.date)
    );
  }
  static toPersistence(entity: StockMovement): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      itemId: entity.itemId,
      warehouseId: entity.warehouseId,
      qty: entity.qty,
      direction: entity.direction,
      referenceType: entity.referenceType,
      referenceId: entity.referenceId,
      date: admin.firestore.Timestamp.fromDate(entity.date)
    };
  }
}
