import { roundMoney } from '../../system-core/money/roundMoney';
import { randomUUID } from 'crypto';
import { PosReturn, PosReturnLine, PosReturnRefundMethod } from '../../../domain/pos/entities/PosReturn';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosCashMovement } from '../../../domain/pos/entities/PosCashMovement';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';
import { IPosReturnRepository } from '../../../repository/interfaces/pos/IPosReturnRepository';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IPosCashMovementRepository } from '../../../repository/interfaces/pos/IPosCashMovementRepository';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { PostPosReturnUseCase } from './PostPosReturnUseCase';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';
import { IPolicyEngine } from '../../system-core/contracts/IPolicyEngine';


export interface PosReturnLineInput {
  itemId: string;
  qty: number;
}

export interface CompletePosReturnInput {
  companyId: string;
  originalReceiptId: string;
  registerId: string;
  /** Optional: the current open shift on this register. If omitted, we resolve from the open shift. */
  shiftId?: string;
  lines: PosReturnLineInput[];
  refundMethod: PosReturnRefundMethod;
  /** Optional reason for the return; defaults to a generic POS reason (Sales requires one). */
  reason?: string;
  managerOverrideId?: string;
  voidOriginalReceipt?: boolean;
  exchangeId?: string;
  actor: { userId: string; userEmail?: string; roleId?: string };
}

export interface CompletePosReturnResult {
  posReturn: PosReturn;
  salesReturn: { id: string; returnNumber: string };
  refundTotal: number;
}

export interface VoidPosReceiptInput {
  companyId: string;
  receiptId: string;
  registerId: string;
  shiftId?: string;
  refundMethod: PosReturnRefundMethod;
  reason?: string;
  managerOverrideId?: string;
  actor: { userId: string; userEmail?: string; roleId?: string };
}

/**
 * Receipt-based return:
 *   1. Resolve original receipt; assert COMPLETED + linked to a salesInvoiceId.
 *   2. Resolve the CURRENT open shift on the register (return belongs to it, not the original shift).
 *   3. Validate return qty per line ≤ sold qty.
 *   4. Post through POS-owned PostPosReturnUseCase, which calls System Core
 *      inventory/accounting seams to restock and reverse financial effects.
 *   5. Persist the PosReturn + a PosCashMovement of type REFUND_CASH (when refundMethod === 'CASH').
 *   6. Return the link.
 */
export class CompletePosReturnUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly returnRepo: IPosReturnRepository,
    private readonly shiftRepo: IPosShiftRepository,
    private readonly settingsRepo: IPosSettingsRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly postPosReturnUseCase: PostPosReturnUseCase,
    private readonly policyEngine?: IPolicyEngine,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(input: CompletePosReturnInput): Promise<CompletePosReturnResult> {
    if (!input.lines?.length) throw new Error('At least one line is required for a return.');

    const originalReceipt = await this.receiptRepo.getById(input.companyId, input.originalReceiptId);
    if (!originalReceipt) throw new Error(`Receipt not found: ${input.originalReceiptId}`);
    if (originalReceipt.status !== 'COMPLETED') {
      throw new Error('Only COMPLETED receipts can be returned.');
    }
    if (!originalReceipt.salesInvoiceId) {
      throw new Error('Original receipt has no linked Sales Invoice; cannot return.');
    }

    // Resolve the CURRENT open shift on this register.
    const openShift = input.shiftId
      ? await this.shiftRepo.getById(input.companyId, input.shiftId)
      : await this.shiftRepo.getOpenShiftForRegister(input.companyId, input.registerId);
    if (!openShift) throw new Error(`No open shift for register ${input.registerId}.`);
    if (!openShift.isOpen()) {
      throw new Error('The current shift on this register is closed. Returns attach to an OPEN shift.');
    }
    if (openShift.registerId !== input.registerId) {
      throw new Error('The current shift is on a different register.');
    }

    if (this.policyEngine) {
      const decision = await this.policyEngine.resolve({
        scope: 'pos',
        action: 'managerOverride',
        companyId: input.companyId,
        context: {
          overrideAction: 'RETURN',
          registerId: input.registerId,
          cashierUserId: input.actor.userId,
          cashierRoleId: input.actor.roleId,
          approvedOverrideId: input.managerOverrideId,
          payload: {
            originalReceiptId: input.originalReceiptId,
            lineCount: input.lines.length,
            refundMethod: input.refundMethod,
          },
        },
      });
      if (!decision.allowed) {
        throw new Error('Manager approval is required for POS return.');
      }
    }

    // Validate return qty ≤ sold qty per line.
    const soldByItem = new Map<string, number>();
    for (const l of originalReceipt.lines.filter((line) => line.status !== 'VOIDED')) {
      soldByItem.set(l.itemId, (soldByItem.get(l.itemId) || 0) + l.qty);
    }
    const requestedByItem = new Map<string, number>();
    for (const l of input.lines) {
      requestedByItem.set(l.itemId, (requestedByItem.get(l.itemId) || 0) + l.qty);
    }
    const previousReturns = await this.returnRepo.list(input.companyId, {
      originalReceiptId: input.originalReceiptId,
      limit: 1000,
    });
    const previouslyReturnedByItem = new Map<string, number>();
    for (const returnDoc of previousReturns) {
      for (const line of returnDoc.lines) {
        previouslyReturnedByItem.set(line.itemId, (previouslyReturnedByItem.get(line.itemId) || 0) + line.qty);
      }
    }
    for (const [itemId, qty] of requestedByItem) {
      const sold = soldByItem.get(itemId);
      const alreadyReturned = previouslyReturnedByItem.get(itemId) || 0;
      const remaining = Math.max(0, (sold || 0) - alreadyReturned);
      if (!sold || qty > remaining) {
        throw new Error(
          `Return qty ${qty} for item ${itemId} exceeds remaining returnable qty ${remaining}.`
        );
      }
    }

    const receiptLinesByItem = new Map<string, typeof originalReceipt.lines[number]>();
    for (const l of originalReceipt.lines.filter((line) => line.status !== 'VOIDED')) {
      // Use the first line for each item as the matching key.
      if (!receiptLinesByItem.has(l.itemId)) {
        receiptLinesByItem.set(l.itemId, l);
      }
    }

    const register = await this.registerRepo.getById(input.companyId, input.registerId);
    if (!register) throw new Error(`POS register not found: ${input.registerId}`);
    const settings = await this.settingsRepo.getSettings(input.companyId);
    const refundConfig = settings?.getPaymentMethod(input.refundMethod as any);
    if (!refundConfig || !refundConfig.isEnabled) {
      throw new Error(`Refund method ${input.refundMethod} is not enabled.`);
    }
    const refundSettlementAccountId = input.refundMethod === 'CASH'
      ? register.cashDrawerAccountId
      : register.settlementAccountIds?.[input.refundMethod];
    if (!refundSettlementAccountId) {
      throw new Error(`Configure ${input.refundMethod} settlement account on POS register ${register.code || register.id}.`);
    }
    const returnNumber = `RET-${new Date().getTime()}`;

    const returnLines: PosReturnLine[] = input.lines.map((l) => {
      const snap = receiptLinesByItem.get(l.itemId);
      const lineTotal = snap ? roundMoney(snap.unitPrice * l.qty - (snap.lineDiscount * (l.qty / Math.max(1, snap.qty)))) : 0;
      return {
        itemId: l.itemId,
        qty: l.qty,
        unitPrice: snap?.unitPrice || 0,
        lineTotal,
        originalLineId: snap?.salesInvoiceLineId,
      };
    });

    const { posReturn, postedReturn } = await this.transactionManager.runTransaction(async (tx) => {
      const postedReturn = await this.postPosReturnUseCase.execute({
        companyId: input.companyId,
        originalReceipt,
        returnNumber,
        registerId: input.registerId,
        warehouseId: register.warehouseId,
        date: new Date().toISOString().slice(0, 10),
        lines: input.lines,
        refundMethod: input.refundMethod,
        settlementAccountId: refundSettlementAccountId,
        createdBy: input.actor.userId,
        transaction: tx,
      });

      const posReturn = new PosReturn({
        id: postedReturn.returnId,
        companyId: input.companyId,
        shiftId: openShift.id,
        registerId: input.registerId,
        returnNumber: postedReturn.returnNumber,
        originalReceiptId: originalReceipt.id,
        originalReceiptNumber: originalReceipt.receiptNumber,
        salesInvoiceId: originalReceipt.salesInvoiceId,
        lines: returnLines,
        refundMethod: input.refundMethod,
        refundTotal: postedReturn.refundTotal,
        salesReturnId: postedReturn.returnId,
        salesReturnNumber: postedReturn.returnNumber,
        exchangeId: input.exchangeId,
        createdBy: input.actor.userId,
        createdAt: new Date(),
      });

      const refundMovement =
        input.refundMethod === 'CASH' && postedReturn.refundTotal > 0
          ? new PosCashMovement({
              id: `cm_${randomUUID()}`,
              companyId: input.companyId,
              shiftId: openShift.id,
              registerId: input.registerId,
              type: 'REFUND_CASH',
              amount: postedReturn.refundTotal,
              createdBy: input.actor.userId,
              createdAt: posReturn.createdAt,
            })
          : null;

      await this.returnRepo.create(posReturn, tx);
      if (refundMovement) {
        await this.cashMovementRepo.create(refundMovement, tx);
      }
      if (input.voidOriginalReceipt) {
        await this.receiptRepo.updateStatus(input.companyId, originalReceipt.id, 'VOIDED', tx);
        originalReceipt.status = 'VOIDED';
      }
      return { posReturn, postedReturn };
    });

    if (this.auditEngine) {
      await this.auditEngine.record({
        companyId: input.companyId,
        entity: { type: 'POS_RETURN', id: posReturn.id, number: posReturn.returnNumber },
        action: 'CREATE',
        actor: { userId: input.actor.userId, userEmail: input.actor.userEmail },
        reason: input.reason,
        after: {
          ...posReturn.toJSON(),
          originalReceiptNumber: originalReceipt.receiptNumber,
          postedReturnId: postedReturn.returnId,
          postedReturnNumber: postedReturn.returnNumber,
          voucherIds: postedReturn.voucherIds,
          originalReceiptVoided: input.voidOriginalReceipt === true,
        },
      });
    }

    void PosReceipt; void PosShift;

    return {
      posReturn,
      salesReturn: { id: postedReturn.returnId, returnNumber: postedReturn.returnNumber },
      refundTotal: postedReturn.refundTotal,
    };
  }
}

export class VoidPosReceiptUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly returnRepo: IPosReturnRepository,
    private readonly completeReturnUseCase: CompletePosReturnUseCase
  ) {}

  async execute(input: VoidPosReceiptInput): Promise<CompletePosReturnResult> {
    const receipt = await this.receiptRepo.getById(input.companyId, input.receiptId);
    if (!receipt) throw new Error(`Receipt not found: ${input.receiptId}`);
    if (receipt.status !== 'COMPLETED') {
      throw new Error('Only COMPLETED receipts can be voided.');
    }

    const soldByItem = new Map<string, number>();
    for (const line of receipt.lines.filter((l) => l.status !== 'VOIDED')) {
      soldByItem.set(line.itemId, (soldByItem.get(line.itemId) || 0) + line.qty);
    }
    const previousReturns = await this.returnRepo.list(input.companyId, {
      originalReceiptId: input.receiptId,
      limit: 1000,
    });
    for (const returnDoc of previousReturns) {
      for (const line of returnDoc.lines) {
        soldByItem.set(line.itemId, Math.max(0, (soldByItem.get(line.itemId) || 0) - line.qty));
      }
    }

    const lines = Array.from(soldByItem.entries())
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
    if (lines.length === 0) {
      throw new Error('Receipt has no remaining returnable quantity to void.');
    }

    return this.completeReturnUseCase.execute({
      companyId: input.companyId,
      originalReceiptId: input.receiptId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      lines,
      refundMethod: input.refundMethod,
      reason: input.reason || 'POS receipt void',
      managerOverrideId: input.managerOverrideId,
      voidOriginalReceipt: true,
      actor: input.actor,
    });
  }
}
