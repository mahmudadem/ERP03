import { CompletePosExchangeUseCase } from '../../../application/pos/use-cases/CompletePosExchangeUseCase';
import { PosReceipt } from '../../../domain/pos/entities/PosReceipt';
import { PosReturn } from '../../../domain/pos/entities/PosReturn';

const makeReceipt = (overrides: Partial<any> = {}): PosReceipt =>
  PosReceipt.fromJSON({
    id: 'rcp_original',
    companyId: 'cmp_test',
    shiftId: 'shift_old',
    registerId: 'reg_1',
    receiptNumber: 'R-000001',
    status: 'COMPLETED',
    customerId: 'cust_original',
    lines: [{ itemId: 'item_a', itemCode: 'A', itemName: 'A', qty: 1, uom: 'ea', unitPrice: 20, lineDiscount: 0, lineTotal: 20 }],
    subtotal: 20,
    discountTotal: 0,
    taxTotal: 0,
    grandTotal: 20,
    salesInvoiceId: 'pos_sale_original',
    salesInvoiceNumber: 'R-000001',
    createdBy: 'cashier_1',
    createdAt: new Date(),
    ...overrides,
  });

const makeReturn = (overrides: Partial<any> = {}): PosReturn =>
  PosReturn.fromJSON({
    id: 'ret_1',
    companyId: 'cmp_test',
    shiftId: 'shift_1',
    registerId: 'reg_1',
    returnNumber: 'RET-000001',
    originalReceiptId: 'rcp_original',
    originalReceiptNumber: 'R-000001',
    salesInvoiceId: 'pos_sale_original',
    lines: [{ itemId: 'item_a', qty: 1, unitPrice: 20, lineTotal: 20 }],
    refundMethod: 'CASH',
    refundTotal: 20,
    salesReturnId: 'sr_1',
    salesReturnNumber: 'SR-000001',
    createdBy: 'cashier_1',
    createdAt: new Date(),
    ...overrides,
  });

const setup = (saleGrandTotal = 25, refundTotal = 20) => {
  const originalReceipt = makeReceipt();
  const receiptRepo = { getById: jest.fn().mockResolvedValue(originalReceipt) };
  const returnResult = {
    posReturn: makeReturn({ refundTotal }),
    salesReturn: { id: 'sr_1', returnNumber: 'SR-000001' },
    refundTotal,
  };
  const saleReceipt = makeReceipt({
    id: 'rcp_exchange_sale',
    receiptNumber: 'R-000002',
    salesInvoiceId: 'pos_sale_2',
    salesInvoiceNumber: 'R-000002',
    grandTotal: saleGrandTotal,
  });
  const saleResult = {
    receipt: saleReceipt,
    salesInvoiceId: 'pos_sale_2',
    salesInvoiceNumber: 'R-000002',
    change: 0,
  };
  const completeReturnUseCase = { execute: jest.fn().mockResolvedValue(returnResult) };
  const completeSaleUseCase = { execute: jest.fn().mockResolvedValue(saleResult) };
  const useCase = new CompletePosExchangeUseCase(
    receiptRepo as any,
    completeReturnUseCase as any,
    completeSaleUseCase as any
  );
  return { useCase, receiptRepo, completeReturnUseCase, completeSaleUseCase };
};

describe('CompletePosExchangeUseCase', () => {
  it('links the POS return and replacement sale with one exchange id', async () => {
    const { useCase, completeReturnUseCase, completeSaleUseCase } = setup(25, 20);

    const result = await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_original',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      returnLines: [{ itemId: 'item_a', qty: 1 }],
      saleLines: [{ itemId: 'item_b', qty: 1, unitPrice: 25 }],
      salePayments: [{ method: 'CASH', amount: 25 }],
      refundMethod: 'CASH',
      exchangeId: 'ex_test',
      actor: { userId: 'cashier_1' },
    });

    expect(completeReturnUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      exchangeId: 'ex_test',
      reason: 'POS exchange return',
    }));
    expect(completeSaleUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({
      exchangeId: 'ex_test',
      customerId: 'cust_original',
    }));
    expect(result.exchangeId).toBe('ex_test');
    expect(result.netDueFromCustomer).toBe(5);
    expect(result.netRefundToCustomer).toBe(0);
  });

  it('reports net refund when returned value is greater than replacement sale', async () => {
    const { useCase } = setup(15, 20);

    const result = await useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_original',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      returnLines: [{ itemId: 'item_a', qty: 1 }],
      saleLines: [{ itemId: 'item_c', qty: 1, unitPrice: 15 }],
      salePayments: [{ method: 'CASH', amount: 15 }],
      refundMethod: 'CASH',
      exchangeId: 'ex_refund',
      actor: { userId: 'cashier_1' },
    });

    expect(result.netDueFromCustomer).toBe(0);
    expect(result.netRefundToCustomer).toBe(5);
  });

  it('rejects exchange without replacement payment rows', async () => {
    const { useCase, completeReturnUseCase } = setup();

    await expect(useCase.execute({
      companyId: 'cmp_test',
      originalReceiptId: 'rcp_original',
      registerId: 'reg_1',
      shiftId: 'shift_1',
      returnLines: [{ itemId: 'item_a', qty: 1 }],
      saleLines: [{ itemId: 'item_b', qty: 1, unitPrice: 25 }],
      salePayments: [],
      refundMethod: 'CASH',
      actor: { userId: 'cashier_1' },
    })).rejects.toThrow(/replacement sale requires payment rows/);

    expect(completeReturnUseCase.execute).not.toHaveBeenCalled();
  });
});
