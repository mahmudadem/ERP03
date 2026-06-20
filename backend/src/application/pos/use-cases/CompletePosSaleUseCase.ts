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
import { CreateAndPostSalesInvoiceUseCase } from '../../sales/use-cases/SalesInvoiceUseCases';
import { SalesInvoice } from '../../../domain/sales/entities/SalesInvoice';

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
  actor: { userId: string; userEmail?: string };
}

export interface CompletePosSaleResult {
  receipt: PosReceipt;
  salesInvoiceId: string;
  salesInvoiceNumber: string;
  change: number;
}

const POS_METHOD_TO_SI_METHOD: Record<PosPaymentMethod, 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER'> = {
  CASH: 'CASH',
  CARD: 'CREDIT_CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CUSTOM: 'OTHER',
};

/**
 * Complete a POS sale.
 *
 * This use case does NOT build vouchers, write stock movements, or compute
 * tax. It delegates the financial posting to the existing Sales use case
 * `CreateAndPostSalesInvoiceUseCase`, passing `persona:'direct'`,
 * `source:'pos'`, `formType:'pos_sale'`. If the company has not allowed the
 * `direct` persona (the Allow POS direct sales toggle), Sales will throw
 * `PersonaNotAllowedError` and we surface it.
 *
 * Sequencing:
 *   1. Validate shift OPEN + cashier match (or manager)
 *   2. Validate cart math (lines non-empty, payments non-empty, applied total = grand total)
 *   3. Validate payment-method config (each enabled method has an account, each `requiresReference` carries one)
 *   4. Build the SI input from the cart (lines include `warehouseId: register.warehouseId`)
 *   5. Build the SettlementInput from the payments. Use CASH_FULL for single-tender exact
 *      amount; MULTI for everything else. CASH change is netted off the settlement so the
 *      settlement total equals the receipt grand total.
 *   6. Call `createAndPostSalesInvoiceUseCase.execute(input, settlementInput, undefined, actor)`.
 *      This is where the existing SI post + voucher + COGS + inventory OUT + receipt vouchers happen.
 *   7. After SI is posted, persist the PosReceipt + PosPayment rows in one transaction (so the
 *      receipt numbers + cash-movement roll back if anything blows up).
 *   8. Bump settings.receiptNextSeq.
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
    private readonly createAndPostSalesInvoiceUseCase: CreateAndPostSalesInvoiceUseCase
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

    // Compute cart totals.
    const lines: PosReceiptLineSnapshot[] = input.lines.map((l) => {
      const lineGross = l.qty * l.unitPrice;
      let lineDiscount = 0;
      if (l.discountType === 'PERCENT' && l.discountValue) {
        lineDiscount = round2((lineGross * l.discountValue) / 100);
      } else if (l.discountType === 'AMOUNT' && l.discountValue) {
        lineDiscount = round2(l.discountValue);
      }
      return {
        itemId: l.itemId,
        itemCode: '',
        itemName: '',
        qty: l.qty,
        uom: '',
        unitPrice: l.unitPrice,
        lineDiscount,
        taxCodeId: l.taxCodeId,
        lineTotal: round2(lineGross - lineDiscount),
      };
    });
    const subtotal = round2(lines.reduce((s, l) => s + (l.qty * l.unitPrice), 0));
    const discountTotal = round2(lines.reduce((s, l) => s + l.lineDiscount, 0));

    // Validate payment methods.
    const cashTendered = round2(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0)
    );
    const cashChange = round2(Math.max(0, cashTendered - (subtotal - discountTotal)));
    const appliedTotal = round2(
      input.payments.reduce((s, p) => s + p.amount, 0) - cashChange
    );
    const grandTotal = round2(subtotal - discountTotal);
    if (Math.abs(appliedTotal - grandTotal) > 0.005) {
      throw new Error(
        `Payment total (${appliedTotal}) must equal the receipt grand total (${grandTotal}). ` +
        `Cash change of ${cashChange} is allowed.`
      );
    }
    for (const p of input.payments) {
      if (p.method !== 'CASH' && p.changeGiven && p.changeGiven > 0) {
        throw new Error(`Only CASH may give change; ${p.method} cannot.`);
      }
      if (p.amount <= 0) {
        throw new Error(`Payment amount must be positive.`);
      }
      const cfg = settings.getPaymentMethod(p.method);
      if (!cfg || !cfg.isEnabled) {
        throw new Error(`Payment method ${p.method} is not enabled.`);
      }
      if (cfg.requiresReference && !p.reference?.trim()) {
        throw new Error(`Payment method ${p.method} requires a reference.`);
      }
    }

    // Build SI input (let Sales do all financial math).
    const salesInvoiceInput = {
      companyId: input.companyId,
      customerId,
      invoiceDate: new Date().toISOString().slice(0, 10),
      source: 'pos' as const,
      formType: 'pos_sale' as const,
      persona: 'direct' as const,
      createdBy: input.actor.userId,
      lines: input.lines.map((l) => ({
        itemId: l.itemId,
        invoicedQty: l.qty,
        unitPriceDoc: l.unitPrice,
        discountType: l.discountType,
        discountValue: l.discountValue,
        taxCodeId: l.taxCodeId,
        warehouseId: register.warehouseId,
      })),
    };

    // Build SettlementInput.
    const singleTenderExact =
      input.payments.length === 1 &&
      round2(input.payments[0].amount) === grandTotal &&
      input.payments[0].method === 'CASH' &&
      cashChange === 0;
    const settlementInput = singleTenderExact
      ? {
          settlementMode: 'CASH_FULL' as const,
          settlements: [
            {
              paymentMethod: POS_METHOD_TO_SI_METHOD[input.payments[0].method],
              amountBase: grandTotal,
              reference: input.payments[0].reference,
            },
          ],
        }
      : {
          settlementMode: 'MULTI' as const,
          settlements: input.payments.map((p) => {
            const applied = p.method === 'CASH' ? round2(p.amount - cashChange) : round2(p.amount);
            return {
              paymentMethod: POS_METHOD_TO_SI_METHOD[p.method],
              amountBase: applied,
              reference: p.reference,
            };
          }),
        };

    // Post SI. Errors (PersonaNotAllowedError, UnsettledCostError, ...) propagate.
    const salesInvoice: SalesInvoice = await this.createAndPostSalesInvoiceUseCase.execute(
      salesInvoiceInput as any,
      settlementInput as any,
      undefined,
      { userId: input.actor.userId, userEmail: input.actor.userEmail }
    );

    // Persist POS-side artifacts.
    const receiptNumber = settings.receiptPrefix + '-' + String(settings.receiptNextSeq).padStart(6, '0');
    settings.receiptNextSeq += 1;

    const receipt = new PosReceipt({
      id: `rcp_${randomUUID()}`,
      companyId: input.companyId,
      shiftId: input.shiftId,
      registerId: input.registerId,
      receiptNumber,
      status: 'COMPLETED',
      customerId,
      customerName: undefined,
      lines,
      subtotal,
      discountTotal,
      taxTotal: 0, // Sales owns the tax math; we don't recompute it here.
      grandTotal,
      salesInvoiceId: salesInvoice.id,
      salesInvoiceNumber: salesInvoice.invoiceNumber,
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

    // Cash movement: SALE_CASH = cash applied (gross of change).
    const cashApplied = round2(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) - cashChange
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

    await this.transactionManager.runTransaction(async (tx) => {
      await this.receiptRepo.create(receipt, tx);
      for (const pmt of payments) {
        await this.paymentRepo.create(pmt, tx);
      }
      if (cashMovement) {
        await this.cashMovementRepo.create(cashMovement, tx);
      }
      await this.settingsRepo.saveSettings(settings, tx);
    });

    return {
      receipt,
      salesInvoiceId: salesInvoice.id,
      salesInvoiceNumber: salesInvoice.invoiceNumber,
      change: cashChange,
    };
  }
}
