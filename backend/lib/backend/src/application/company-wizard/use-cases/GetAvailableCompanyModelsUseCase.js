"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAvailableCompanyModelsUseCase = void 0;
class GetAvailableCompanyModelsUseCase {
    async execute() {
        return [
            { id: 'financial', labelEn: 'Financial / Accounting', labelAr: 'المالية / المحاسبة', labelTr: 'Finans / Muhasebe' },
            { id: 'inventory', labelEn: 'Inventory / Warehouses', labelAr: 'المخزون / المستودعات', labelTr: 'Stok / Depolar' },
            { id: 'pos', labelEn: 'Point of Sale', labelAr: 'نقاط البيع', labelTr: 'Satış Noktası' },
            { id: 'manufacturing', labelEn: 'Manufacturing', labelAr: 'التصنيع', labelTr: 'Üretim' },
            { id: 'hr', labelEn: 'Human Resources', labelAr: 'الموارد البشرية', labelTr: 'İK' },
        ];
    }
}
exports.GetAvailableCompanyModelsUseCase = GetAvailableCompanyModelsUseCase;
//# sourceMappingURL=GetAvailableCompanyModelsUseCase.js.map