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
  actor: { userId: string; userEmail?: string };
}

export interface CompletePosReturnResult {
  posReturn: PosReturn;
  salesReturn: { id: string; returnNumber: string };
  refundTotal: number;
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
    private readonly postPosReturnUseCase: PostPosReturnUseCase
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

    // Validate return qty ≤ sold qty per line.
    const soldByItem = new Map<string, number>();
    for (const l of originalReceipt.lines) {
      soldByItem.set(l.itemId, (soldByItem.get(l.itemId) || 0) + l.qty);
    }
    const requestedByItem = new Map<string, number>();
    for (const l of input.lines) {
      requestedByItem.set(l.itemId, (requestedByItem.get(l.itemId) || 0) + l.qty);
    }
    for (const [itemId, qty] of requestedByItem) {
      const sold = soldByItem.get(itemId);
      if (!sold || qty > sold) {
        throw new Error(
          `Return qty ${qty} for item ${itemId} exceeds sold qty ${sold || 0}.`
        );
      }
    }

    const receiptLinesByItem = new Map<string, typeof originalReceipt.lines[number]>();
    for (const l of originalReceipt.lines) {
      // Use the first line for each item as the matching key.
      if (!receiptLinesByItem.has(l.itemId)) {
        receiptLinesByItem.set(l.itemId, l);
      }
    }

    const register = await this.registerRepo.getById(input.companyId, input.registerId);
    if (!register) throw new Error(`POS register not found: ${input.registerId}`);
    const settings = await this.settingsRepo.getSettings(input.companyId);
    const refundSettlementAccountId = settings?.getPaymentMethod(input.refundMethod as any)?.settlementAccountId;
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
      return { posReturn, postedReturn };
    });

    void PosReceipt; void PosShift; void input.reason; void input.actor.userEmail;

    return {
      posReturn,
      salesReturn: { id: postedReturn.returnId, returnNumber: postedReturn.returnNumber },
      refundTotal: postedReturn.refundTotal,
    };
  }
}
