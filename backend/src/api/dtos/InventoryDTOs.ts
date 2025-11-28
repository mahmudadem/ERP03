
/**
 * InventoryDTOs.ts
 */
import { Item } from '../../domain/inventory/entities/Item';
import { Warehouse } from '../../domain/inventory/entities/Warehouse';

export interface ItemDTO {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
}

export interface WarehouseDTO {
  id: string;
  name: string;
  location?: string;
}

export class InventoryDTOMapper {
  static toItemDTO(item: Item): ItemDTO {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      price: item.price || 0,
      active: item.active,
    };
  }

  static toWarehouseDTO(wh: Warehouse): WarehouseDTO {
    return {
      id: wh.id,
      name: wh.name,
      location: wh.location,
    };
  }
}
