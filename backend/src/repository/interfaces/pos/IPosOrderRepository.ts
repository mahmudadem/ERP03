
import { POSOrder } from '../../../domain/pos/entities/POSOrder';

/**
 * Interface for Point of Sale Orders.
 */
export interface IPosOrderRepository {
  createOrder(order: POSOrder): Promise<void>;
  getOrder(id: string): Promise<POSOrder | null>;
  getCompanyOrders(companyId: string): Promise<POSOrder[]>;
}
