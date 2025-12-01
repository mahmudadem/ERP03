"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovement = void 0;
class StockMovement {
    constructor(id, companyId, itemId, warehouseId, qty, direction, referenceType, referenceId, date) {
        this.id = id;
        this.companyId = companyId;
        this.itemId = itemId;
        this.warehouseId = warehouseId;
        this.qty = qty;
        this.direction = direction;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.date = date;
    }
}
exports.StockMovement = StockMovement;
//# sourceMappingURL=StockMovement.js.map