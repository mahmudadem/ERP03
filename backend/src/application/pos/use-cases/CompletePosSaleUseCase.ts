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
import { CreateSalesInvoiceUseCase, PostSalesInvoiceUseCase, SettlementInput } from '../../sales/use-cases/SalesInvoiceUseCases';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
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
 * with documentPersona POS_DIRECT_SALE, source pos, and formType pos_sale.
 * Until 250d replaces the Sales entry point, the Sales compatibility persona
 * remains direct; the Document Core persona is the durable POS identity carried
 * into posting metadata.
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
    private readonly createSalesInvoiceUseCase: CreateSalesInvoiceUseCase,
    private readonly postSalesInvoiceUseCase: PostSalesInvoiceUseCase,
    private readonly salesInvoiceRepo: ISalesInvoiceRepository
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

    // Build SI input. The Sales module owns ALL financial math — tax (inclusive/exclusive),
    // discounts, COGS, inventory OUT. POS never recomputes the total or the tax.
    const salesInvoiceInput = {
      companyId: input.companyId,
      customerId,
      invoiceDate: new Date().toISOString().slice(0, 10),
      source: 'pos' as const,
      voucherType: 'sales_invoice' as const,
      formType: 'pos_sale' as const,
      persona: 'direct' as const,
      documentPersona: 'POS_DIRECT_SALE' as const,
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

    // Step 1 — create the SI as DRAFT so we can read its AUTHORITATIVE, tax-inclusive
    // grand total before collecting/settling payment.
    const { salesInvoice: draft } = await this.createSalesInvoiceUseCase.execute(
      salesInvoiceInput as any,
      undefined,
      { userId: input.actor.userId, userEmail: input.actor.userEmail }
    );

    // Step 2 — validate the tendered payment against the SI grand total (incl. tax).
    const grandTotal = round2(draft.grandTotalBase);
    const cashTendered = round2(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0)
    );
    const cashChange = round2(Math.max(0, cashTendered - grandTotal));
    const appliedTotal = round2(
      input.payments.reduce((s, p) => s + p.amount, 0) - cashChange
    );
    if (Math.abs(appliedTotal - grandTotal) > 0.005) {
      // No orphan: discard the draft we just created before failing.
      await this.salesInvoiceRepo.delete(input.companyId, draft.id);
      throw new Error(
        `Payment total (${appliedTotal.toFixed(2)}) must equal the invoice grand total ` +
        `incl. tax (${grandTotal.toFixed(2)}). Cash change of ${cashChange.toFixed(2)} is allowed.`
      );
    }

    // Step 3 — build the settlement from the authoritative total. CASH_FULL only for a
    // single tender that exactly equals the total with no change; MULTI otherwise.
    // The POS-configured account for a method (PosSettings.paymentMethods) is authoritative for
    // the GL settlement; if blank, Sales falls back to SalesSettings.paymentMethodConfigs.
    const accountFor = (method: PosPaymentMethod): string | undefined =>
      settings.getPaymentMethod(method)?.settlementAccountId?.trim() || undefined;

    const singleTenderExact =
      input.payments.length === 1 && appliedTotal === grandTotal && cashChange === 0;
    const settlementInput: SettlementInput = singleTenderExact
      ? {
          settlementMode: 'CASH_FULL',
          settlements: [
            {
              paymentMethod: POS_METHOD_TO_SI_METHOD[input.payments[0].method],
              settlementAccountId: accountFor(input.payments[0].method),
              amountBase: grandTotal,
              reference: input.payments[0].reference,
            },
          ],
        }
      : {
          settlementMode: 'MULTI',
          settlements: input.payments.map((p) => ({
            paymentMethod: POS_METHOD_TO_SI_METHOD[p.method],
            settlementAccountId: accountFor(p.method),
            amountBase: p.method === 'CASH' ? round2(p.amount - cashChange) : round2(p.amount),
            reference: p.reference,
          })),
        };

    // Step 4 — post the SI with settlement. Creates revenue/tax/COGS vouchers, inventory OUT,
    // and one receipt voucher per settlement row, clearing AR to zero. Errors propagate.
    const salesInvoice: SalesInvoice = await this.postSalesInvoiceUseCase.execute(
      input.companyId,
      draft.id,
      true,
      undefined,
      settlementInput,
      undefined,
      { userId: input.actor.userId, userEmail: input.actor.userEmail }
    );

    // Persist POS-side artifacts. Receipt totals + line snapshots are hydrated from the
    // posted SI so the printed receipt is the financial truth (incl. tax + resolved names).
    const receiptNumber = settings.receiptPrefix + '-' + String(settings.receiptNextSeq).padStart(6, '0');
    settings.receiptNextSeq += 1;

    const receiptLines: PosReceiptLineSnapshot[] = salesInvoice.lines.map((l) => ({
      itemId: l.itemId,
      itemCode: l.itemCode,
      itemName: l.itemName,
      qty: l.invoicedQty,
      uom: l.uom,
      unitPrice: l.unitPriceDoc,
      lineDiscount: round2(l.discountAmountBase ?? 0),
      taxCodeId: l.taxCodeId,
      lineTotal: round2(l.lineTotalBase),
      salesInvoiceLineId: l.lineId, // lets POS returns reference the SI lines (P3)
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
      customerName: draft.customerName,
      lines: receiptLines,
      subtotal: round2(salesInvoice.subtotalBase),
      discountTotal,
      taxTotal: round2(salesInvoice.taxTotalBase),
      grandTotal: round2(salesInvoice.grandTotalBase),
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
