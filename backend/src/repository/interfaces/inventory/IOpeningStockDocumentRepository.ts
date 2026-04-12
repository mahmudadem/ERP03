import {
  OpeningStockDocument,
  OpeningStockDocumentStatus,
} from '../../../domain/inventory/entities/OpeningStockDocument';

export interface OpeningStockDocumentListOptions {
  limit?: number;
  offset?: number;
}

export interface IOpeningStockDocumentRepository {
  createDocument(document: OpeningStockDocument, transaction?: unknown): Promise<void>;
  updateDocument(
    companyId: string,
    id: string,
    data: Partial<OpeningStockDocument>,
    transaction?: unknown
  ): Promise<void>;
  getDocument(id: string): Promise<OpeningStockDocument | null>;
  getCompanyDocuments(
    companyId: string,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]>;
  getByStatus(
    companyId: string,
    status: OpeningStockDocumentStatus,
    opts?: OpeningStockDocumentListOptions
  ): Promise<OpeningStockDocument[]>;
  deleteDocument(id: string): Promise<void>;
}
