import { CompanyModel } from '../../../domain/company-wizard';

export class GetAvailableCompanyModelsUseCase {
  async execute(): Promise<Array<{ id: CompanyModel; labelEn: string; labelAr: string; labelTr: string }>> {
    return [
      { id: 'financial', labelEn: 'Financial / Accounting', labelAr: 'المالية / المحاسبة', labelTr: 'Finans / Muhasebe' },
      { id: 'inventory', labelEn: 'Inventory / Warehouses', labelAr: 'المخزون / المستودعات', labelTr: 'Stok / Depolar' },
      { id: 'pos', labelEn: 'Point of Sale', labelAr: 'نقاط البيع', labelTr: 'Satış Noktası' },
      { id: 'manufacturing', labelEn: 'Manufacturing', labelAr: 'التصنيع', labelTr: 'Üretim' },
      { id: 'hr', labelEn: 'Human Resources', labelAr: 'الموارد البشرية', labelTr: 'İK' },
    ];
  }
}
