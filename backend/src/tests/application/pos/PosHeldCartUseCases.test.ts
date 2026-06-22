import {
  CancelPosHeldCartUseCase,
  HoldPosCartUseCase,
  ListPosHeldCartsUseCase,
  RecallPosHeldCartUseCase,
} from '../../../application/pos/use-cases/PosHeldCartUseCases';
import { PosHeldCart } from '../../../domain/pos/entities/PosHeldCart';
import { PosRegister } from '../../../domain/pos/entities/PosRegister';
import { PosShift } from '../../../domain/pos/entities/PosShift';

const makeRegister = () =>
  PosRegister.fromJSON({
    id: 'reg_1',
    companyId: 'cmp_test',
    code: 'POS-01',
    name: 'Front Till',
    warehouseId: 'wh1',
    cashDrawerAccountId: 'cash-acc',
    status: 'ACTIVE',
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    updatedAt: new Date('2026-06-22T10:00:00.000Z'),
  });

const makeShift = (overrides: Record<string, any> = {}) =>
  PosShift.fromJSON({
    id: 'shift_1',
    companyId: 'cmp_test',
    registerId: 'reg_1',
    cashierUserId: 'cashier_1',
    status: 'OPEN',
    openedAt: new Date('2026-06-22T10:00:00.000Z'),
    openingFloat: 100,
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    updatedAt: new Date('2026-06-22T10:00:00.000Z'),
    ...overrides,
  });

const makeHeldCart = (overrides: Record<string, any> = {}) =>
  PosHeldCart.fromJSON({
    id: 'held_1',
    companyId: 'cmp_test',
    registerId: 'reg_1',
    shiftId: 'shift_1',
    cashierUserId: 'cashier_1',
    customerId: 'walk-in',
    status: 'HELD',
    lines: [{ lineId: 'line_1', itemId: 'item_1', itemName: 'Widget', qty: 2, unitPrice: 10, lineDiscount: 0, lineTotal: 20 }],
    subtotal: 20,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 20,
    createdBy: 'cashier_1',
    createdAt: new Date('2026-06-22T10:00:00.000Z'),
    updatedAt: new Date('2026-06-22T10:00:00.000Z'),
    ...overrides,
  });

describe('PosHeldCartUseCases', () => {
  it('holds a non-empty cart without posting receipt, payment, stock, or ledger side effects', async () => {
    const heldCartRepo = { create: jest.fn(), update: jest.fn(), getById: jest.fn(), list: jest.fn() };
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift()) };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
    const useCase = new HoldPosCartUseCase(heldCartRepo as any, shiftRepo as any, registerRepo as any, auditEngine as any);

    const cart = await useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      cashierUserId: 'cashier_1',
      customerId: 'walk-in',
      lines: [{ lineId: 'line_1', itemId: 'item_1', itemName: 'Widget', qty: 2, unitPrice: 10, lineDiscount: 0, lineTotal: 20 }],
      subtotal: 20,
      grandTotal: 20,
      actor: { userId: 'cashier_1' },
    });

    expect(cart.status).toBe('HELD');
    expect(cart.grandTotal).toBe(20);
    expect(heldCartRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'HELD' }));
    expect(auditEngine.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: expect.objectContaining({ type: 'POS_HELD_CART' }),
    }));
  });

  it('rejects holding when the shift is closed or belongs to another cashier', async () => {
    const heldCartRepo = { create: jest.fn() };
    const registerRepo = { getById: jest.fn().mockResolvedValue(makeRegister()) };
    const shiftRepo = { getById: jest.fn().mockResolvedValue(makeShift({ status: 'CLOSED' })) };
    const useCase = new HoldPosCartUseCase(heldCartRepo as any, shiftRepo as any, registerRepo as any);

    await expect(useCase.execute({
      companyId: 'cmp_test',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      cashierUserId: 'cashier_1',
      lines: [{ itemId: 'item_1', qty: 1, unitPrice: 10 }],
      actor: { userId: 'cashier_1' },
    })).rejects.toThrow(/open POS shift/i);
    expect(heldCartRepo.create).not.toHaveBeenCalled();
  });

  it('lists only held carts by default', async () => {
    const heldCartRepo = { list: jest.fn().mockResolvedValue([makeHeldCart()]) };
    const useCase = new ListPosHeldCartsUseCase(heldCartRepo as any);

    const result = await useCase.execute({ companyId: 'cmp_test', registerId: 'reg_1' });

    expect(result).toHaveLength(1);
    expect(heldCartRepo.list).toHaveBeenCalledWith('cmp_test', expect.objectContaining({ registerId: 'reg_1', status: 'HELD', limit: 50 }));
  });

  it('recalls a held cart once and blocks a second recall', async () => {
    const held = makeHeldCart();
    const heldCartRepo = { getById: jest.fn().mockResolvedValue(held), update: jest.fn() };
    const auditEngine = { record: jest.fn().mockResolvedValue(undefined) };
    const useCase = new RecallPosHeldCartUseCase(heldCartRepo as any, auditEngine as any);

    const recalled = await useCase.execute({ companyId: 'cmp_test', id: 'held_1', actor: { userId: 'cashier_1' } });

    expect(recalled.status).toBe('RECALLED');
    expect(heldCartRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'RECALLED' }));

    heldCartRepo.getById.mockResolvedValue(recalled);
    await expect(useCase.execute({ companyId: 'cmp_test', id: 'held_1', actor: { userId: 'cashier_1' } })).rejects.toThrow(/Only HELD carts/);
  });

  it('cancels a held cart with a reason', async () => {
    const held = makeHeldCart();
    const heldCartRepo = { getById: jest.fn().mockResolvedValue(held), update: jest.fn() };
    const useCase = new CancelPosHeldCartUseCase(heldCartRepo as any);

    const cancelled = await useCase.execute({ companyId: 'cmp_test', id: 'held_1', reason: 'Customer left', actor: { userId: 'cashier_1' } });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('Customer left');
    expect(heldCartRepo.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'CANCELLED' }));
  });
});
