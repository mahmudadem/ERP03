"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostCenter = exports.CostCenterStatus = void 0;
var CostCenterStatus;
(function (CostCenterStatus) {
    CostCenterStatus["ACTIVE"] = "ACTIVE";
    CostCenterStatus["INACTIVE"] = "INACTIVE";
})(CostCenterStatus = exports.CostCenterStatus || (exports.CostCenterStatus = {}));
class CostCenter {
    constructor(id, companyId, name, code, description = null, parentId = null, status = CostCenterStatus.ACTIVE, createdAt = new Date(), createdBy = '', updatedAt = new Date(), updatedBy = '') {
        this.id = id;
        this.companyId = companyId;
        this.name = name;
        this.code = code;
        this.description = description;
        this.parentId = parentId;
        this.status = status;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
    }
    validate() {
        const errors = [];
        if (!this.code || this.code.trim().length === 0)
            errors.push('Code is required');
        if (!this.name || this.name.trim().length === 0)
            errors.push('Name is required');
        if (this.code && this.code.length > 20)
            errors.push('Code must be 20 characters or less');
        return errors;
    }
    isActive() {
        return this.status === CostCenterStatus.ACTIVE;
    }
    deactivate(updatedBy) {
        this.status = CostCenterStatus.INACTIVE;
        this.updatedBy = updatedBy;
        this.updatedAt = new Date();
    }
    activate(updatedBy) {
        this.status = CostCenterStatus.ACTIVE;
        this.updatedBy = updatedBy;
        this.updatedAt = new Date();
    }
}
exports.CostCenter = CostCenter;
//# sourceMappingURL=CostCenter.js.map