"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSOrder = exports.POSOrderItem = void 0;
class POSOrderItem {
    constructor(itemId, name, qty, price, discount = 0) {
        this.itemId = itemId;
        this.name = name;
        this.qty = qty;
        this.price = price;
        this.discount = discount;
    }
    get total() {
        return (this.price * this.qty) - this.discount;
    }
}
exports.POSOrderItem = POSOrderItem;
class POSOrder {
    constructor(id, companyId, shiftId, items, totalAmount, createdAt, status) {
        this.id = id;
        this.companyId = companyId;
        this.shiftId = shiftId;
        this.items = items;
        this.totalAmount = totalAmount;
        this.createdAt = createdAt;
        this.status = status;
    }
}
exports.POSOrder = POSOrder;
//# sourceMappingURL=POSOrder.js.map