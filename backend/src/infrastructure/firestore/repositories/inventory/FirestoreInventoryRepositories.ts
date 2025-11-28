
import { BaseFirestoreRepository } from '../BaseFirestoreRepository';
import { IItemRepository, IWarehouseRepository, IStockMovementRepository } from '../../../../repository/interfaces/inventory';
import { Item } from '../../../../domain/inventory/entities/Item';
import { Warehouse } from '../../../../domain/inventory/entities/Warehouse';
import { StockMovement } from '../../../../domain/inventory/entities/StockMovement';
import { ItemMapper, WarehouseMapper, StockMovementMapper } from '../../mappers/InventoryMappers';

export class FirestoreItemRepository extends BaseFirestoreRepository<Item> implements IItemRepository {
  protected collectionName = 'items';
  protected toDomain = ItemMapper.toDomain;
  protected toPersistence = ItemMapper.toPersistence;

  async createItem(item: Item): Promise<void> { return this.save(item); }
  async updateItem(id: string, data: Partial<Item>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async setItemActive(id: string, active: boolean): Promise<void> { await this.db.collection(this.collectionName).doc(id).update({ active }); }
  async getItem(id: string): Promise<Item | null> { return this.findById(id); }
  async getCompanyItems(companyId: string): Promise<Item[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreWarehouseRepository extends BaseFirestoreRepository<Warehouse> implements IWarehouseRepository {
  protected collectionName = 'warehouses';
  protected toDomain = WarehouseMapper.toDomain;
  protected toPersistence = WarehouseMapper.toPersistence;

  async createWarehouse(wh: Warehouse): Promise<void> { return this.save(wh); }
  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> { await this.db.collection(this.collectionName).doc(id).update(data); }
  async getWarehouse(id: string): Promise<Warehouse | null> { return this.findById(id); }
  async getCompanyWarehouses(companyId: string): Promise<Warehouse[]> {
      const snap = await this.db.collection(this.collectionName).where('companyId', '==', companyId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}

export class FirestoreStockMovementRepository extends BaseFirestoreRepository<StockMovement> implements IStockMovementRepository {
  protected collectionName = 'stock_movements';
  protected toDomain = StockMovementMapper.toDomain;
  protected toPersistence = StockMovementMapper.toPersistence;

  async recordMovement(mv: StockMovement): Promise<void> { return this.save(mv); }
  async getItemMovements(itemId: string): Promise<StockMovement[]> {
      const snap = await this.db.collection(this.collectionName).where('itemId', '==', itemId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
  async getWarehouseMovements(warehouseId: string): Promise<StockMovement[]> {
      const snap = await this.db.collection(this.collectionName).where('warehouseId', '==', warehouseId).get();
      return snap.docs.map(d => this.toDomain(d.data()));
  }
}
