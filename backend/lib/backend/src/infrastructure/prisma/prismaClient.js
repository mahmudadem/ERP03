"use strict";
/**
 * prismaClient.ts
 *
 * Singleton Prisma Client instance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePrismaClient = exports.getPrismaClient = void 0;
const client_1 = require("@prisma/client");
let prismaClient = null;
const getPrismaClient = () => {
    if (!prismaClient) {
        prismaClient = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }
    return prismaClient;
};
exports.getPrismaClient = getPrismaClient;
const closePrismaClient = async () => {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
    }
};
exports.closePrismaClient = closePrismaClient;
//# sourceMappingURL=prismaClient.js.map