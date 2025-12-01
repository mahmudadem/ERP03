"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PosDTOMapper = void 0;
class PosDTOMapper {
    static toShiftDTO(shift) {
        var _a;
        return {
            id: shift.id,
            userId: shift.userId,
            openedAt: shift.openedAt.toISOString(),
            closedAt: (_a = shift.closedAt) === null || _a === void 0 ? void 0 : _a.toISOString(),
            isOpen: shift.isOpen(),
        };
    }
    static toOrderDTO(order) {
        return {
            id: order.id,
            totalAmount: order.totalAmount,
            status: order.status,
            itemCount: order.items.length,
        };
    }
}
exports.PosDTOMapper = PosDTOMapper;
//# sourceMappingURL=PosDTOs.js.map