"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPermissionRepository = void 0;
class PrismaPermissionRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDomain(data) {
        return {
            id: data.id,
            category: data.module || '',
            labelEn: data.description || data.code || '',
            labelAr: data.description || data.code || '',
            labelTr: data.description || data.code || '',
            descriptionEn: data.description || undefined,
            descriptionAr: undefined,
            descriptionTr: undefined,
        };
    }
    async getAll() {
        const data = await this.prisma.permission.findMany({
            orderBy: { code: 'asc' },
        });
        return data.map((d) => this.toDomain(d));
    }
    async getById(id) {
        const data = await this.prisma.permission.findUnique({
            where: { id },
        });
        if (!data)
            return null;
        return this.toDomain(data);
    }
    async create(permission) {
        await this.prisma.permission.create({
            data: {
                id: permission.id,
                code: permission.category,
                description: permission.descriptionEn || null,
            },
        });
    }
    async update(id, permission) {
        const updateData = {};
        if (permission.category !== undefined)
            updateData.code = permission.category;
        if (permission.descriptionEn !== undefined)
            updateData.description = permission.descriptionEn;
        if (permission.labelEn !== undefined)
            updateData.description = permission.labelEn;
        await this.prisma.permission.update({
            where: { id },
            data: updateData,
        });
    }
    async delete(id) {
        await this.prisma.permission.delete({
            where: { id },
        });
    }
}
exports.PrismaPermissionRepository = PrismaPermissionRepository;
//# sourceMappingURL=PrismaPermissionRepository.js.map