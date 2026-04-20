/**
 * PrismaTransactionManager.ts
 * 
 * SQL implementation of ITransactionManager using Prisma's $transaction()
 */

import { PrismaClient } from '@prisma/client';
import { ITransactionManager } from '../../repository/interfaces/shared/ITransactionManager';

export class PrismaTransactionManager implements ITransactionManager {
  constructor(private prisma: PrismaClient) {}

  async runTransaction<T>(operation: (transaction: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return operation(tx);
    });
  }
}
