
import { Item } from '../../../domain/inventory/entities/Item';
import { IItemRepository } from '../../../repository/interfaces/inventory';

export class CreateItemUseCase {
  constructor(private repo: IItemRepository) {}

  async execute(data: any): Promise<Item> {
    const item = new Item(
      `itm_${Date.now()}`,
      data.companyId,
      data.name,
      data.code,
      data.unit,
      data.categoryId,
      true,
      data.price,
      data.cost
    );
    await this.repo.createItem(item);
    return item;
  }
}

export class UpdateItemUseCase {
  constructor(private repo: IItemRepository) {}

  async execute(id: string, data: Partial<Item>): Promise<void> {
    await this.repo.updateItem(id, data);
  }
}

export class ActivateItemUseCase {
  constructor(private repo: IItemRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.setItemActive(id, true);
  }
}

export class DeactivateItemUseCase {
  constructor(private repo: IItemRepository) {}
  async execute(id: string): Promise<void> {
    await this.repo.setItemActive(id, false);
  }
}
