"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetMovementHistoryUseCase = void 0;
class GetMovementHistoryUseCase {
    constructor(movementRepo) {
        this.movementRepo = movementRepo;
    }
    async execute(companyId, filters = {}) {
        const opts = {
            limit: filters.limit,
            offset: filters.offset,
        };
        if (filters.itemId) {
            return this.movementRepo.getItemMovements(companyId, filters.itemId, opts);
        }
        if (filters.warehouseId) {
            return this.movementRepo.getWarehouseMovements(companyId, filters.warehouseId, opts);
        }
        if (filters.referenceType && filters.referenceId) {
            return this.movementRepo.getMovementsByReference(companyId, filters.referenceType, filters.referenceId);
        }
        if (filters.from && filters.to) {
            return this.movementRepo.getMovementsByDateRange(companyId, filters.from, filters.to, opts);
        }
        return this.movementRepo.getMovementsByDateRange(companyId, '1900-01-01', '2999-12-31', opts);
    }
    async getByItem(companyId, itemId, limit, offset) {
        return this.movementRepo.getItemMovements(companyId, itemId, { limit, offset });
    }
}
exports.GetMovementHistoryUseCase = GetMovementHistoryUseCase;
//# sourceMappingURL=MovementHistoryUseCases.js.map