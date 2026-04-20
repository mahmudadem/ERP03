"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPosShiftRepository = void 0;
const POSShift_1 = require("../../../../domain/pos/entities/POSShift");
class PrismaPosShiftRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async openShift(shift) {
        await this.prisma.posShift.create({
            data: {
                id: shift.id,
                companyId: shift.companyId,
                userId: shift.userId,
                openedAt: shift.openedAt,
                openingBalance: shift.openingBalance,
            },
        });
    }
    async closeShift(id, closedAt, closingBalance) {
        await this.prisma.posShift.update({
            where: { id },
            data: {
                closedAt,
                closingBalance,
            },
        });
    }
    async getShift(id) {
        const record = await this.prisma.posShift.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyShifts(companyId) {
        const records = await this.prisma.posShift.findMany({
            where: { companyId },
            orderBy: { openedAt: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b;
        return new POSShift_1.POSShift(record.id, record.companyId, record.userId, record.openedAt, record.openingBalance, (_a = record.closedAt) !== null && _a !== void 0 ? _a : undefined, (_b = record.closingBalance) !== null && _b !== void 0 ? _b : undefined);
    }
}
exports.PrismaPosShiftRepository = PrismaPosShiftRepository;
//# sourceMappingURL=PrismaPosShiftRepository.js.map