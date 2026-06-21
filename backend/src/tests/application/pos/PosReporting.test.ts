import {
  GetDailyPosSummaryUseCase,
  GetCashierSalesSummaryUseCase,
  GetCashOverShortReportUseCase,
  GetReceiptHistoryUseCase,
} from '../../../application/pos/use-cases/PosReportingUseCases';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosReturn } from '../../../domain/pos/entities/PosReturn';
import { PosShift } from '../../../domain/pos/entities/PosShift';

const makeReceipt = (overrides: any = {}): PosReceipt =>
  PosReceipt.fromJSON({
    id: overrides.id || 'rcp_1',
    companyId: 'cmp_test',
    shiftId: overrides.shiftId || 'shift_1',
    registerId: overrides.registerId || 'reg_1',
    receiptNumber: overrides.receiptNumber || 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_1',
    lines: [{ itemId: 'i1', itemCode: 'A', itemName: 'A', qty: 1, uom: 'ea', unitPrice: 10, lineDiscount: 0, lineTotal: 10 }],
    subtotal: 10,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: overrides.grandTotal ?? 10,
    salesInvoiceId: 'si_1',
    salesInvoiceNumber: 'SI-0001',
    createdBy: 'cashier_1',
    createdAt: overrides.createdAt ? new Date(overrides.createdAt) : new Date(),
    ...overrides,
  });

const makeReturn = (overrides: any = {}): PosReturn =>
  PosReturn.fromJSON({
    id: overrides.id || 'ret_1',
    companyId: 'cmp_test',
    shiftId: overrides.shiftId || 'shift_2',
    registerId: 'reg_1',
    returnNumber: 'RET-0001',
    originalReceiptId: 'rcp_1',
    originalReceiptNumber: 'R-000001',
    salesInvoiceId: 'si_1',
    lines: [{ itemId: 'i1', qty: 1, unitPrice: 10, lineTotal: 10 }],
    refundMethod: 'CASH',
    refundTotal: overrides.refundTotal ?? 10,
    salesReturnId: 'sr_1',
    salesReturnNumber: 'SR-0001',
    createdBy: 'cashier_1',
    createdAt: overrides.createdAt ? new Date(overrides.createdAt) : new Date(),
    ...overrides,
  });

describe('PosReportingUseCases', () => {
  describe('GetDailyPosSummaryUseCase', () => {
    it('rolls up receipts and returns per day', async () => {
      const receiptRepo = { list: jest.fn().mockResolvedValue([makeReceipt(), makeReceipt({ id: 'rcp_2', grandTotal: 20 })]) };
      const returnRepo = { list: jest.fn().mockResolvedValue([makeReturn()]) };
      const useCase = new GetDailyPosSummaryUseCase(receiptRepo as any, returnRepo as any);
      const rows = await useCase.execute({ companyId: 'cmp_test' });
      const today = new Date().toISOString().slice(0, 10);
      const todayRow = rows.find((r) => r.date === today);
      expect(todayRow).toBeDefined();
      expect(todayRow?.receiptCount).toBe(2);
      expect(todayRow?.returnCount).toBe(1);
      expect(todayRow?.grossTotal).toBe(30);
      expect(todayRow?.returnsTotal).toBe(10);
      expect(todayRow?.netTotal).toBe(20);
    });
  });

  describe('GetCashierSalesSummaryUseCase', () => {
    it('groups by cashier', async () => {
      const shift = PosShift.fromJSON({
        id: 'shift_1', companyId: 'cmp_test', registerId: 'reg_1', cashierUserId: 'cashier_1',
        status: 'CLOSED', openedAt: new Date(), closedAt: new Date(), openingFloat: 100, createdAt: new Date(), updatedAt: new Date(),
      });
      const shiftRepo = { list: jest.fn().mockResolvedValue([shift]) };
      const receiptRepo = { list: jest.fn().mockResolvedValue([makeReceipt(), makeReceipt({ id: 'rcp_2', grandTotal: 5 })]) };
      const useCase = new GetCashierSalesSummaryUseCase(shiftRepo as any, receiptRepo as any);
      const rows = await useCase.execute({ companyId: 'cmp_test' });
      expect(rows.find((r) => r.cashierUserId === 'cashier_1')?.receiptCount).toBe(2);
      expect(rows.find((r) => r.cashierUserId === 'cashier_1')?.grossTotal).toBe(15);
    });
  });

  describe('GetCashOverShortReportUseCase', () => {
    it('lists closed shifts with their variance', async () => {
      const shift = PosShift.fromJSON({
        id: 'shift_1', companyId: 'cmp_test', registerId: 'reg_1', cashierUserId: 'cashier_1',
        status: 'CLOSED', openedAt: new Date(), closedAt: new Date(), openingFloat: 100,
        expectedCash: 200, countedCash: 205, overShortAmount: 5, overShortVoucherId: 'v1',
        createdAt: new Date(), updatedAt: new Date(),
      });
      const shiftRepo = { list: jest.fn().mockResolvedValue([shift]) };
      const useCase = new GetCashOverShortReportUseCase(shiftRepo as any);
      const rows = await useCase.execute({ companyId: 'cmp_test' });
      expect(rows).toHaveLength(1);
      expect(rows[0].overShortAmount).toBe(5);
      expect(rows[0].overShortVoucherId).toBe('v1');
    });
  });

  describe('GetReceiptHistoryUseCase', () => {
    it('projects receipts to history rows', async () => {
      const receiptRepo = { list: jest.fn().mockResolvedValue([makeReceipt()]) };
      const useCase = new GetReceiptHistoryUseCase(receiptRepo as any);
      const rows = await useCase.execute({ companyId: 'cmp_test' });
      expect(rows[0].receiptNumber).toBe('R-000001');
      expect(rows[0].salesInvoiceNumber).toBe('SI-0001');
    });
  });
});
