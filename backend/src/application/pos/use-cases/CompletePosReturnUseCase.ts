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
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import {
  CreateSalesReturnUseCase,
  PostSalesReturnUseCase,
} from '../../../application/sales/use-cases/SalesReturnUseCases';
import { SalesReturn } from '../../../domain/sales/entities/SalesReturn';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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
  actor: { userId: string; userEmail?: string };
}

export interface CompletePosReturnResult {
  posReturn: PosReturn;
  salesReturn: SalesReturn;
  refundTotal: number;
}

/**
 * Receipt-based return:
 *   1. Resolve original receipt; assert COMPLETED + linked to a salesInvoiceId.
 *   2. Resolve the CURRENT open shift on the register (return belongs to it, not the original shift).
 *   3. Validate return qty per line ≤ sold qty.
 *   4. Call CreateSalesReturnUseCase + PostSalesReturnUseCase with `salesInvoiceId` and
 *      the returned lines. The Sales layer reverses revenue/tax, restocks inventory,
 *      reverses COGS (mode-aware).
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
    private readonly transactionManager: ITransactionManager,
    private readonly createSalesReturnUseCase: CreateSalesReturnUseCase,
    private readonly postSalesReturnUseCase: PostSalesReturnUseCase
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

    // Build the Sales-return lines (referencing the SI's line ids). The Sales use
    // case resolves the SI's lines by salesInvoiceLineId; we match by itemId+unitPrice
    // for V1 (the receipt's lines snapshot itemId+unitPrice).
    const receiptLinesByItem = new Map<string, typeof originalReceipt.lines[number]>();
    for (const l of originalReceipt.lines) {
      // Use the first line for each item as the matching key.
      if (!receiptLinesByItem.has(l.itemId)) {
        receiptLinesByItem.set(l.itemId, l);
      }
    }

    const salesReturnLines = input.lines.map((l) => {
      const snap = receiptLinesByItem.get(l.itemId);
      if (!snap) throw new Error(`No matching receipt line for item ${l.itemId}.`);
      return {
        salesInvoiceLineId: snap.salesInvoiceLineId,
        itemId: l.itemId,
        returnedQty: l.qty,
        unitPriceDoc: snap.unitPrice,
        discountType: undefined as any,
        discountValue: undefined as any,
        taxCodeId: snap.taxCodeId,
      };
    });

    // Create the sales return.
    const salesReturn: SalesReturn = await this.createSalesReturnUseCase.execute(
      {
        companyId: input.companyId,
        salesInvoiceId: originalReceipt.salesInvoiceId,
        returnDate: new Date().toISOString().slice(0, 10),
        currency: 'USD',
        exchangeRate: 1,
        createdBy: input.actor.userId,
        lines: salesReturnLines,
      } as any,
      { userId: input.actor.userId, userEmail: input.actor.userEmail }
    );

    // Post the sales return (reverses revenue/tax, restocks, reverses COGS).
    const postedReturn: SalesReturn = await this.postSalesReturnUseCase.execute(
      input.companyId,
      salesReturn.id,
      true,
      undefined,
      { userId: input.actor.userId, userEmail: input.actor.userEmail }
    );

    // Compute refund total (sum of returned lines × unit price − line discount).
    const refundTotal = round2(
      input.lines.reduce((s, l) => {
        const snap = receiptLinesByItem.get(l.itemId);
        return s + (snap ? snap.unitPrice * l.qty - (snap.lineDiscount * (l.qty / Math.max(1, snap.qty))) : 0);
      }, 0)
    );

    const returnLines: PosReturnLine[] = input.lines.map((l) => {
      const snap = receiptLinesByItem.get(l.itemId);
      const lineTotal = snap ? round2(snap.unitPrice * l.qty - (snap.lineDiscount * (l.qty / Math.max(1, snap.qty)))) : 0;
      return {
        itemId: l.itemId,
        qty: l.qty,
        unitPrice: snap?.unitPrice || 0,
        lineTotal,
        originalLineId: snap?.salesInvoiceLineId,
      };
    });

    const posReturn = new PosReturn({
      id: `ret_${randomUUID()}`,
      companyId: input.companyId,
      shiftId: openShift.id,
      registerId: input.registerId,
      returnNumber: postedReturn.returnNumber || `RET-${postedReturn.id}`,
      originalReceiptId: originalReceipt.id,
      originalReceiptNumber: originalReceipt.receiptNumber,
      salesInvoiceId: originalReceipt.salesInvoiceId,
      lines: returnLines,
      refundMethod: input.refundMethod,
      refundTotal,
      salesReturnId: postedReturn.id,
      salesReturnNumber: postedReturn.returnNumber,
      createdBy: input.actor.userId,
      createdAt: new Date(),
    });

    // REFUND_CASH movement when refunding by cash.
    const refundMovement =
      input.refundMethod === 'CASH' && refundTotal > 0
        ? new PosCashMovement({
            id: `cm_${randomUUID()}`,
            companyId: input.companyId,
            shiftId: openShift.id,
            registerId: input.registerId,
            type: 'REFUND_CASH',
            amount: refundTotal,
            createdBy: input.actor.userId,
            createdAt: posReturn.createdAt,
          })
        : null;

    await this.transactionManager.runTransaction(async (tx) => {
      await this.returnRepo.create(posReturn, tx);
      if (refundMovement) {
        await this.cashMovementRepo.create(refundMovement, tx);
      }
    });

    void PosReceipt; void PosShift; void this.settingsRepo; // silence unused-import warnings for V1

    return { posReturn, salesReturn: postedReturn, refundTotal };
  }
}
