import { randomUUID } from 'crypto';
import { roundMoney } from '../../system-core/money/roundMoney';
import {
  CompletePosReturnInput,
  CompletePosReturnResult,
  CompletePosReturnUseCase,
  PosReturnLineInput,
} from './CompletePosReturnUseCase';
import {
  CompletePosSaleResult,
  CompletePosSaleUseCase,
  PosCartLine,
  PosCartPayment,
} from './CompletePosSaleUseCase';
import { PosReturnRefundMethod } from '../../../domain/pos/entities/PosReturn';
import { IPosReceiptRepository } from '../../../repository/interfaces/pos/IPosReceiptRepository';

export interface CompletePosExchangeInput {
  companyId: string;
  originalReceiptId: string;
  registerId: string;
  shiftId: string;
  customerId?: string;
  returnLines: PosReturnLineInput[];
  saleLines: PosCartLine[];
  salePayments: PosCartPayment[];
  refundMethod: PosReturnRefundMethod;
  reason?: string;
  managerOverrideId?: string;
  exchangeId?: string;
  actor: CompletePosReturnInput['actor'];
}

export interface CompletePosExchangeResult {
  exchangeId: string;
  posReturn: CompletePosReturnResult['posReturn'];
  saleReceipt: CompletePosSaleResult['receipt'];
  salesReturnId: string;
  salesReturnNumber: string;
  salesInvoiceId: string;
  salesInvoiceNumber: string;
  refundTotal: number;
  saleTotal: number;
  netDueFromCustomer: number;
  netRefundToCustomer: number;
}

/**
 * POS exchange = one POS return + one replacement POS sale linked by exchangeId.
 *
 * This deliberately avoids a new accounting document type. The return and sale
 * keep their normal stock, tax, COGS, settlement, and audit behavior while the
 * exchange id lets reports/receipts show that they belong to one customer event.
 */
export class CompletePosExchangeUseCase {
  constructor(
    private readonly receiptRepo: IPosReceiptRepository,
    private readonly completeReturnUseCase: CompletePosReturnUseCase,
    private readonly completeSaleUseCase: CompletePosSaleUseCase
  ) {}

  async execute(input: CompletePosExchangeInput): Promise<CompletePosExchangeResult> {
    if (!input.returnLines?.length) throw new Error('Exchange requires at least one returned line.');
    if (!input.saleLines?.length) throw new Error('Exchange requires at least one replacement sale line.');
    if (!input.salePayments?.length) throw new Error('Exchange replacement sale requires payment rows.');

    const originalReceipt = await this.receiptRepo.getById(input.companyId, input.originalReceiptId);
    if (!originalReceipt) throw new Error(`Receipt not found: ${input.originalReceiptId}`);
    const exchangeId = input.exchangeId || `ex_${randomUUID()}`;

    const returnResult = await this.completeReturnUseCase.execute({
      companyId: input.companyId,
      originalReceiptId: input.originalReceiptId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      lines: input.returnLines,
      refundMethod: input.refundMethod,
      reason: input.reason || 'POS exchange return',
      managerOverrideId: input.managerOverrideId,
      exchangeId,
      actor: input.actor,
    });

    const saleResult = await this.completeSaleUseCase.execute({
      companyId: input.companyId,
      registerId: input.registerId,
      shiftId: input.shiftId,
      customerId: input.customerId || originalReceipt.customerId,
      lines: input.managerOverrideId
        ? input.saleLines.map((line) => ({ ...line, managerOverrideId: line.managerOverrideId || input.managerOverrideId }))
        : input.saleLines,
      payments: input.salePayments,
      exchangeId,
      actor: input.actor,
    });

    const saleTotal = roundMoney(saleResult.receipt.grandTotal);
    const refundTotal = roundMoney(returnResult.refundTotal);
    const net = roundMoney(saleTotal - refundTotal);

    return {
      exchangeId,
      posReturn: returnResult.posReturn,
      saleReceipt: saleResult.receipt,
      salesReturnId: returnResult.salesReturn.id,
      salesReturnNumber: returnResult.salesReturn.returnNumber,
      salesInvoiceId: saleResult.salesInvoiceId,
      salesInvoiceNumber: saleResult.salesInvoiceNumber,
      refundTotal,
      saleTotal,
      netDueFromCustomer: Math.max(0, net),
      netRefundToCustomer: Math.max(0, roundMoney(-net)),
    };
  }
}
