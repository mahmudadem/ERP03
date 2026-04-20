import { Uom } from '../../../domain/inventory/entities/Uom';

export interface UomListOptions {
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface IUomRepository {
  createUom(uom: Uom): Promise<void>;
  updateUom(id: string, data: Partial<Uom>): Promise<void>;
  getUom(id: string): Promise<Uom | null>;
  getCompanyUoms(companyId: string, opts?: UomListOptions): Promise<Uom[]>;
  getUomByCode(companyId: string, code: string): Promise<Uom | null>;
}
