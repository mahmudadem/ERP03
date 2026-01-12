/**
 * PrismaVoucherRepository.ts
 * 
 * SQL implementation of IVoucherRepository using Prisma
 * 
 * TODO: This repository needs to be updated to use VoucherEntity (V2)
 * Currently stubbed out as the DI uses FirestoreVoucherRepositoryV2 only.
 * 
 * When SQL support is needed:
 * 1. Import VoucherEntity, VoucherLineEntity from domain
 * 2. Implement IVoucherRepository from domain/accounting/repositories
 * 3. Map between Prisma models and VoucherEntity
 */

import { PrismaClient } from '@prisma/client';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';

export class PrismaVoucherRepository implements IVoucherRepository {
  constructor(private prisma: PrismaClient) {}

  async save(voucher: VoucherEntity): Promise<VoucherEntity> {
    // TODO: Implement Prisma save using VoucherEntity.toJSON()
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findById(companyId: string, voucherId: string): Promise<VoucherEntity | null> {
    // TODO: Implement Prisma query and return VoucherEntity.fromJSON()
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findByType(companyId: string, type: VoucherType, limit?: number): Promise<VoucherEntity[]> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findByStatus(companyId: string, status: VoucherStatus, limit?: number): Promise<VoucherEntity[]> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findByDateRange(companyId: string, startDate: string, endDate: string, limit?: number): Promise<VoucherEntity[]> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findByCompany(companyId: string, limit?: number): Promise<VoucherEntity[]> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async delete(companyId: string, voucherId: string): Promise<boolean> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async existsByNumber(companyId: string, voucherNo: string): Promise<boolean> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async countByFormId(companyId: string, formId: string): Promise<number> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async findByReversalOfVoucherId(companyId: string, originalVoucherId: string): Promise<VoucherEntity | null> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }

  async countByCurrency(companyId: string, currencyCode: string): Promise<number> {
    throw new Error('PrismaVoucherRepository not yet implemented for V2. Use Firestore.');
  }
}
