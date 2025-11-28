
import * as admin from 'firebase-admin';
import { POSShift } from '../../../domain/pos/entities/POSShift';
import { POSOrder, POSOrderItem } from '../../../domain/pos/entities/POSOrder';

export class POSShiftMapper {
  static toDomain(data: any): POSShift {
    return new POSShift(
      data.id,
      data.companyId,
      data.userId,
      data.openedAt?.toDate?.() || new Date(data.openedAt),
      data.openingBalance,
      data.closedAt ? (data.closedAt?.toDate?.() || new Date(data.closedAt)) : undefined,
      data.closingBalance
    );
  }
  static toPersistence(entity: POSShift): any {
    return {
      id: entity.id,
      companyId: entity.companyId,
      userId: entity.userId,
      openedAt: admin.firestore.Timestamp.fromDate(entity.openedAt),
      openingBalance: entity.openingBalance,
      closedAt: entity.closedAt ? admin.firestore.Timestamp.fromDate(entity.closedAt) : null,
      closingBalance: entity.closingBalance || null
    };
  }
}

export class POSOrderMapper {
  static toDomain(data: any): POSOrder {
    const items = (data.items || []).map((i: any) => new POSOrderItem(
      i.itemId, i.name, i.qty, i.price, i.discount
    ));
    return new POSOrder(
      data.id,
      data.companyId,
      data.shiftId,
      items,
      data.totalAmount,
      data.createdAt?.toDate?.() || new Date(data.createdAt),
      data.status
    );
  }
  static toPersistence(entity: POSOrder): any {
    const items = entity.items.map(i => ({
      itemId: i.itemId,
      name: i.name,
      qty: i.qty,
      price: i.price,
      discount: i.discount
    }));
    return {
      id: entity.id,
      companyId: entity.companyId,
      shiftId: entity.shiftId,
      items: items,
      totalAmount: entity.totalAmount,
      createdAt: admin.firestore.Timestamp.fromDate(entity.createdAt),
      status: entity.status
    };
  }
}
