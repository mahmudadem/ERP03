"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaSalesSettingsRepository = void 0;
const SalesSettings_1 = require("../../../../domain/sales/entities/SalesSettings");
class PrismaSalesSettingsRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings(companyId) {
        const record = await this.prisma.salesSettings.findUnique({
            where: { companyId },
        });
        if (!record)
            return null;
        return SalesSettings_1.SalesSettings.fromJSON(record.settings);
    }
    async saveSettings(settings, transaction) {
        const tx = transaction || this.prisma;
        await tx.salesSettings.upsert({
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
exports.PrismaSalesSettingsRepository = PrismaSalesSettingsRepository;
//# sourceMappingURL=PrismaSalesSettingsRepository.js.map