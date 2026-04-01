import { POStatus, PurchaseOrder } from '../../../domain/purchases/entities/PurchaseOrder';

export const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const addDaysToISODate = (isoDate: string, days: number): string => {
  const [year, month, day] = isoDate.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

export const updatePOStatus = (po: PurchaseOrder): POStatus => {
  if (po.status === 'CANCELLED' || po.status === 'CLOSED') {
    return po.status;
  }

  const allLinesFullyReceived = po.lines.every((line) => !line.trackInventory || line.receivedQty >= line.orderedQty);
  const anyLinePartiallyReceived = po.lines.some((line) => line.receivedQty > 0 && line.receivedQty < line.orderedQty);

  if (allLinesFullyReceived) return 'FULLY_RECEIVED';
  if (anyLinePartiallyReceived) return 'PARTIALLY_RECEIVED';
  return po.status;
};
