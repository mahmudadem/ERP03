"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPurchaseSettingsRepository = void 0;
const PurchaseSettings_1 = require("../../../../domain/purchases/entities/PurchaseSettings");
class PrismaPurchaseSettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings(companyId) {
        const record = await this.prisma.purchaseSettings.findUnique({
            where: { companyId },
        });
        if (!record)
            return null;
        return PurchaseSettings_1.PurchaseSettings.fromJSON(record.settings);
    }
    async saveSettings(settings) {
        await this.prisma.purchaseSettings.upsert({
            where: { companyId: settings.companyId },
            create: {
                companyId: settings.companyId,
                settings: settings.toJSON(),
                company: { connect: { id: settings.companyId } },
            },
            update: {
                settings: settings.toJSON(),
            },
        });
    }
}
exports.PrismaPurchaseSettingsRepository = PrismaPurchaseSettingsRepository;
//# sourceMappingURL=PrismaPurchaseSettingsRepository.js.map