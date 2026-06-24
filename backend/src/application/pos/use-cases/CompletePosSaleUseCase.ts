import { roundCash, roundMoney } from '../../system-core/money/roundMoney';
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
import { INumberingEngine } from '../../system-core/contracts/INumberingEngine';
import { PostPosSaleUseCase } from './PostPosSaleUseCase';
import { PosCashRounding, PosPaymentMethodConfig } from '../../../domain/pos/entities/PosSettings';
import { IAuditEngine } from '../../system-core/contracts/IAuditEngine';


export interface PosCartLine {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  uom?: string;
  qty: number;
  unitPrice: number;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  taxCodeId?: string;
  manualTaxAmount?: number;
  approvedCostMarginOverride?: boolean;
  priceOverride?: boolean;
  taxOverride?: boolean;
  status?: 'ACTIVE' | 'VOIDED';
  voidedBy?: string;
  voidedAt?: string;
  voidReason?: string;
  managerOverrideId?: string;
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
  exchangeId?: string;
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
 *   4. Allocate receipt number via System Core numbering and post the sale through POS-owned posting.
 *   5. Persist PosReceipt + PosPayment rows + cash movement atomically.
 *   6. Mirror settings.receiptNextSeq for legacy settings visibility.
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
    private readonly policyEngine: IPolicyEngine,
    private readonly numberingEngine: INumberingEngine,
    private readonly auditEngine?: IAuditEngine
  ) {}

  async execute(input: CompletePosSaleInput): Promise<CompletePosSaleResult> {
    if (!input.lines?.length) {
      throw new Error('Cart must have at least one line.');
    }
    const activeLines = input.lines.filter((line) => line.status !== 'VOIDED');
    const voidedLines = input.lines.filter((line) => line.status === 'VOIDED');
    if (activeLines.length === 0) {
      throw new Error('Cart must have at least one active line.');
    }
    for (const line of voidedLines) {
      if (!line.voidReason?.trim()) {
        throw new Error('Voided POS lines require a reason.');
      }
      if (!line.voidedBy?.trim()) {
        throw new Error('Voided POS lines require the cashier user.');
      }
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

    const registerPaymentMethods = settings.paymentMethods.map((method) => ({
      ...method,
      settlementAccountId: settlementAccountForRegister(method.code, register),
    }));

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

    await this.assertManagerOverrideIfRequired(input, 'VOID_LINE', voidedLines.some((line) => Boolean(line.managerOverrideId)), {
      lineCount: voidedLines.length,
    }, voidedLines.length > 0);
    await this.assertManagerOverrideIfRequired(input, 'PRICE_OVERRIDE', activeLines.some((line) => Boolean(line.managerOverrideId)), {
      lineCount: activeLines.filter((line) => line.priceOverride === true).length,
    }, activeLines.some((line) => line.priceOverride === true));
    await this.assertManagerOverrideIfRequired(input, 'DISCOUNT_OVERRIDE', activeLines.some((line) => Boolean(line.managerOverrideId)), {
      lineCount: activeLines.filter((line) => (line.discountValue || 0) > 0).length,
    }, activeLines.some((line) => (line.discountValue || 0) > 0));
    await this.assertManagerOverrideIfRequired(input, 'TAX_OVERRIDE', activeLines.some((line) => Boolean(line.managerOverrideId)), {
      lineCount: activeLines.filter((line) => line.taxOverride === true).length,
    }, activeLines.some((line) => line.taxOverride === true));
    await this.assertSaleLineControls(input, activeLines);

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
      const registerAccountId = settlementAccountForRegister(p.method, register);
      if (!registerAccountId) {
        throw new Error(`Configure ${p.method} settlement account on POS register ${register.code || register.id}.`);
      }
    }

    // Preview the total through the POS posting path before opening the write transaction.
    // The same use-case will re-use these inputs for the actual stock/ledger write.
    const receiptNumber = await this.numberingEngine.next({
      companyId: input.companyId,
      docType: 'POS_RECEIPT',
      scope: 'terminal',
      terminalId: input.registerId,
      prefix: settings.receiptPrefix,
      counterWidth: 6,
      seedNextNumber: settings.receiptNextSeq,
    });
    const saleDate = new Date().toISOString().slice(0, 10);

    const preview = await this.postPosSaleUseCase.execute({
      companyId: input.companyId,
      customerId,
      documentNumber: receiptNumber,
      date: saleDate,
      lines: activeLines.map((l) => ({
        itemId: l.itemId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discountType: l.discountType,
        discountValue: l.discountValue,
        taxCodeId: l.taxCodeId,
        manualTaxAmount: l.manualTaxAmount,
        approvedCostMarginOverride: l.approvedCostMarginOverride,
        warehouseId: register.warehouseId,
      })),
      payments: [],
      paymentMethods: registerPaymentMethods,
      negativeStockPolicy: settings.negativeStockPolicy,
      createdBy: input.actor.userId,
      dryRun: true,
    });

    const cashRoundingRule = posCashRoundingRule(settings.cashRounding);
    const grandTotal = roundMoney(preview.grandTotal, preview.currency);
    const roundedGrandTotal = roundCash(grandTotal, preview.currency, cashRoundingRule);
    const cashRoundingAdjustment = roundMoney(roundedGrandTotal - grandTotal, preview.currency);
    if (cashRoundingAdjustment > 0 && !settings.cashOverAccountId) {
      throw new Error('POS cash rounding gain requires a configured Cash Over account.');
    }
    if (cashRoundingAdjustment < 0 && !settings.cashShortAccountId) {
      throw new Error('POS cash rounding loss requires a configured Cash Short account.');
    }
    const cashTendered = roundMoney(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0),
      preview.currency
    );
    const cashChange = roundMoney(Math.max(0, cashTendered - roundedGrandTotal), preview.currency);
    const appliedTotal = roundMoney(
      input.payments.reduce((s, p) => s + p.amount, 0) - cashChange,
      preview.currency
    );
    if (Math.abs(appliedTotal - roundedGrandTotal) > 0.005) {
      throw new Error(
        `Payment total (${appliedTotal.toFixed(2)}) must equal the POS sale grand total ` +
        `incl. tax (${roundedGrandTotal.toFixed(2)}). Cash change of ${cashChange.toFixed(2)} is allowed.`
      );
    }

    const appliedPayments = input.payments.map((p) => ({
      method: p.method,
      amount: p.method === 'CASH' ? roundMoney(p.amount - cashChange, preview.currency) : roundMoney(p.amount, preview.currency),
      reference: p.reference,
    }));

    const cashApplied = roundMoney(
      input.payments.filter((p) => p.method === 'CASH').reduce((s, p) => s + p.amount, 0) - cashChange,
      preview.currency
    );

    const { postedSale, receipt } = await this.transactionManager.runTransaction(async (tx) => {
      const sale = await this.postPosSaleUseCase.execute({
        companyId: input.companyId,
        customerId,
        documentId: preview.documentId,
        documentNumber: receiptNumber,
        date: saleDate,
        lines: activeLines.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountType: l.discountType,
          discountValue: l.discountValue,
          taxCodeId: l.taxCodeId,
          manualTaxAmount: l.manualTaxAmount,
          approvedCostMarginOverride: l.approvedCostMarginOverride,
          warehouseId: register.warehouseId,
        })),
        payments: appliedPayments,
        paymentMethods: registerPaymentMethods,
        negativeStockPolicy: settings.negativeStockPolicy,
        cashRoundingAdjustmentBase: cashRoundingAdjustment,
        cashRoundingAccountId: cashRoundingAdjustment > 0 ? settings.cashOverAccountId : settings.cashShortAccountId,
        createdBy: input.actor.userId,
        transaction: tx,
      });

      const receiptLines: PosReceiptLineSnapshot[] = sale.lines.map((l, index) => {
        const sourceLine = activeLines[index];
        return {
          itemId: l.itemId,
          itemCode: l.itemCode,
          itemName: l.itemName,
          qty: l.qty,
          uom: l.uom,
          unitPrice: l.unitPrice,
          discountType: sourceLine?.discountType,
          discountValue: sourceLine?.discountValue,
          lineDiscount: roundMoney(l.lineDiscount ?? 0),
          taxCodeId: l.taxCodeId,
          lineTotal: roundMoney(l.lineTotal),
          priceOverride: sourceLine?.priceOverride === true,
          taxOverride: sourceLine?.taxOverride === true,
          managerOverrideId: sourceLine?.managerOverrideId,
          salesInvoiceLineId: l.lineId, // legacy field name; 250d2 removes Sales return dependency.
          revenueAccountId: l.revenueAccountId,
          taxAccountId: l.taxAccountId,
          cogsAccountId: l.cogsAccountId,
          inventoryAccountId: l.inventoryAccountId,
          unitCostBase: l.unitCostBase,
          lineCostBase: l.lineCostBase,
          appliedPromotionId: l.appliedPromotionId,
          appliedPromotionName: l.appliedPromotionName,
          status: 'ACTIVE' as const,
        };
      });
      const voidedReceiptLines: PosReceiptLineSnapshot[] = voidedLines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode || l.itemId,
        itemName: l.itemName || l.itemId,
        qty: l.qty,
        uom: l.uom || '',
        unitPrice: roundMoney(l.unitPrice),
        discountType: l.discountType,
        discountValue: l.discountValue,
        lineDiscount: roundMoney(l.discountValue || 0),
        taxCodeId: l.taxCodeId,
        lineTotal: roundMoney(Math.max(0, l.qty * l.unitPrice - (l.discountValue || 0))),
        status: 'VOIDED',
        priceOverride: l.priceOverride === true,
        taxOverride: l.taxOverride === true,
        voidedBy: l.voidedBy,
        voidedAt: l.voidedAt,
        voidReason: l.voidReason,
        managerOverrideId: l.managerOverrideId,
      }));
      const allReceiptLines = [...receiptLines, ...voidedReceiptLines];
      const discountTotal = roundMoney(receiptLines.reduce((s, l) => s + l.lineDiscount, 0));

      const receipt = new PosReceipt({
        id: `rcp_${randomUUID()}`,
        companyId: input.companyId,
        shiftId: input.shiftId,
        registerId: input.registerId,
        receiptNumber,
        status: 'COMPLETED',
        customerId,
        customerName: sale.customerName,
        lines: allReceiptLines,
        subtotal: roundMoney(sale.subtotal),
        discountTotal,
        taxTotal: roundMoney(sale.taxTotal),
        grandTotal: roundMoney(sale.roundedGrandTotal),
        salesInvoiceId: sale.documentId,
        salesInvoiceNumber: sale.documentNumber,
        exchangeId: input.exchangeId,
        createdBy: input.actor.userId,
        createdAt: new Date(),
      });

      const payments: PosPayment[] = input.payments.map((p) =>
        new PosPayment({
          id: `pmt_${randomUUID()}`,
          companyId: input.companyId,
          receiptId: receipt.id,
          method: p.method,
          amount: roundMoney(p.amount),
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
      settings.receiptNextSeq = Math.max(settings.receiptNextSeq + 1, nextNumericSequence(receiptNumber) + 1);
      await this.settingsRepo.saveSettings(settings, tx);

      return { postedSale: sale, receipt };
    });

    if (this.auditEngine) {
      await this.auditEngine.record({
        companyId: input.companyId,
        entity: { type: 'POS_RECEIPT', id: receipt.id, number: receipt.receiptNumber },
        action: 'CREATE',
        actor: { userId: input.actor.userId, userEmail: input.actor.userEmail },
        after: {
          ...receipt.toJSON(),
          postedDocumentId: postedSale.documentId,
          postedDocumentNumber: postedSale.documentNumber,
          voucherIds: postedSale.voucherIds,
          cashRoundingAdjustmentBase: postedSale.cashRoundingAdjustmentBase,
        },
      });
    }

    return {
      receipt,
      salesInvoiceId: postedSale.documentId,
      salesInvoiceNumber: postedSale.documentNumber,
      change: cashChange,
    };
  }

  private async assertManagerOverrideIfRequired(
    input: CompletePosSaleInput,
    overrideAction: 'VOID_LINE' | 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TAX_OVERRIDE',
    approvedOverride: boolean,
    payload: Record<string, unknown>,
    shouldEvaluate: boolean
  ): Promise<void> {
    if (!shouldEvaluate) return;
    const decision = await this.policyEngine.resolve({
      scope: 'pos',
      action: 'managerOverride',
      companyId: input.companyId,
      context: {
        overrideAction,
        registerId: input.registerId,
        cashierUserId: input.actor.userId,
        cashierRoleId: input.actor.roleId,
        approvedOverride,
        payload,
      },
    });
    if (!decision.allowed) {
      throw new Error(`Manager approval is required for POS ${overrideAction.toLowerCase().replace(/_/g, ' ')}.`);
    }
  }

  private async assertSaleLineControls(input: CompletePosSaleInput, activeLines: PosCartLine[]): Promise<void> {
    for (const line of activeLines) {
      const gross = roundMoney(Math.max(0, line.qty * line.unitPrice));
      const discountAmount = calculateDiscountAmount(line, gross);
      const discountPercent = gross > 0 ? roundMoney((discountAmount / gross) * 100) : 0;
      const decision = await this.policyEngine.resolve({
        scope: 'pos',
        action: 'saleLineControls',
        companyId: input.companyId,
        context: {
          registerId: input.registerId,
          cashierUserId: input.actor.userId,
          cashierRoleId: input.actor.roleId,
          itemId: line.itemId,
          priceOverride: line.priceOverride === true,
          taxOverride: line.taxOverride === true,
          discountAmount,
          discountPercent,
          approvedOverrideId: line.managerOverrideId,
        },
      });
      if (!decision.allowed) {
        throw new Error('Manager approval is required for POS price, discount, or tax override limits.');
      }
    }
  }
}

function nextNumericSequence(documentNumber: string): number {
  const match = documentNumber.match(/(\d+)\D*$/);
  return match ? Number(match[1]) : 0;
}

function posCashRoundingRule(rounding: PosCashRounding): { increment?: number; mode?: 'NEAREST' } | null {
  if (rounding === 'nearest_05') return { increment: 0.05, mode: 'NEAREST' };
  if (rounding === 'nearest_1') return { increment: 1, mode: 'NEAREST' };
  return null;
}

function settlementAccountForRegister(
  method: PosPaymentMethodConfig['code'],
  register: { cashDrawerAccountId?: string; settlementAccountIds?: Record<string, string> }
): string {
  if (method === 'CASH') return register.cashDrawerAccountId || '';
  return register.settlementAccountIds?.[method] || '';
}

function calculateDiscountAmount(line: PosCartLine, gross: number): number {
  if (!line.discountType || !line.discountValue) return 0;
  if (line.discountType === 'PERCENT') {
    return roundMoney(Math.max(0, Math.min(gross, gross * (line.discountValue / 100))));
  }
  return roundMoney(Math.max(0, Math.min(gross, line.discountValue)));
}
