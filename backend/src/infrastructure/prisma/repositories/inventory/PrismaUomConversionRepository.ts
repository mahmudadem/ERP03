import { Prisma, PrismaClient } from '@prisma/client';
import { IUomConversionRepository, UomConversionListOptions } from '../../../../repository/interfaces/inventory/IUomConversionRepository';
import { UomConversion } from '../../../../domain/inventory/entities/UomConversion';

export class PrismaUomConversionRepository implements IUomConversionRepository {
  constructor(private prisma: PrismaClient) {}

  async createConversion(conversion: UomConversion): Promise<void> {
    await this.prisma.uomConversion.create({
      data: {
        id: conversion.id,
        companyId: conversion.companyId,
        fromUomId: conversion.fromUomId || conversion.fromUom,
        toUomId: conversion.toUomId || conversion.toUom,
        factor: conversion.factor,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(conversion).itemId !== undefined && { itemId: (conversion).itemId },
        ...(conversion).active !== undefined && { active: (conversion).active },
      },
    });
  }

  async updateConversion(id: string, data: Partial<UomConversion>): Promise<void> {
    const patch: Prisma.UomConversionUncheckedUpdateInput = {};
    if (data.factor !== undefined) patch.factor = data.factor;
    if (data.active !== undefined) patch.active = data.active;
    if (data.itemId !== undefined) patch.itemId = data.itemId;
    if (data.fromUomId !== undefined) patch.fromUomId = data.fromUomId;
    if (data.toUomId !== undefined) patch.toUomId = data.toUomId;
    await this.prisma.uomConversion.update({
      where: { id },
      data: patch,
    });
  }

  async getConversion(id: string): Promise<UomConversion | null> {
    const record = await this.prisma.uomConversion.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async getConversionsForItem(companyId: string, itemId: string, opts?: UomConversionListOptions): Promise<UomConversion[]> {
    const where: Prisma.UomConversionWhereInput = { companyId, itemId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.uomConversion.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async getCompanyConversions(companyId: string, opts?: UomConversionListOptions): Promise<UomConversion[]> {
    const where: Prisma.UomConversionWhereInput = { companyId };
    if (opts?.active !== undefined) {
      where.active = opts.active;
    }
    const records = await this.prisma.uomConversion.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: opts?.limit,
      skip: opts?.offset,
    });
    return records.map((r) => this.toDomain(r));
  }

  async deleteConversion(id: string): Promise<void> {
    await this.prisma.uomConversion.delete({
      where: { id },
    });
  }

  private toDomain(record: any): UomConversion {
    return new UomConversion({
      id: record.id,
      companyId: record.companyId,
      itemId: (record).itemId ?? record.fromUomId,
      fromUomId: record.fromUomId,
      fromUom: (record).fromUom ?? record.fromUomId,
      toUomId: record.toUomId,
      toUom: (record).toUom ?? record.toUomId,
      factor: record.factor,
      active: (record).active ?? true,
    });
  }
}
