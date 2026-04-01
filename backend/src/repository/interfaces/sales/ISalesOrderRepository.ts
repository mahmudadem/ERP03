import { SOStatus, SalesOrder } from '../../../domain/sales/entities/SalesOrder';

export interface SalesOrderListOptions {
  status?: SOStatus;
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface ISalesOrderRepository {
  create(so: SalesOrder, transaction?: unknown): Promise<void>;
  update(so: SalesOrder, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<SalesOrder | null>;
  getByNumber(companyId: string, orderNumber: string): Promise<SalesOrder | null>;
  list(companyId: string, opts?: SalesOrderListOptions): Promise<SalesOrder[]>;
  delete(companyId: string, id: string): Promise<void>;
}
