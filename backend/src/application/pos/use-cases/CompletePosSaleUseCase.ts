import { randomUUID } from 'crypto';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosReceipt, PosReceiptLineSnapshot } from '../../../domain/pos/entities/PosReceipt';
import { PosPayment, PosPaymentMethod } from '../../../domain/pos/entities/PosPayment';
import { PosCashMovement } from '../../../domain/pos/entities/PosCashMovement';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IPosSettingsRepository } from '../../../repository/interfaces/pos/IPosSettingsRepository';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';
import { IPosPaymentRepository } from '../../../repository/interfaces/pos/IPosPaymentRepository';
import { IPosCashMovementRepository } from '../../../repository/interfaces/pos/IPosCashMovementRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { IPolicyEngine } from '../../system-core/contracts/IPolicyEngine';
import { PostPosSaleUseCase } from './PostPosSaleUseCase';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PosCartLine {
  itemId: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
}

export interface PosCartPayment {
  method: PosPaymentMethod;
  amount: number; // TENDERED amount (cash given). CASH change is returned to customer.
  changeGiven?: number; // reserved for explicit-input; V1 computes it automatically.
  reference?: string;
}

export interface CompletePosSaleInput {
  companyId: string;
  registerId: string;
  shiftId: string;
  customerId?: string;
  lines: PosCartLine[];
  payments: PosCartPayment[];
  actor: { userId: string; userEmail?: string; roleId?: string };
}

export interface CompletePosSaleResult {
  receipt: PosReceipt;
  salesInvoiceId: string;
  salesInvoiceNumber: string;
  change: number;
}

/**
 * Complete a POS sale.
 *
 * This use case validates the POS operational flow and delegates posting to
 * the POS-owned PostPosSaleUseCase, which talks to System Core seams
 * (IInventoryCore + IAccountingBridge). POS sale completion does not construct
 * Sales application use-cases.
 *
 * Sequencing:
 *   1. Validate shift OPEN + cashier match (or manager)
 *   2. Validate cart math (lines non-empty, payments non-empty, applied total = grand total)
 *   3. Validate payment-method config (each enabled method has an account, each `requiresReference` carries one)
 *   4. Compute receipt number and post the sale through POS-owned posting.
 *   5. Persist PosReceipt + PosPayment rows + cash movement atomically.
 *   6. Bump settings.receiptNextSeq.
 */
export class CompletePosSaleUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly settingsRepo: IPosSettingsRepository,
    private readonly registerRepo: IPosRegisterRepository,
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly paymentRepo: IPosPaymentRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly postPosSaleUseCase: PostPosSaleUseCase,
    private readonly policyEngine: IPolicyEngine
  ) {}

  async execute(input: CompletePosSaleInput): Promise<CompletePosSaleResult> {
    if (!input.lines?.length) {
      throw new Error('Cart must have at least one line.');
    }
    if (!input.payments?.length) {
      throw new Error('At least one payment is required.');
    }

    const shift = await this.shiftRepo.getById(input.companyId, input.shiftId);
    if (!shift) throw new Error(`POS shift not found: ${input.shiftId}`);
    if (shift.registerId !== input.registerId) {
      throw new Error('Shift does not belong to the given register.');
    }
    const settings = await this.settingsRepo.getSettings(input.companyId);
    if (!settings) {
      throw new Error('POS settings are not configured. Open Settings before completing a sale.');
    }
    if (settings.requireOpenShift && !shift.isOpen()) {
      throw new Error('No open shift for this register.');
    }
    if (shift.cashierUserId !== input.actor.userId) {
      // For V1 we just enforce that the cashier acts on their own shift.
      // Force-close / manager override is out of scope.
      throw new Error('Cashier can only operate their own shift.');
    }

    const customerId = input.customerId || settings.walkInCustomerId;
    if (!customerId) {
      throw new Error('No customer on the receipt and no walk-in customer is configured.');
    }

    const register = await this.registerRepo.getById(input.companyId, input.registerId);
    if (!register) {
      throw new Error(`POS register not found: ${input.registerId}`);
    }

    const policyDecision = await this.policyEngine.resolve({
      scope: 'pos',
      action: 'directSale',
      companyId: input.companyId,
      context: {
        registerId: input.registerId,
        cashierUserId: input.actor.userId,
        cashierRoleId: input.actor.roleId,
        documentPersona: 'POS_DIRECT_SALE',
      },
    });
    if (!policyDecision.allowed) {
      throw new Error('POS direct sale is not allowed by POS policy.');
    }
    // Validate payment-method config up front (independent of the total).
    for (const p of input.payments) {
      if (p.amount <= 0) {
        throw new Error(`Payment amount must be positive.`);
      }
      if (p.method !== 'CASH' && p.changeGiven && p.changeGiven > 0) {
        throw new Error(`Only CASH may give change; ${p.method} cannot.`);
      }
      const cfg = settings.getPaymentMethod(p.method);
      if (!cfg || !cfg.isEnabled) {
        throw new Error(`Payment method ${p.method} is not enabled.`);
      }
      if (cfg.requiresReference && !p.reference?.trim()) {
        throw new Error(`Payment method ${p.method} requires a reference.`);
      }
    }

    // Preview the total through the POS posting path before opening the write transaction.
    // The same use-case will re-use these inputs for the actual stock/ledger write.
    const receiptNumber = settings.receiptPrefix + '-' + String(settings.receiptNextSeq).padStart(6, '0');
    const saleDate = new Date().toISOString().slice(0, 10);

    const preview = await this.postPosSaleUseCase.execute({
      companyId: input.companyId,
      customerId,
      documentNumber: receiptNumber,
      date: saleDate,
      lines: input.lines.map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountType: l.discountType,
        discountValue: l.discountValue,
        taxCodeId: l.taxCodeId,
        warehouseId: register.warehouseId,
      })),
      payments: [],
      paymentMethods: settings.paymentMethods,
      createdBy: input.actor.userId,
      dryRun: true,
    });

    const grandTotal = round2(preview.grandTotal);
    const cashTendered = round2(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0)
    );
    const cashChange = round2(Math.max(0, cashTendered - grandTotal));
    const appliedTotal = round2(
      input.payments.reduce((s, p) => s + p.amount, 0) - cashChange
    );
    if (Math.abs(appliedTotal - grandTotal) > 0.005) {
      throw new Error(
        `Payment total (${appliedTotal.toFixed(2)}) must equal the POS sale grand total ` +
        `incl. tax (${grandTotal.toFixed(2)}). Cash change of ${cashChange.toFixed(2)} is allowed.`
      );
    }

    const appliedPayments = input.payments.map((p) => ({
      method: p.method,
      amount: p.method === 'CASH' ? round2(p.amount - cashChange) : round2(p.amount),
      reference: p.reference,
    }));

    const cashApplied = round2(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) - cashChange
    );

    const { postedSale, receipt } = await this.transactionManager.runTransaction(async (tx) => {
      const sale = await this.postPosSaleUseCase.execute({
        companyId: input.companyId,
        customerId,
        documentId: preview.documentId,
        documentNumber: receiptNumber,
        date: saleDate,
        lines: input.lines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxCodeId: l.taxCodeId,
          warehouseId: register.warehouseId,
        })),
        payments: appliedPayments,
        paymentMethods: settings.paymentMethods,
        createdBy: input.actor.userId,
        transaction: tx,
      });

      const receiptLines: PosReceiptLineSnapshot[] = sale.lines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        itemName: l.itemName,
        qty: l.qty,
        uom: l.uom,
        unitPrice: l.unitPrice,
        lineDiscount: round2(l.lineDiscount ?? 0),
        taxCodeId: l.taxCodeId,
        lineTotal: round2(l.lineTotal),
        salesInvoiceLineId: l.lineId, // legacy field name; 250d2 removes Sales return dependency.
        revenueAccountId: l.revenueAccountId,
        taxAccountId: l.taxAccountId,
        cogsAccountId: l.cogsAccountId,
        inventoryAccountId: l.inventoryAccountId,
        unitCostBase: l.unitCostBase,
        lineCostBase: l.lineCostBase,
      }));
      const discountTotal = round2(receiptLines.reduce((s, l) => s + l.lineDiscount, 0));

      const receipt = new PosReceipt({
        id: `rcp_${randomUUID()}`,
        companyId: input.companyId,
        shiftId: input.shiftId,
        registerId: input.registerId,
        receiptNumber,
        status: 'COMPLETED',
        customerId,
        customerName: sale.customerName,
        lines: receiptLines,
        subtotal: round2(sale.subtotal),
        discountTotal,
        taxTotal: round2(sale.taxTotal),
        grandTotal: round2(sale.grandTotal),
        salesInvoiceId: sale.documentId,
        salesInvoiceNumber: sale.documentNumber,
        createdBy: input.actor.userId,
        createdAt: new Date(),
      });

      const payments: PosPayment[] = input.payments.map((p) =>
        new PosPayment({
          id: `pmt_${randomUUID()}`,
          companyId: input.companyId,
          receiptId: receipt.id,
          method: p.method,
          amount: round2(p.amount),
          changeGiven: p.method === 'CASH' ? cashChange : 0,
          reference: p.reference,
          createdAt: receipt.createdAt,
        })
      );

      const cashMovement =
        cashApplied > 0
          ? new PosCashMovement({
              id: `cm_${randomUUID()}`,
              companyId: input.companyId,
              shiftId: input.shiftId,
              registerId: input.registerId,
              type: 'SALE_CASH',
              amount: cashApplied,
              createdBy: input.actor.userId,
              createdAt: receipt.createdAt,
            })
          : null;

      await this.receiptRepo.create(receipt, tx);
      for (const pmt of payments) {
        await this.paymentRepo.create(pmt, tx);
      }
      if (cashMovement) {
        await this.cashMovementRepo.create(cashMovement, tx);
      }
      settings.receiptNextSeq += 1;
      await this.settingsRepo.saveSettings(settings, tx);

      return { postedSale: sale, receipt };
    });

    return {
      receipt,
      salesInvoiceId: postedSale.documentId,
      salesInvoiceNumber: postedSale.documentNumber,
      change: cashChange,
    };
  }
}
