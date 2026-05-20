import { ISalesOrderRepository } from '../../../repository/interfaces/sales/ISalesOrderRepository';

export interface AgedBacklogRow {
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  promisedDate: string;
  daysOverdue: number;
  grandTotalBase: number;
  status: string;
}

export interface GetAgedBacklogInput {
  companyId: string;
  /** YYYY-MM-DD — defaults to today */
  asOfDate?: string;
}

/** Return today as YYYY-MM-DD */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole days between promisedDate and asOfDate (asOfDate - promisedDate). */
function daysBetween(promisedDate: string, asOfDate: string): number {
  const ms = new Date(asOfDate).getTime() - new Date(promisedDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export class GetAgedBacklogUseCase {
  constructor(private readonly salesOrderRepo: ISalesOrderRepository) {}

  async execute(input: GetAgedBacklogInput): Promise<AgedBacklogRow[]> {
    const asOfDate = input.asOfDate ?? todayISO();

    const allOrders = await this.salesOrderRepo.list(input.companyId);

    const rows: AgedBacklogRow[] = allOrders
      .filter((so) => {
        if (so.status !== 'CONFIRMED' && so.status !== 'PARTIALLY_DELIVERED') return false;
        if (!so.promisedDate) return false;
        if (so.promisedDate >= asOfDate) return false;
        return true;
      })
      .map((so) => ({
        salesOrderId: so.id,
        orderNumber: so.orderNumber,
        customerId: so.customerId,
        customerName: so.customerName,
        promisedDate: so.promisedDate as string,
        daysOverdue: daysBetween(so.promisedDate as string, asOfDate),
        grandTotalBase: so.grandTotalBase,
        status: so.status,
      }));

    rows.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return rows;
  }
}
