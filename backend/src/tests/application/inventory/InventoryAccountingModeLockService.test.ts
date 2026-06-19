import { describe, expect, it, jest } from '@jest/globals';
import { InventoryAccountingModeLockService } from '../../../application/inventory/services/InventoryAccountingModeLockService';

describe('InventoryAccountingModeLockService', () => {
  it('allows mode changes before any posted vouchers or stock movements exist', async () => {
    const service = new InventoryAccountingModeLockService(
      { hasPostedVouchers: jest.fn(async () => false) } as any,
      { hasAnyMovements: jest.fn(async () => false) } as any
    );

    await expect(service.getLockState('cmp-1')).resolves.toEqual({
      locked: false,
      hasPostedVouchers: false,
      hasStockMovements: false,
      reason: null,
    });
    await expect(service.assertModeChangeAllowed('cmp-1')).resolves.toBeUndefined();
  });

  it('blocks mode changes after the first posted voucher', async () => {
    const service = new InventoryAccountingModeLockService(
      { hasPostedVouchers: jest.fn(async () => true) } as any,
      { hasAnyMovements: jest.fn(async () => false) } as any
    );

    await expect(service.assertModeChangeAllowed('cmp-1')).rejects.toThrow(
      'Inventory accounting mode is locked after the first posted stock or accounting transaction.'
    );
  });

  it('blocks mode changes after the first stock movement even without vouchers', async () => {
    const service = new InventoryAccountingModeLockService(
      { hasPostedVouchers: jest.fn(async () => false) } as any,
      { hasAnyMovements: jest.fn(async () => true) } as any
    );

    await expect(service.getLockState('cmp-1')).resolves.toMatchObject({
      locked: true,
      hasPostedVouchers: false,
      hasStockMovements: true,
    });
  });
});
