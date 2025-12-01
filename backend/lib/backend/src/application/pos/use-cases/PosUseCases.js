"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePOSOrderUseCase = exports.ClosePOSShiftUseCase = exports.OpenPOSShiftUseCase = void 0;
const POSShift_1 = require("../../../domain/pos/entities/POSShift");
const POSOrder_1 = require("../../../domain/pos/entities/POSOrder");
class OpenPOSShiftUseCase {
    constructor(shiftRepo) {
        this.shiftRepo = shiftRepo;
    }
    async execute(data) {
        const shift = new POSShift_1.POSShift(`shift_${Date.now()}`, data.companyId, data.userId, new Date(), data.openingBalance);
        await this.shiftRepo.openShift(shift);
        return shift;
    }
}
exports.OpenPOSShiftUseCase = OpenPOSShiftUseCase;
class ClosePOSShiftUseCase {
    constructor(shiftRepo) {
        this.shiftRepo = shiftRepo;
    }
    async execute(id, closingBalance) {
        await this.shiftRepo.closeShift(id, new Date(), closingBalance);
    }
}
exports.ClosePOSShiftUseCase = ClosePOSShiftUseCase;
class CreatePOSOrderUseCase {
    constructor(orderRepo) {
        this.orderRepo = orderRepo;
    }
    async execute(data) {
        const order = new POSOrder_1.POSOrder(`ord_${Date.now()}`, data.companyId, data.shiftId, data.items, data.total, // Should be calculated in real app
        new Date(), 'COMPLETED');
        await this.orderRepo.createOrder(order);
        return order;
    }
}
exports.CreatePOSOrderUseCase = CreatePOSOrderUseCase;
//# sourceMappingURL=PosUseCases.js.map