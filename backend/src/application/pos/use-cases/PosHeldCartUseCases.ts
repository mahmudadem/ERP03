import { randomUUID } from 'crypto';
import { PosHeldCart, PosHeldCartLine, PosHeldCartStatus } from '../../../domain/pos/entities/PosHeldCart';
import { IPosHeldCartRepository } from '../../../repository/interfaces/pos/IPosHeldCartRepository';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';

export interface HoldPosCartInput {
  companyId: string;
  registerId: string;
  shiftId: string;
  cashierUserId: string;
  customerId?: string;
  note?: string;
  lines: PosHeldCartLine[];
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  grandTotal?: number;
  actor: { userId: string; userEmail?: string };
}

export interface ListPosHeldCartsInput {
  companyId: string;
  registerId?: string;
  shiftId?: string;
  cashierUserId?: string;
  status?: PosHeldCartStatus;
  limit?: number;
}

export class HoldPosCartUseCase {
  constructor(
    private readonly heldCartRepo: IPosHeldCartRepository,
    private readonly shiftRepo: IPosShiftRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(input: HoldPosCartInput): Promise<PosHeldCart> {
    const activeLines = (input.lines || []).filter((line) => Number(line.qty) > 0);
    if (!activeLines.length) throw new Error('Cannot hold an empty POS cart.');

    const [register, shift] = await Promise.all([
      this.registerRepo.getById(input.companyId, input.registerId),
      this.shiftRepo.getById(input.companyId, input.shiftId),
    ]);
    if (!register) throw new Error(`POS register not found: ${input.registerId}`);
    if (!shift || shift.status !== 'OPEN') throw new Error('A held cart requires an open POS shift.');
    if (shift.registerId !== input.registerId) throw new Error('Held cart register must match the open shift register.');
    if (shift.cashierUserId !== input.cashierUserId) throw new Error('Held cart cashier must match the open shift cashier.');

    const now = new Date();
    const cart = new PosHeldCart({
      id: `held_${randomUUID()}`,
      companyId: input.companyId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      cashierUserId: input.cashierUserId,
      customerId: input.customerId,
      note: input.note,
      lines: activeLines,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      taxTotal: input.taxTotal,
      grandTotal: input.grandTotal,
      createdBy: input.actor.userId,
      createdAt: now,
      updatedAt: now,
    });
    await this.heldCartRepo.create(cart);
    await this.auditEngine?.record({
      companyId: input.companyId,
      actor: input.actor,
      action: 'CREATE',
      entity: { type: 'POS_HELD_CART', id: cart.id, number: cart.id },
      after: cart.toJSON() as unknown as Record<string, unknown>,
    });
    return cart;
  }
}

export class ListPosHeldCartsUseCase {
  constructor(private readonly heldCartRepo: IPosHeldCartRepository) {}

  async execute(input: ListPosHeldCartsInput): Promise<PosHeldCart[]> {
    return this.heldCartRepo.list(input.companyId, {
      registerId: input.registerId,
      shiftId: input.shiftId,
      cashierUserId: input.cashierUserId,
      status: input.status || 'HELD',
      limit: input.limit || 50,
    });
  }
}

export class GetPosHeldCartUseCase {
  constructor(private readonly heldCartRepo: IPosHeldCartRepository) {}

  async execute(companyId: string, id: string): Promise<PosHeldCart | null> {
    return this.heldCartRepo.getById(companyId, id);
  }
}

export class RecallPosHeldCartUseCase {
  constructor(private readonly heldCartRepo: IPosHeldCartRepository, private readonly auditEngine?: IAuditEngine) {}

  async execute(input: { companyId: string; id: string; actor: { userId: string; userEmail?: string } }): Promise<PosHeldCart> {
    const cart = await this.heldCartRepo.getById(input.companyId, input.id);
    if (!cart) throw new Error(`Held cart not found: ${input.id}`);
    const recalled = cart.markRecalled(input.actor.userId);
    await this.heldCartRepo.update(recalled);
    await this.auditEngine?.record({
      companyId: input.companyId,
      actor: input.actor,
      action: 'UPDATE',
      entity: { type: 'POS_HELD_CART', id: recalled.id, number: recalled.id },
      before: cart.toJSON() as unknown as Record<string, unknown>,
      after: recalled.toJSON() as unknown as Record<string, unknown>,
    });
    return recalled;
  }
}

export class CancelPosHeldCartUseCase {
  constructor(private readonly heldCartRepo: IPosHeldCartRepository, private readonly auditEngine?: IAuditEngine) {}

  async execute(input: { companyId: string; id: string; reason?: string; actor: { userId: string; userEmail?: string } }): Promise<PosHeldCart> {
    const cart = await this.heldCartRepo.getById(input.companyId, input.id);
    if (!cart) throw new Error(`Held cart not found: ${input.id}`);
    const cancelled = cart.markCancelled(input.actor.userId, input.reason);
    await this.heldCartRepo.update(cancelled);
    await this.auditEngine?.record({
      companyId: input.companyId,
      actor: input.actor,
      action: 'UPDATE',
      entity: { type: 'POS_HELD_CART', id: cancelled.id, number: cancelled.id },
      before: cart.toJSON() as unknown as Record<string, unknown>,
      after: cancelled.toJSON() as unknown as Record<string, unknown>,
    });
    return cancelled;
  }
}
