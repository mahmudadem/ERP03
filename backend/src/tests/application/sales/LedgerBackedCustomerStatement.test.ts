import { describe, expect, it, jest } from '@jest/globals';
import {
  CustomerStatementMissingAccountError,
  GetLedgerBackedCustomerStatementUseCase,
} from '../../../application/sales/use-cases/ReceivablesReportingUseCases';
import { GetAccountStatementUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';
import { ISalesInvoiceRepository } from '../../../repository/interfaces/sales/ISalesInvoiceRepository';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';

const companyId = 'cmp-ledger-statement';
const customerId = 'cust-1';

const partyRepo = (party: any): jest.Mocked<IPartyRepository> =>
  ({
    getById: jest.fn(async () => party),
    list: jest.fn(async () => []),
  } as unknown as jest.Mocked<IPartyRepository>);

const invoiceRepo = (invoices: any[] = []): jest.Mocked<ISalesInvoiceRepository> =>
  ({
    list: jest.fn(async () => invoices),
  } as unknown as jest.Mocked<ISalesInvoiceRepository>);

const orderRepo = (orders: any[] = []): jest.Mocked<ISalesOrderRepository> =>
  ({
    list: jest.fn(async () => orders),
  } as unknown as jest.Mocked<ISalesOrderRepository>);

const voucherRepo = (vouchers: Record<string, any>): jest.Mocked<IVoucherRepository> =>
  ({
    findById: jest.fn(async (_companyId: string, voucherId: string) => vouchers[voucherId] ?? null),
  } as unknown as jest.Mocked<IVoucherRepository>);

const accountStatement = (data: any): GetAccountStatementUseCase =>
  ({
    execute: jest.fn(async () => data),
  } as unknown as GetAccountStatementUseCase);

describe('GetLedgerBackedCustomerStatementUseCase', () => {
  it('throws a 412-ready error when the customer has no default AR account', async () => {
    const useCase = new GetLedgerBackedCustomerStatementUseCase(
      partyRepo({ id: customerId, displayName: 'Acme', legalName: 'Acme' }),
      invoiceRepo(),
      orderRepo(),
      accountStatement({ entries: [] }),
      voucherRepo({}),
    );

    await expect(useCase.execute({
      companyId,
      userId: 'u-1',
      customerId,
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    })).rejects.toBeInstanceOf(CustomerStatementMissingAccountError);
  });

  it('uses the AR account statement as source of truth and decorates rows from voucher metadata', async () => {
    const statementUseCase = accountStatement({
      accountId: 'ar-cust-1',
      accountCode: '104-C001',
      accountName: 'AR - Acme',
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
      openingBalance: 100,
      closingBalance: 850,
      totalDebit: 1000,
      totalCredit: 250,
      entries: [
        {
          id: 'le-inv',
          date: '2026-05-05',
          voucherId: 'v-inv',
          voucherNo: 'SI-1001',
          description: 'Sales invoice',
          debit: 1000,
          credit: 0,
          balance: 1100,
        },
        {
          id: 'le-ret',
          date: '2026-05-10',
          voucherId: 'v-ret',
          voucherNo: 'SR-1001',
          description: 'Sales return',
          debit: 0,
          credit: 250,
          balance: 850,
        },
      ],
    });

    const useCase = new GetLedgerBackedCustomerStatementUseCase(
      partyRepo({ id: customerId, displayName: 'Acme', legalName: 'Acme LLC', defaultARAccountId: 'ar-cust-1' }),
      invoiceRepo([{ id: 'si-1', invoiceNumber: 'SI-1001', invoiceDate: '2026-05-05', dueDate: undefined, grandTotalBase: 1000, outstandingAmountBase: 750 }]),
      orderRepo([{ id: 'so-1', orderNumber: 'SO-1', orderDate: '2026-05-01', expectedDeliveryDate: '2026-05-20', status: 'CONFIRMED', grandTotalBase: 300, notes: '', lines: [{ orderedQty: 3, invoicedQty: 1, lineTotalBase: 300, taxAmountBase: 0 }] }]),
      statementUseCase,
      voucherRepo({
        'v-inv': {
          id: 'v-inv',
          voucherNo: 'SI-1001',
          type: VoucherType.SALES_INVOICE,
          reference: 'SI-1001',
          formId: 'sales-invoice-form',
          metadata: { sourceModule: 'sales', sourceType: 'SALES_INVOICE', sourceId: 'si-1', voucherPart: 'REVENUE' },
        },
        'v-ret': {
          id: 'v-ret',
          voucherNo: 'SR-1001',
          type: VoucherType.SALES_RETURN,
          reference: 'SR-1001',
          metadata: { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: 'sr-1', voucherPart: 'CREDIT_NOTE' },
        },
      }),
    );

    const result = await useCase.execute({
      companyId,
      userId: 'u-1',
      customerId,
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
      includeOpenCommitments: true,
    });

    expect((statementUseCase as any).execute).toHaveBeenCalledWith(
      companyId,
      'u-1',
      'ar-cust-1',
      '2026-05-01',
      '2026-05-31',
      { includeUnposted: false },
    );
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(850);
    expect(result.totalInvoiced).toBe(1000);
    expect(result.totalCredited).toBe(250);
    expect(result.lines[0]).toMatchObject({
      type: 'INVOICE',
      sourceModule: 'sales',
      sourceType: 'SALES_INVOICE',
      sourceId: 'si-1',
      voucherId: 'v-inv',
    });
    expect(result.lines[1]).toMatchObject({
      type: 'CREDIT_NOTE',
      sourceType: 'SALES_RETURN',
      sourceId: 'sr-1',
    });
    expect(result.openCommitments?.[0]).toMatchObject({
      sourceType: 'SALES_ORDER',
      sourceId: 'so-1',
      openAmountBase: 200,
    });
  });
});
