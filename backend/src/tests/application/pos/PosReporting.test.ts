import {
  GetDailyPosSummaryUseCase,
  GetPaymentMethodSummaryUseCase,
  GetCashierSalesSummaryUseCase,
  GetCashOverShortReportUseCase,
  GetReceiptHistoryUseCase,
  GetPosOverrideAuditReportUseCase,
} from '../../../application/pos/use-cases/PosReportingUseCases';
import { PosPayment } from '../../../domain/pos/entities/PosPayment';
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

const makePayment = (overrides: any = {}): PosPayment =>
  PosPayment.fromJSON({
    id: overrides.id || 'pmt_1',
    companyId: 'cmp_test',
    receiptId: overrides.receiptId || 'rcp_1',
    method: overrides.method || 'CASH',
    amount: overrides.amount ?? 10,
    changeGiven: overrides.changeGiven ?? 0,
    reference: overrides.reference,
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

  describe('GetPaymentMethodSummaryUseCase', () => {
    it('aggregates stored receipt payments by method and nets cash change', async () => {
      const receiptRepo = {
        list: jest.fn().mockResolvedValue([
          makeReceipt({ id: 'rcp_1' }),
          makeReceipt({ id: 'rcp_2', grandTotal: 15 }),
        ]),
      };
      const paymentRepo = {
        listByReceipt: jest.fn()
          .mockResolvedValueOnce([
            makePayment({ receiptId: 'rcp_1', method: 'CASH', amount: 10, changeGiven: 2 }),
            makePayment({ receiptId: 'rcp_1', method: 'CARD', amount: 4, reference: 'AUTH-1' }),
          ])
          .mockResolvedValueOnce([
            makePayment({ receiptId: 'rcp_2', method: 'CASH', amount: 15, changeGiven: 0 }),
          ]),
      };
      const useCase = new GetPaymentMethodSummaryUseCase(receiptRepo as any, paymentRepo as any);

      const rows = await useCase.execute({ companyId: 'cmp_test', registerId: 'reg_1' });

      expect(receiptRepo.list).toHaveBeenCalledWith('cmp_test', expect.objectContaining({ registerId: 'reg_1' }));
      expect(paymentRepo.listByReceipt).toHaveBeenCalledTimes(2);
      expect(rows.find((r) => r.method === 'CASH')).toEqual({ method: 'CASH', receiptCount: 2, amount: 23 });
      expect(rows.find((r) => r.method === 'CARD')).toEqual({ method: 'CARD', receiptCount: 1, amount: 4 });
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

  describe('GetPosOverrideAuditReportUseCase', () => {
    it('lists void, discount, price, and tax override receipt lines for audit review', async () => {
      const receiptRepo = {
        list: jest.fn().mockResolvedValue([
          makeReceipt({
            lines: [
              {
                itemId: 'i1',
                itemCode: 'A',
                itemName: 'A',
                qty: 1,
                uom: 'ea',
                unitPrice: 10,
                lineDiscount: 0,
                lineTotal: 10,
              },
              {
                itemId: 'i2',
                itemCode: 'B',
                itemName: 'B',
                qty: 1,
                uom: 'ea',
                unitPrice: 20,
                discountType: 'PERCENT',
                discountValue: 20,
                lineDiscount: 4,
                lineTotal: 16,
                priceOverride: true,
                taxOverride: true,
                managerOverrideId: 'mgr_override_1',
              },
              {
                itemId: 'i3',
                itemCode: 'C',
                itemName: 'C',
                qty: 1,
                uom: 'ea',
                unitPrice: 5,
                lineDiscount: 0,
                lineTotal: 5,
                status: 'VOIDED',
                voidReason: 'Wrong item',
                voidedBy: 'cashier_1',
                voidedAt: '2026-06-22T10:00:00.000Z',
              },
            ],
          }),
        ]),
      };
      const useCase = new GetPosOverrideAuditReportUseCase(receiptRepo as any);

      const rows = await useCase.execute({ companyId: 'cmp_test', registerId: 'reg_1' });

      expect(receiptRepo.list).toHaveBeenCalledWith('cmp_test', expect.objectContaining({ registerId: 'reg_1' }));
      expect(rows.map((r) => r.eventType).sort()).toEqual([
        'DISCOUNT_OVERRIDE',
        'PRICE_OVERRIDE',
        'TAX_OVERRIDE',
        'VOID_LINE',
      ]);
      expect(rows.find((r) => r.eventType === 'VOID_LINE')).toMatchObject({
        itemCode: 'C',
        voidReason: 'Wrong item',
        voidedBy: 'cashier_1',
      });
      expect(rows.find((r) => r.eventType === 'PRICE_OVERRIDE')).toMatchObject({
        itemCode: 'B',
        managerOverrideId: 'mgr_override_1',
      });
    });
  });
});
