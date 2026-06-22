import { randomUUID } from 'crypto';
import { normalizePaymentTotals, PosShift, PosShiftPaymentTotals } from '../../../domain/pos/entities/PosShift';
import { PosCashMovement, PosCashMovementType } from '../../../domain/pos/entities/PosCashMovement';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';
import { IPosPaymentRepository } from '../../../repository/interfaces/pos/IPosPaymentRepository';
import {
  IPosCashMovementRepository,
  PosCashMovementTotals,
} from '../../../repository/interfaces/pos/IPosCashMovementRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { roundMoney } from '../../../domain/accounting/entities/VoucherLineEntity';
import { PostingLockPolicy, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IAccountingBridge } from '../../system-core';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface OpenPosShiftInput {
  companyId: string;
  registerId: string;
  cashierUserId: string;
  openingFloat: number;
  actor: { userId: string };
}

export class OpenPosShiftUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(input: OpenPosShiftInput): Promise<PosShift> {
    if (!Number.isFinite(input.openingFloat) || input.openingFloat < 0) {
      throw new Error('openingFloat must be a non-negative number');
    }
    const register = await this.registerRepo.getById(input.companyId, input.registerId);
    if (!register) {
      throw new Error(`POS register not found: ${input.registerId}`);
    }
    if (!register.isActive()) {
      throw new Error('Cannot open a shift on an INACTIVE register.');
    }
    if (!register.isCashierAllowed(input.cashierUserId)) {
      throw new Error('Cashier is not allowed to open a shift on this register.');
    }
    const existing = await this.shiftRepo.getOpenShiftForRegister(input.companyId, input.registerId);
    if (existing) {
      throw new Error('Register already has an open shift.');
    }
    // Optional second guard: cashier cannot hold two open shifts
    const cashierOpen = await this.shiftRepo.getOpenShiftForCashier(input.companyId, input.cashierUserId);
    if (cashierOpen) {
      throw new Error('You already have an open shift on another register.');
    }
    // No-op existence of settings — settings is optional.
    await this.posSettingsRepo.getSettings(input.companyId).catch(() => null);

    const now = new Date();
    const shift = new PosShift({
      id: `shift_${randomUUID()}`,
      companyId: input.companyId,
      registerId: input.registerId,
      cashierUserId: input.cashierUserId,
      status: 'OPEN',
      openedAt: now,
      openingFloat: round2(input.openingFloat),
      createdAt: now,
      updatedAt: now,
    });

    const openingMovement = new PosCashMovement({
      id: `cm_${randomUUID()}`,
      companyId: input.companyId,
      shiftId: shift.id,
      registerId: input.registerId,
      type: 'OPENING_FLOAT',
      amount: round2(input.openingFloat),
      createdBy: input.actor.userId,
      createdAt: now,
    });

    await this.transactionManager.runTransaction(async (tx) => {
      await this.shiftRepo.create(shift, tx);
      await this.cashMovementRepo.create(openingMovement, tx);
    });

    return shift;
  }
}

export interface CreatePosCashMovementInput {
  companyId: string;
  shiftId: string;
  type: PosCashMovementType;
  amount: number;
  reason?: string;
  actor: { userId: string };
}

const ALLOWED_CASHIER_MOVEMENT_TYPES: PosCashMovementType[] = ['PAYIN', 'PAYOUT', 'DROP'];

export class CreatePosCashMovementUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly transactionManager: ITransactionManager
  ) {}

  async execute(input: CreatePosCashMovementInput): Promise<PosCashMovement> {
    if (!ALLOWED_CASHIER_MOVEMENT_TYPES.includes(input.type)) {
      throw new Error(
        `Cashier-driven movements must be PAYIN, PAYOUT, or DROP. Got: ${input.type}`
      );
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    const shift = await this.shiftRepo.getById(input.companyId, input.shiftId);
    if (!shift) throw new Error(`POS shift not found: ${input.shiftId}`);
    if (!shift.isOpen()) {
      throw new Error('Cannot record cash movements on a closed shift.');
    }

    const movement = new PosCashMovement({
      id: `cm_${randomUUID()}`,
      companyId: input.companyId,
      shiftId: shift.id,
      registerId: shift.registerId,
      type: input.type,
      amount: round2(input.amount),
      reason: input.reason,
      createdBy: input.actor.userId,
      createdAt: new Date(),
    });

    await this.transactionManager.runTransaction(async (tx) => {
      await this.cashMovementRepo.create(movement, tx);
    });
    return movement;
  }
}

export interface ClosePosShiftInput {
  companyId: string;
  shiftId: string;
  countedCash: number;
  countedPaymentTotals?: Partial<PosShiftPaymentTotals>;
  actor: { userId: string };
}

export interface ClosePosShiftResult {
  shift: PosShift;
  totals: PosCashMovementTotals;
  overShortAmount: number;
  overShortVoucherId?: string;
  expectedPaymentTotals: PosShiftPaymentTotals;
  countedPaymentTotals: PosShiftPaymentTotals;
  overShortPaymentTotals: PosShiftPaymentTotals;
}

/**
 * Close a shift: computes expected cash from movements + opening float, computes
 * over/short vs counted, records a balanced JOURNAL_ENTRY financial event through
 * IAccountingBridge if the variance is non-zero, then marks the
 * shift CLOSED.  Runs in one transaction so the voucher + shift update are atomic.
 *
 * The voucher uses the register's `cashDrawerAccountId` on the cash side and the
 * configured `cashOverAccountId` (when counted > expected) or
 * `cashShortAccountId` (when counted < expected) on the offset side.
 */
export class ClosePosShiftUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly accountingBridge: IAccountingBridge,
    private readonly transactionManager: ITransactionManager,
    private readonly receiptRepo?: IPosReceiptRepository,
    private readonly paymentRepo?: IPosPaymentRepository
  ) {}

  async execute(input: ClosePosShiftInput): Promise<ClosePosShiftResult> {
    if (!Number.isFinite(input.countedCash) || input.countedCash < 0) {
      throw new Error('countedCash must be a non-negative number');
    }
    const shift = await this.shiftRepo.getById(input.companyId, input.shiftId);
    if (!shift) throw new Error(`POS shift not found: ${input.shiftId}`);
    if (!shift.isOpen()) {
      throw new Error('Cannot close a shift that is not OPEN.');
    }

    const totals = await this.cashMovementRepo.sumByShift(input.companyId, input.shiftId);
    const expectedPaymentTotals = await this.expectedPaymentTotals(input.companyId, shift.id, totals.expectedCash);
    const countedPaymentTotals = normalizePaymentTotals({ ...input.countedPaymentTotals, CASH: input.countedPaymentTotals?.CASH ?? input.countedCash });
    const overShortPaymentTotals = normalizePaymentTotals({
      CASH: countedPaymentTotals.CASH - expectedPaymentTotals.CASH,
      CARD: countedPaymentTotals.CARD - expectedPaymentTotals.CARD,
      BANK_TRANSFER: countedPaymentTotals.BANK_TRANSFER - expectedPaymentTotals.BANK_TRANSFER,
      CUSTOM: countedPaymentTotals.CUSTOM - expectedPaymentTotals.CUSTOM,
    });
    const overShort = round2(overShortPaymentTotals.CASH);
    const isFullyReconciled = Object.values(overShortPaymentTotals).every((amount) => Math.abs(amount) <= 0.005);

    let voucherId: string | undefined;

    if (overShort !== 0) {
      // Validate over/short account configuration before posting anything.
      const settings = await this.posSettingsRepo.getSettings(input.companyId);
      if (!settings) {
        throw new Error('POS settings are not configured. Open Settings before closing a shift.');
      }
      const register = await this.registerRepo.getById(input.companyId, shift.registerId);
      if (!register) {
        throw new Error(`POS register not found: ${shift.registerId}`);
      }
      if (!register.cashDrawerAccountId) {
        throw new Error('Register has no cash-drawer account configured.');
      }
      // Verify the cash-drawer account exists.
      await this.assertAccount(input.companyId, register.cashDrawerAccountId, 'cashDrawerAccountId');

      const offsetAccountId = overShort > 0 ? settings.cashOverAccountId : settings.cashShortAccountId;
      if (!offsetAccountId) {
        throw new Error(
          overShort > 0
            ? 'Configure a Cash Over account in POS Settings before closing a shift with a cash over.'
            : 'Configure a Cash Short account in POS Settings before closing a shift with a cash short.'
        );
      }
      await this.assertAccount(input.companyId, offsetAccountId, overShort > 0 ? 'cashOverAccountId' : 'cashShortAccountId');

      const amount = roundMoney(Math.abs(overShort));
      // Build voucher lines.
      // over  (counted > expected): Dr cashDrawer / Cr cashOver
      // short (counted < expected): Dr cashShort   / Cr cashDrawer
      const isOver = overShort > 0;
      const debitAccountId = isOver ? register.cashDrawerAccountId : offsetAccountId;
      const creditAccountId = isOver ? offsetAccountId : register.cashDrawerAccountId;
      const lines = [
        {
          accountId: debitAccountId,
          side: 'Debit' as const,
          amount,
          currency: '',
          exchangeRate: 1,
          baseAmount: amount,
          docAmount: amount,
          notes: `Shift ${shift.id} ${isOver ? 'cash over' : 'cash short'}`,
          metadata: {
            source: 'pos-shift-close',
            shiftId: shift.id,
            registerId: shift.registerId,
            direction: isOver ? 'OVER' : 'SHORT',
          },
        },
        {
          accountId: creditAccountId,
          side: 'Credit' as const,
          amount,
          currency: '',
          exchangeRate: 1,
          baseAmount: amount,
          docAmount: amount,
          notes: `Shift ${shift.id} ${isOver ? 'cash over' : 'cash short'}`,
          metadata: {
            source: 'pos-shift-close',
            shiftId: shift.id,
            registerId: shift.registerId,
            direction: isOver ? 'OVER' : 'SHORT',
          },
        },
      ];

      await this.transactionManager.runTransaction(async (tx) => {
        const result = await this.accountingBridge.recordFinancialEvent({
          kind: 'POS_SHIFT_OVER_SHORT',
          transaction: tx,
          subledgerVoucher: {
            companyId: input.companyId,
            voucherType: VoucherType.JOURNAL_ENTRY,
            voucherNo: `POS-SHIFT-${shift.id}`,
            date: new Date().toISOString().slice(0, 10),
            description: `POS shift ${shift.id} ${isOver ? 'cash over' : 'cash short'} (${shift.registerId})`,
            currency: '',
            exchangeRate: 1,
            lines,
            metadata: {
              sourceModule: 'pos',
              sourceType: 'POS_SHIFT',
              referenceType: 'POS_SHIFT',
              sourceId: shift.id,
              referenceId: shift.id,
              shiftId: shift.id,
              direction: isOver ? 'OVER' : 'SHORT',
              overShortAmount: overShort,
            },
            createdBy: input.actor.userId,
            postingLockPolicy: PostingLockPolicy.FLEXIBLE_LOCKED,
            reference: shift.id,
          },
        });
        voucherId = result.voucher?.id;

        // Mutate the shift in the same transaction.
        shift.status = isFullyReconciled ? 'RECONCILED' : 'CLOSED';
        shift.closedAt = new Date();
        shift.expectedCash = totals.expectedCash;
        shift.countedCash = round2(input.countedCash);
        shift.expectedPaymentTotals = expectedPaymentTotals;
        shift.countedPaymentTotals = countedPaymentTotals;
        shift.overShortPaymentTotals = overShortPaymentTotals;
        shift.overShortAmount = overShort;
        shift.overShortVoucherId = voucherId;
        if (isFullyReconciled) {
          shift.reconciledAt = new Date();
          shift.reconciledBy = input.actor.userId;
        }
        shift.updatedAt = new Date();
        await this.shiftRepo.update(shift, tx);
      });
    } else {
      // No variance — just mark the shift closed in a single transaction.
      await this.transactionManager.runTransaction(async (tx) => {
        shift.status = isFullyReconciled ? 'RECONCILED' : 'CLOSED';
        shift.closedAt = new Date();
        shift.expectedCash = totals.expectedCash;
        shift.countedCash = round2(input.countedCash);
        shift.expectedPaymentTotals = expectedPaymentTotals;
        shift.countedPaymentTotals = countedPaymentTotals;
        shift.overShortPaymentTotals = overShortPaymentTotals;
        shift.overShortAmount = 0;
        if (isFullyReconciled) {
          shift.reconciledAt = new Date();
          shift.reconciledBy = input.actor.userId;
        }
        shift.updatedAt = new Date();
        await this.shiftRepo.update(shift, tx);
      });
    }

    return {
      shift,
      totals,
      overShortAmount: overShort,
      overShortVoucherId: voucherId,
      expectedPaymentTotals,
      countedPaymentTotals,
      overShortPaymentTotals,
    };
  }

  private async expectedPaymentTotals(companyId: string, shiftId: string, expectedCash: number): Promise<PosShiftPaymentTotals> {
    const totals = normalizePaymentTotals({ CASH: expectedCash });
    if (!this.receiptRepo || !this.paymentRepo) return totals;
    const receipts = await this.receiptRepo.list(companyId, { shiftId, limit: 1000 });
    for (const receipt of receipts) {
      const payments = await this.paymentRepo.listByReceipt(companyId, receipt.id);
      for (const payment of payments) {
        if (payment.method === 'CASH') continue;
        totals[payment.method] = round2(totals[payment.method] + payment.amount);
      }
    }
    return totals;
  }

  private async assertAccount(companyId: string, accountId: string, label: string): Promise<void> {
    const acc = await this.accountRepo.getById(companyId, accountId);
    if (!acc) {
      throw new Error(`Account not found for ${label}: ${accountId}. Configure it in POS Settings / Registers before closing a shift.`);
    }
  }
}

export class ForceClosePosShiftUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly posSettingsRepo: IPosSettingsRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly accountingBridge: IAccountingBridge,
    private readonly transactionManager: ITransactionManager,
    private readonly receiptRepo?: IPosReceiptRepository,
    private readonly paymentRepo?: IPosPaymentRepository
  ) {}

  async execute(input: ClosePosShiftInput): Promise<ClosePosShiftResult> {
    // Force close reuses the same logic — countedCash is mandatory.
    const close = new ClosePosShiftUseCase(
      this.shiftRepo,
      this.posSettingsRepo,
      this.registerRepo,
      this.cashMovementRepo,
      this.accountRepo,
      this.accountingBridge,
      this.transactionManager,
      this.receiptRepo,
      this.paymentRepo
    );
    const result = await close.execute(input);
    // Flip the status to FORCE_CLOSED after the voucher + shift update.
    result.shift.status = 'FORCE_CLOSED';
    result.shift.updatedAt = new Date();
    await this.shiftRepo.update(result.shift);
    return result;
  }
}

export class ListPosShiftsUseCase {
  constructor(private readonly shiftRepo: IPosShiftRepository) {}

  async execute(
    companyId: string,
    filters?: { registerId?: string; status?: string; limit?: number }
  ): Promise<PosShift[]> {
    return this.shiftRepo.list(companyId, filters);
  }
}

export class GetPosShiftUseCase {
  constructor(private readonly shiftRepo: IPosShiftRepository) {}

  async execute(companyId: string, id: string): Promise<PosShift | null> {
    return this.shiftRepo.getById(companyId, id);
  }
}

export interface GetPosXReportInput {
  companyId: string;
  shiftId: string;
}

/**
 * X report = live snapshot of the open shift. Read-only.
 * Sales totals from P2 are filled in by the time sale use cases write
 * PosCashMovement rows of type SALE_CASH / REFUND_CASH.
 */
export class GetPosXReportUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository
  ) {}

  async execute(input: GetPosXReportInput) {
    const shift = await this.shiftRepo.getById(input.companyId, input.shiftId);
    if (!shift) throw new Error(`POS shift not found: ${input.shiftId}`);
    const totals = await this.cashMovementRepo.sumByShift(input.companyId, input.shiftId);
    return {
      shift,
      totals,
      generatedAt: new Date().toISOString(),
    };
  }
}
