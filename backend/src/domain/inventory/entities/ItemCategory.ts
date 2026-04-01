export interface ItemCategoryProps {
  id: string;
  companyId: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  defaultRevenueAccountId?: string;
  defaultCogsAccountId?: string;
  defaultInventoryAssetAccountId?: string;
}

export class ItemCategory {
  readonly id: string;
  readonly companyId: string;
  name: string;
  parentId?: string;
  sortOrder: number;
  active: boolean;
  defaultRevenueAccountId?: string;
  defaultCogsAccountId?: string;
  defaultInventoryAssetAccountId?: string;

  constructor(props: ItemCategoryProps) {
    if (!props.id?.trim()) throw new Error('ItemCategory id is required');
    if (!props.companyId?.trim()) throw new Error('ItemCategory companyId is required');
    if (!props.name?.trim()) throw new Error('ItemCategory name is required');

    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.parentId = props.parentId;
    this.sortOrder = props.sortOrder;
    this.active = props.active;
    this.defaultRevenueAccountId = props.defaultRevenueAccountId;
    this.defaultCogsAccountId = props.defaultCogsAccountId;
    this.defaultInventoryAssetAccountId = props.defaultInventoryAssetAccountId;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      parentId: this.parentId,
      sortOrder: this.sortOrder,
      active: this.active,
      defaultRevenueAccountId: this.defaultRevenueAccountId,
      defaultCogsAccountId: this.defaultCogsAccountId,
      defaultInventoryAssetAccountId: this.defaultInventoryAssetAccountId,
    };
  }

  static fromJSON(data: any): ItemCategory {
    return new ItemCategory({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      parentId: data.parentId,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
      defaultRevenueAccountId: data.defaultRevenueAccountId,
      defaultCogsAccountId: data.defaultCogsAccountId,
      defaultInventoryAssetAccountId: data.defaultInventoryAssetAccountId,
    });
  }
}
