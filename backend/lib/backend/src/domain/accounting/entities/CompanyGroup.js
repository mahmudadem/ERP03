"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyGroup = void 0;
class CompanyGroup {
    constructor(id, name, reportingCurrency, members, createdAt, createdBy) {
        this.id = id;
        this.name = name;
        this.reportingCurrency = reportingCurrency;
        this.members = members;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        if (!members || members.length < 2) {
            throw new Error('Company group must have at least two companies');
        }
    }
}
exports.CompanyGroup = CompanyGroup;
//# sourceMappingURL=CompanyGroup.js.map