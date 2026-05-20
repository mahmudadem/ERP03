import { describe, expect, it, jest } from '@jest/globals';
import { GetAgedBacklogUseCase } from '../../../application/sales/use-cases/AgedBacklogUseCase';
import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = 'cmp-aged-backlog-test';

// ---------------------------------------------------------------------------
// Helpers — minimal sales order shapes (not full SalesOrder instances;
// the use case only reads fields, not class methods)
// ---------------------------------------------------------------------------

function makeSO(overrides: {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  customerName?: string;
  status?: string;
  promisedDate?: string;
  grandTotalBase?: number;
}): any {
  return {
    id: overrides.id ?? `so-${Math.random()}`,
    companyId: COMPANY_ID,
    orderNumber: overrides.orderNumber ?? 'SO-00001',
    customerId: overrides.customerId ?? 'cust-1',
    customerName: overrides.customerName ?? 'Acme Corp',
    status: overrides.status ?? 'CONFIRMED',
    promisedDate: overrides.promisedDate,
    grandTotalBase: overrides.grandTotalBase ?? 1000,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeSalesOrderRepo(orders: any[]): jest.Mocked<ISalesOrderRepository> {
  return {
    create: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getById: jest.fn(async () => null),
    getByNumber: jest.fn(async () => null),
    list: jest.fn(async () => orders),
    hasOpenOrders: jest.fn(async () => false),
    delete: jest.fn(async () => {}),
  } as unknown as jest.Mocked<ISalesOrderRepository>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GetAgedBacklogUseCase', () => {
  const FIXED_AS_OF = '2026-05-20';

  it('returns only CONFIRMED orders past their promisedDate', async () => {
    const orders = [
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-10', orderNumber: 'SO-001' }),
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-25', orderNumber: 'SO-002' }), // future — excluded
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(1);
    expect(result[0].orderNumber).toBe('SO-001');
  });

  it('returns only PARTIALLY_DELIVERED orders past their promisedDate', async () => {
    const orders = [
      makeSO({ status: 'PARTIALLY_DELIVERED', promisedDate: '2026-05-01', orderNumber: 'SO-003' }),
      makeSO({ status: 'PARTIALLY_DELIVERED', promisedDate: '2026-06-01', orderNumber: 'SO-004' }), // future — excluded
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(1);
    expect(result[0].orderNumber).toBe('SO-003');
  });

  it('excludes orders with no promisedDate', async () => {
    const orders = [
      makeSO({ status: 'CONFIRMED', promisedDate: undefined, orderNumber: 'SO-005' }),
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-10', orderNumber: 'SO-006' }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(1);
    expect(result[0].orderNumber).toBe('SO-006');
  });

  it('excludes DRAFT orders even if past promisedDate', async () => {
    const orders = [
      makeSO({ status: 'DRAFT', promisedDate: '2026-05-01', orderNumber: 'SO-007' }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(0);
  });

  it('excludes FULLY_DELIVERED orders even if past promisedDate', async () => {
    const orders = [
      makeSO({ status: 'FULLY_DELIVERED', promisedDate: '2026-05-01', orderNumber: 'SO-008' }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(0);
  });

  it('excludes CLOSED and CANCELLED orders even if past promisedDate', async () => {
    const orders = [
      makeSO({ status: 'CLOSED', promisedDate: '2026-05-01', orderNumber: 'SO-009' }),
      makeSO({ status: 'CANCELLED', promisedDate: '2026-05-01', orderNumber: 'SO-010' }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(0);
  });

  it('computes daysOverdue correctly', async () => {
    const orders = [
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-10', orderNumber: 'SO-011' }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    // asOfDate = 2026-05-20, promisedDate = 2026-05-10 → 10 days overdue
    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result[0].daysOverdue).toBe(10);
  });

  it('sorts results by daysOverdue descending', async () => {
    const orders = [
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-15', orderNumber: 'SO-012', id: 'so-a' }), // 5 days overdue
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-05-01', orderNumber: 'SO-013', id: 'so-b' }), // 19 days overdue
      makeSO({ status: 'PARTIALLY_DELIVERED', promisedDate: '2026-05-10', orderNumber: 'SO-014', id: 'so-c' }), // 10 days overdue
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(3);
    expect(result[0].daysOverdue).toBe(19);
    expect(result[1].daysOverdue).toBe(10);
    expect(result[2].daysOverdue).toBe(5);
  });

  it('returns empty array when no orders are overdue', async () => {
    const orders = [
      makeSO({ status: 'CONFIRMED', promisedDate: '2026-06-01', orderNumber: 'SO-015' }), // future
      makeSO({ status: 'DRAFT', promisedDate: '2026-04-01', orderNumber: 'SO-016' }),     // wrong status
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(0);
  });

  it('includes all AgedBacklogRow fields in each row', async () => {
    const orders = [
      makeSO({
        id: 'so-full',
        status: 'CONFIRMED',
        promisedDate: '2026-05-13',
        orderNumber: 'SO-FULL',
        customerId: 'cust-x',
        customerName: 'Full Customer',
        grandTotalBase: 5000,
      }),
    ];
    const repo = makeSalesOrderRepo(orders);
    const useCase = new GetAgedBacklogUseCase(repo);

    const result = await useCase.execute({ companyId: COMPANY_ID, asOfDate: FIXED_AS_OF });

    expect(result).toHaveLength(1);
    const row = result[0];
    expect(row.salesOrderId).toBe('so-full');
    expect(row.orderNumber).toBe('SO-FULL');
    expect(row.customerId).toBe('cust-x');
    expect(row.customerName).toBe('Full Customer');
    expect(row.promisedDate).toBe('2026-05-13');
    expect(row.daysOverdue).toBe(7);
    expect(row.grandTotalBase).toBe(5000);
    expect(row.status).toBe('CONFIRMED');
  });
});
