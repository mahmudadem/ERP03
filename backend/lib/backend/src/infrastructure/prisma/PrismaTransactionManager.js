"use strict";
/**
 * PrismaTransactionManager.ts
 *
 * SQL implementation of ITransactionManager using Prisma's $transaction()
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTransactionManager = void 0;
class PrismaTransactionManager {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async runTransaction(operation) {
        return this.prisma.$transaction(async (tx) => {
            return operation(tx);
        });
    }
}
exports.PrismaTransactionManager = PrismaTransactionManager;
//# sourceMappingURL=PrismaTransactionManager.js.map