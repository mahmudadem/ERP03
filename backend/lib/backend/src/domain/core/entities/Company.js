"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Company = void 0;
class Company {
    constructor(id, name, ownerId, createdAt, updatedAt, baseCurrency, fiscalYearStart, fiscalYearEnd, modules, 
    // Legacy support for MVP
    taxId, address) {
        this.id = id;
        this.name = name;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.baseCurrency = baseCurrency;
        this.fiscalYearStart = fiscalYearStart;
        this.fiscalYearEnd = fiscalYearEnd;
        this.modules = modules;
        this.taxId = taxId;
        this.address = address;
    }
    isModuleEnabled(moduleName) {
        return this.modules.includes(moduleName);
    }
    isValid() {
        return this.name.length > 0 && this.ownerId.length > 0;
    }
}
exports.Company = Company;
//# sourceMappingURL=Company.js.map