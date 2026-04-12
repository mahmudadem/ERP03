import { DNStatus, DeliveryNote } from '../../../domain/sales/entities/DeliveryNote';

export interface DeliveryNoteListOptions {
  salesOrderId?: string;
  status?: DNStatus;
  limit?: number;
}

export interface IDeliveryNoteRepository {
  create(dn: DeliveryNote, transaction?: unknown): Promise<void>;
  update(dn: DeliveryNote, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<DeliveryNote | null>;
  getByNumber(companyId: string, dnNumber: string): Promise<DeliveryNote | null>;
  list(companyId: string, opts?: DeliveryNoteListOptions): Promise<DeliveryNote[]>;
}
