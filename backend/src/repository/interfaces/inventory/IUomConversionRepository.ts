import { UomConversion } from '../../../domain/inventory/entities/UomConversion';

export interface UomConversionListOptions {
  limit?: number;
  offset?: number;
  active?: boolean;
}

export interface IUomConversionRepository {
  createConversion(conversion: UomConversion): Promise<void>;
  updateConversion(id: string, data: Partial<UomConversion>): Promise<void>;
  getConversion(id: string): Promise<UomConversion | null>;
  getConversionsForItem(companyId: string, itemId: string, opts?: UomConversionListOptions): Promise<UomConversion[]>;
  getCompanyConversions(companyId: string, opts?: UomConversionListOptions): Promise<UomConversion[]>;
  deleteConversion(id: string): Promise<void>;
}
