/**
 * prismaClient.ts
 * 
 * Singleton Prisma Client instance
 */

import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | null = null;

export const getPrismaClient = (): PrismaClient => {
    if (!prismaClient) {
        prismaClient = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        });
    }
    return prismaClient;
};

export const closePrismaClient = async (): Promise<void> => {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
    }
};
