/**
 * PosReportingUseCases.ts — Read-only reporting use cases for the POS module.
 *
 * All use cases are tenant-scoped (companyId). They source data from the
 * PosReceipt, PosReturn, PosCashMovement, PosShift, and PosRegister repos
 * (operational truth) and the linked Sales invoice / Sales return / ledger
 * repos (financial truth). The reports prefer reading the SI for financial
 * figures (single source of truth) and the receipt for operational counts.
 */
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';
import { IPosReturnRepository } from '../../../repository/interfaces/pos/IPosReturnRepository';
import { IPosShiftRepository } from '../../../repository/interfaces/pos/IPosShiftRepository';
import { IPosCashMovementRepository } from '../../../repository/interfaces/pos/IPosCashMovementRepository';
import { IPosRegisterRepository } from '../../../repository/interfaces/pos/IPosRegisterRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesReturnRepository } from '../../../repository/interfaces/sales/ISalesReturnRepository';
import { PosShift } from '../../../domain/pos/entities/PosShift';
import { PosCashMovementTotals } from '../../../repository/interfaces/pos/IPosCashMovementRepository';

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ───────── 1. Z report (finalized close summary) ─────────

export interface GetPosZReportInput {
  companyId: string;
  shiftId: string;
}

export interface PosZReport {
  shift: PosShift;
  totals: PosCashMovementTotals;
  receiptCount: number;
  returnCount: number;
  grossTotal: number;     // sum of receipt grandTotals posted in this shift
  taxTotal: number;       // 0 in V1 (Sales owns tax); surfaced for parity
  netTotal: number;       // grossTotal − returnsTotal
  returnsTotal: number;    // sum of return refundTotals posted in this shift
  overShortAmount?: number;
  overShortVoucherId?: string;
  generatedAt: string;
}

export class GetPosZReportUseCase {
  constructor(
    private readonly shiftRepo: IPosShiftRepository,
    private readonly cashMovementRepo: IPosCashMovementRepository,
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly returnRepo: IPosReturnRepository
  ) {}

  async execute(input: GetPosZReportInput): Promise<PosZReport> {
    const shift = await this.shiftRepo.getById(input.companyId, input.shiftId);
    if (!shift) throw new Error(`POS shift not found: ${input.shiftId}`);
    const [totals, receipts, returns] = await Promise.all([
      this.cashMovementRepo.sumByShift(input.companyId, input.shiftId),
      this.receiptRepo.list(input.companyId, { shiftId: input.shiftId }),
      this.returnRepo.list(input.companyId, { shiftId: input.shiftId }),
    ]);
    const grossTotal = round2(receipts.reduce((s, r) => s + r.grandTotal, 0));
    const returnsTotal = round2(returns.reduce((s, r) => s + r.refundTotal, 0));
    return {
      shift,
      totals,
      receiptCount: receipts.length,
      returnCount: returns.length,
      grossTotal,
      taxTotal: round2(receipts.reduce((s, r) => s + r.taxTotal, 0)),
      netTotal: round2(grossTotal - returnsTotal),
      returnsTotal,
      overShortAmount: shift.overShortAmount,
      overShortVoucherId: shift.overShortVoucherId,
      generatedAt: new Date().toISOString(),
    };
  }
}

// ───────── 2. Daily POS summary ─────────

export interface GetDailyPosSummaryInput {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
  registerId?: string;
}

export interface DailyPosSummaryRow {
  date: string; // ISO YYYY-MM-DD
  receiptCount: number;
  returnCount: number;
  grossTotal: number;
  returnsTotal: number;
  netTotal: number;
}

export class GetDailyPosSummaryUseCase {
  constructor(private readonly receiptRepo: IPosReceiptRepository, private readonly returnRepo: IPosReturnRepository) {}

  async execute(input: GetDailyPosSummaryInput): Promise<DailyPosSummaryRow[]> {
    const list = await this.receiptRepo.list(input.companyId, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      registerId: input.registerId,
      limit: 1000,
    } as any);
    const returns = await this.returnRepo.list(input.companyId, { limit: 1000 });
    const byDay: Record<string, { receiptCount: number; gross: number; returnsCount: number; returnsSum: number }> = {};
    for (const r of list) {
      const day = (r.createdAt as any as Date).toISOString?.().slice(0, 10) || String(r.createdAt).slice(0, 10);
      if (!byDay[day]) byDay[day] = { receiptCount: 0, gross: 0, returnsCount: 0, returnsSum: 0 };
      byDay[day].receiptCount += 1;
      byDay[day].gross = round2(byDay[day].gross + r.grandTotal);
    }
    for (const re of returns) {
      const day = (re.createdAt as any as Date).toISOString?.().slice(0, 10) || String(re.createdAt).slice(0, 10);
      if (!byDay[day]) byDay[day] = { receiptCount: 0, gross: 0, returnsCount: 0, returnsSum: 0 };
      byDay[day].returnsCount += 1;
      byDay[day].returnsSum = round2(byDay[day].returnsSum + re.refundTotal);
    }
    return Object.keys(byDay)
      .sort()
      .map((day) => {
        const v = byDay[day];
        return {
          date: day,
          receiptCount: v.receiptCount,
          returnCount: v.returnsCount,
          grossTotal: v.gross,
          returnsTotal: v.returnsSum,
          netTotal: round2(v.gross - v.returnsSum),
        };
      });
  }
}

// ───────── 3. Payment method summary ─────────

export interface GetPaymentMethodSummaryInput {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
  registerId?: string;
}

export interface PaymentMethodSummaryRow {
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
  receiptCount: number;
  amount: number;
}

export class GetPaymentMethodSummaryUseCase {
  constructor(private readonly receiptRepo: IPosReceiptRepository) {}

  async execute(input: GetPaymentMethodSummaryInput): Promise<PaymentMethodSummaryRow[]> {
    // Payment method rows live in posPayments (we have to load each receipt's payments).
    // V1: we re-fetch each receipt and read from its payment rows via the repo.
    const list = await this.receiptRepo.list(input.companyId, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      registerId: input.registerId,
      limit: 1000,
    } as any);
    const byMethod: Record<string, { count: number; amount: number }> = { CASH: { count: 0, amount: 0 }, CARD: { count: 0, amount: 0 }, BANK_TRANSFER: { count: 0, amount: 0 }, CUSTOM: { count: 0, amount: 0 } };
    // Note: V1 does not aggregate from pos_payments here (it would require a payments repo
    // list-by-company API). The summary is a placeholder that the cashier page can later
    // enrich by listing payments per receipt.
    return (Object.keys(byMethod) as Array<keyof typeof byMethod>).map((m) => ({
      method: m as any,
      receiptCount: byMethod[m].count,
      amount: byMethod[m].amount,
    }));
  }
}

// ───────── 4. Cashier sales summary ─────────

export interface GetCashierSalesSummaryInput {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CashierSalesSummaryRow {
  cashierUserId: string;
  shiftCount: number;
  receiptCount: number;
  grossTotal: number;
}

export class GetCashierSalesSummaryUseCase {
  constructor(private readonly shiftRepo: IPosShiftRepository, private readonly receiptRepo: IPosReceiptRepository) {}

  async execute(input: GetCashierSalesSummaryInput): Promise<CashierSalesSummaryRow[]> {
    const shifts = await this.shiftRepo.list(input.companyId);
    const receipts = await this.receiptRepo.list(input.companyId, { limit: 1000 } as any);
    const byCashier: Record<string, { shiftIds: Set<string>; receiptCount: number; gross: number }> = {};
    for (const s of shifts) {
      if (!byCashier[s.cashierUserId]) byCashier[s.cashierUserId] = { shiftIds: new Set(), receiptCount: 0, gross: 0 };
      byCashier[s.cashierUserId].shiftIds.add(s.id);
    }
    for (const r of receipts) {
      const shift = shifts.find((s) => s.id === r.shiftId);
      if (!shift) continue;
      if (!byCashier[shift.cashierUserId]) byCashier[shift.cashierUserId] = { shiftIds: new Set(), receiptCount: 0, gross: 0 };
      byCashier[shift.cashierUserId].receiptCount += 1;
      byCashier[shift.cashierUserId].gross = round2(byCashier[shift.cashierUserId].gross + r.grandTotal);
    }
    return Object.entries(byCashier).map(([cashierUserId, v]) => ({
      cashierUserId,
      shiftCount: v.shiftIds.size,
      receiptCount: v.receiptCount,
      grossTotal: v.gross,
    }));
  }
}

// ───────── 5. Cash over/short report ─────────

export interface GetCashOverShortReportInput {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CashOverShortRow {
  shiftId: string;
  registerId: string;
  cashierUserId: string;
  openedAt: string;
  closedAt?: string;
  expectedCash: number;
  countedCash?: number;
  overShortAmount: number;
  overShortVoucherId?: string;
}

export class GetCashOverShortReportUseCase {
  constructor(private readonly shiftRepo: IPosShiftRepository) {}

  async execute(input: GetCashOverShortReportInput): Promise<CashOverShortRow[]> {
    const shifts = await this.shiftRepo.list(input.companyId, { status: 'CLOSED' });
    return shifts
      .filter((s) => s.closedAt)
      .map((s) => ({
        shiftId: s.id,
        registerId: s.registerId,
        cashierUserId: s.cashierUserId,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt ? s.closedAt.toISOString() : undefined,
        expectedCash: s.expectedCash ?? 0,
        countedCash: s.countedCash,
        overShortAmount: s.overShortAmount ?? 0,
        overShortVoucherId: s.overShortVoucherId,
      }));
  }
}

// ───────── 6. Receipt history ─────────

export interface GetReceiptHistoryInput {
  companyId: string;
  dateFrom?: string;
  dateTo?: string;
  registerId?: string;
  customerId?: string;
  limit?: number;
}

export interface ReceiptHistoryRow {
  id: string;
  receiptNumber: string;
  registerId: string;
  shiftId: string;
  customerId: string;
  grandTotal: number;
  salesInvoiceId?: string;
  salesInvoiceNumber?: string;
  createdAt: string;
}

export class GetReceiptHistoryUseCase {
  constructor(private readonly receiptRepo: IPosReceiptRepository) {}

  async execute(input: GetReceiptHistoryInput): Promise<ReceiptHistoryRow[]> {
    const list = await this.receiptRepo.list(input.companyId, {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      registerId: input.registerId,
      customerId: input.customerId,
      limit: input.limit,
    } as any);
    return list.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      registerId: r.registerId,
      shiftId: r.shiftId,
      customerId: r.customerId,
      grandTotal: r.grandTotal,
      salesInvoiceId: r.salesInvoiceId,
      salesInvoiceNumber: r.salesInvoiceNumber,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
