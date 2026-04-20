"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaInventorySettingsRepository = void 0;
const InventorySettings_1 = require("../../../../domain/inventory/entities/InventorySettings");
class PrismaInventorySettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings(companyId) {
        const record = await this.prisma.inventorySettings.findUnique({
            where: { companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async saveSettings(settings) {
        const settingsJson = settings.toJSON();
        await this.prisma.inventorySettings.upsert({
            where: { companyId: settings.companyId },
            create: {
                companyId: settings.companyId,
                settings: settingsJson,
            },
            update: {
                settings: settingsJson,
            },
        });
    }
    toDomain(record) {
        const data = record.settings;
        return InventorySettings_1.InventorySettings.fromJSON(Object.assign({ companyId: record.companyId }, data));
    }
}
exports.PrismaInventorySettingsRepository = PrismaInventorySettingsRepository;
//# sourceMappingURL=PrismaInventorySettingsRepository.js.map