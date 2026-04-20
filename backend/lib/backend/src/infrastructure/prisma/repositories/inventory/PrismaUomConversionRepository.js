"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaUomConversionRepository = void 0;
const UomConversion_1 = require("../../../../domain/inventory/entities/UomConversion");
class PrismaUomConversionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createConversion(conversion) {
        await this.prisma.uomConversion.create({
            data: Object.assign(Object.assign({ id: conversion.id, companyId: conversion.companyId, fromUomId: conversion.fromUomId || conversion.fromUom, toUomId: conversion.toUomId || conversion.toUom, factor: conversion.factor, createdAt: new Date(), updatedAt: new Date() }, conversion.itemId !== undefined && { itemId: conversion.itemId }), conversion.active !== undefined && { active: conversion.active }),
        });
    }
    async updateConversion(id, data) {
        await this.prisma.uomConversion.update({
            where: { id },
            data: data,
        });
    }
    async getConversion(id) {
        const record = await this.prisma.uomConversion.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getConversionsForItem(companyId, itemId, opts) {
        const where = { companyId, itemId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.uomConversion.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getCompanyConversions(companyId, opts) {
        const where = { companyId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.uomConversion.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteConversion(id) {
        await this.prisma.uomConversion.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d;
        return new UomConversion_1.UomConversion({
            id: record.id,
            companyId: record.companyId,
            itemId: (_a = record.itemId) !== null && _a !== void 0 ? _a : record.fromUomId,
            fromUomId: record.fromUomId,
            fromUom: (_b = record.fromUom) !== null && _b !== void 0 ? _b : record.fromUomId,
            toUomId: record.toUomId,
            toUom: (_c = record.toUom) !== null && _c !== void 0 ? _c : record.toUomId,
            factor: record.factor,
            active: (_d = record.active) !== null && _d !== void 0 ? _d : true,
        });
    }
}
exports.PrismaUomConversionRepository = PrismaUomConversionRepository;
//# sourceMappingURL=PrismaUomConversionRepository.js.map