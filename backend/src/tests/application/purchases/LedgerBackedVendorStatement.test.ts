import { describe, expect, it, jest } from '@jest/globals';
import { GetAccountStatementUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import {
  GetLedgerBackedVendorStatementUseCase,
  VendorStatementMissingAccountError,
} from '../../../application/purchases/use-cases/PurchasesReportingUseCases';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IPurchaseInvoiceRepository } from '../../../repository/interfaces/purchases/IPurchaseInvoiceRepository';
import { IPurchaseOrderRepository } from '../../../repository/interfaces/purchases/IPurchaseOrderRepository';
import { IPartyRepository } from '../../../repository/interfaces/shared/IPartyRepository';

const companyId = 'cmp-vendor-statement';
const vendorId = 'vendor-1';

const partyRepo = (party: any): jest.Mocked<IPartyRepository> =>
  ({
    getById: jest.fn(async () => party),
    list: jest.fn(async () => []),
  } as unknown as jest.Mocked<IPartyRepository>);

const invoiceRepo = (invoices: any[] = []): jest.Mocked<IPurchaseInvoiceRepository> =>
  ({
    list: jest.fn(async () => invoices),
  } as unknown as jest.Mocked<IPurchaseInvoiceRepository>);

const orderRepo = (orders: any[] = []): jest.Mocked<IPurchaseOrderRepository> =>
  ({
    list: jest.fn(async () => orders),
  } as unknown as jest.Mocked<IPurchaseOrderRepository>);

const voucherRepo = (vouchers: Record<string, any>): jest.Mocked<IVoucherRepository> =>
  ({
    findById: jest.fn(async (_companyId: string, voucherId: string) => vouchers[voucherId] ?? null),
  } as unknown as jest.Mocked<IVoucherRepository>);

const accountStatement = (data: any): GetAccountStatementUseCase =>
  ({
    execute: jest.fn(async () => data),
  } as unknown as GetAccountStatementUseCase);

describe('GetLedgerBackedVendorStatementUseCase', () => {
  it('throws a 412-ready error when the vendor has no default AP account', async () => {
    const useCase = new GetLedgerBackedVendorStatementUseCase(
      partyRepo({ id: vendorId, displayName: 'Supply Co', legalName: 'Supply Co' }),
      invoiceRepo(),
      orderRepo(),
      accountStatement({ entries: [] }),
      voucherRepo({}),
    );

    await expect(useCase.execute({
      companyId,
      userId: 'u-1',
      vendorId,
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    })).rejects.toBeInstanceOf(VendorStatementMissingAccountError);
  });

  it('uses the AP account statement as source of truth and normalizes AP balance sign', async () => {
    const statementUseCase = accountStatement({
      accountId: 'ap-vendor-1',
      accountCode: '201-V001',
      accountName: 'AP - Supply Co',
      openingBalance: -100,
      closingBalance: -650,
      totalDebit: 250,
      totalCredit: 800,
      entries: [
        {
          id: 'le-pi',
          date: '2026-05-05',
          voucherId: 'v-pi',
          voucherNo: 'PI-1001',
          description: 'Purchase invoice',
          debit: 0,
          credit: 800,
          balance: -900,
        },
        {
          id: 'le-pay',
          date: '2026-05-15',
          voucherId: 'v-pay',
          voucherNo: 'PV-1001',
          description: 'Payment',
          debit: 250,
          credit: 0,
          balance: -650,
        },
      ],
    });

    const useCase = new GetLedgerBackedVendorStatementUseCase(
      partyRepo({ id: vendorId, displayName: 'Supply Co', legalName: 'Supply Co LLC', defaultAPAccountId: 'ap-vendor-1' }),
      invoiceRepo([{ id: 'pi-1', invoiceNumber: 'PI-1001', vendorInvoiceNumber: 'SUP-9', invoiceDate: '2026-05-05', dueDate: undefined, grandTotalBase: 800, outstandingAmountBase: 550 }]),
      orderRepo([{ id: 'po-1', orderNumber: 'PO-1', orderDate: '2026-05-01', expectedDeliveryDate: '2026-05-20', status: 'CONFIRMED', grandTotalBase: 300, notes: '', lines: [{ orderedQty: 3, invoicedQty: 1, lineTotalBase: 300, taxAmountBase: 0 }] }]),
      statementUseCase,
      voucherRepo({
        'v-pi': {
          id: 'v-pi',
          voucherNo: 'PI-1001',
          type: VoucherType.PURCHASE_INVOICE,
          reference: 'PI-1001',
          formId: 'purchase-invoice-form',
          metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: 'pi-1' },
        },
        'v-pay': {
          id: 'v-pay',
          voucherNo: 'PV-1001',
          type: VoucherType.PAYMENT,
          reference: 'PV-1001',
          metadata: { sourceModule: 'purchases', sourceInvoiceId: 'pi-1', settlementMode: 'CASH_FULL' },
        },
      }),
    );

    const result = await useCase.execute({
      companyId,
      userId: 'u-1',
      vendorId,
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
      includeOpenCommitments: true,
    });

    expect((statementUseCase as any).execute).toHaveBeenCalledWith(
      companyId,
      'u-1',
      'ap-vendor-1',
      '2026-05-01',
      '2026-05-31',
      { includeUnposted: false },
    );
    expect(result.openingBalance).toBe(100);
    expect(result.closingBalance).toBe(650);
    expect(result.totalBilled).toBe(800);
    expect(result.totalPaid).toBe(250);
    expect(result.lines[0]).toMatchObject({
      type: 'BILL',
      runningBalance: 900,
      sourceModule: 'purchases',
      sourceType: 'PURCHASE_INVOICE',
      sourceId: 'pi-1',
      voucherId: 'v-pi',
    });
    expect(result.lines[1]).toMatchObject({
      type: 'PAYMENT',
      runningBalance: 650,
      sourceType: 'PURCHASE_INVOICE',
      sourceId: 'pi-1',
    });
    expect(result.openCommitments?.[0]).toMatchObject({
      sourceType: 'PURCHASE_ORDER',
      sourceId: 'po-1',
      openAmountBase: 200,
    });
  });
});
