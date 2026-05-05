"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPaymentHistoryRepository = void 0;
const PaymentHistory_1 = require("../../../../domain/shared/entities/PaymentHistory");
class PrismaPaymentHistoryRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(payment, transaction) {
        const prisma = transaction || this.prisma;
        await prisma.paymentHistory.create({
            data: {
                id: payment.id,
                companyId: payment.companyId,
                sourceType: payment.sourceType,
                sourceId: payment.sourceId,
                sourceNumber: payment.sourceNumber,
                amountBase: payment.amountBase,
                currency: payment.currency,
                exchangeRate: payment.exchangeRate,
                amountDoc: payment.amountDoc,
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                reference: payment.reference,
                notes: payment.notes,
                voucherId: payment.voucherId,
                createdBy: payment.createdBy,
                createdAt: payment.createdAt,
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.paymentHistory.findFirst({
            where: { id, companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getBySource(companyId, sourceType, sourceId) {
        const records = await this.prisma.paymentHistory.findMany({
            where: { companyId, sourceType, sourceId },
            orderBy: { paymentDate: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a;
        return PaymentHistory_1.PaymentHistory.fromJSON({
            id: record.id,
            companyId: record.companyId,
            sourceType: record.sourceType,
            sourceId: record.sourceId,
            sourceNumber: record.sourceNumber,
            amountBase: record.amountBase,
            currency: record.currency,
            exchangeRate: record.exchangeRate,
            amountDoc: record.amountDoc,
            paymentDate: record.paymentDate,
            paymentMethod: record.paymentMethod,
            reference: record.reference || undefined,
            notes: record.notes || undefined,
            voucherId: (_a = record.voucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
        });
    }
}
exports.PrismaPaymentHistoryRepository = PrismaPaymentHistoryRepository;
//# sourceMappingURL=PrismaPaymentHistoryRepository.js.map