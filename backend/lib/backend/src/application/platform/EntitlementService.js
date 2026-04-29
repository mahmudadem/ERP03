"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementService = void 0;
class EntitlementService {
    constructor(entitlementRepo) {
        this.entitlementRepo = entitlementRepo;
    }
    async companyHasModule(companyId, moduleId) {
        return this.entitlementRepo.hasModule(companyId, moduleId.toLowerCase());
    }
    async companyHasCapability(companyId, capabilityId) {
        return this.entitlementRepo.hasCapability(companyId, capabilityId.toLowerCase());
    }
    async getEntitledModules(companyId) {
        return this.entitlementRepo.getEffectiveModules(companyId);
    }
    async getEntitledCapabilities(companyId) {
        return this.entitlementRepo.getEffectiveCapabilities(companyId);
    }
    async grantModule(companyId, moduleId, sourceType, sourceId) {
        const entitlements = await this.entitlementRepo.getByCompanyId(companyId);
        const normalizedModuleId = moduleId.toLowerCase();
        if (entitlements.length > 0) {
            const activeEntitlement = entitlements.find(e => e.isActive);
            if (activeEntitlement) {
                await this.entitlementRepo.addItem(activeEntitlement.id, {
                    id: crypto.randomUUID(),
                    entitlementId: activeEntitlement.id,
                    itemType: 'module',
                    itemKey: normalizedModuleId,
                    createdAt: new Date(),
                });
                return;
            }
        }
        const entitlement = {
            id: crypto.randomUUID(),
            companyId,
            sourceType: sourceType,
            sourceId,
            validFrom: new Date(),
            isActive: true,
            items: [
                {
                    id: crypto.randomUUID(),
                    entitlementId: '',
                    itemType: 'module',
                    itemKey: normalizedModuleId,
                    createdAt: new Date(),
                },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const firstItem = Object.assign(Object.assign({}, entitlement.items[0]), { entitlementId: entitlement.id });
        entitlement.items = [firstItem];
        await this.entitlementRepo.createEntitlement(entitlement);
    }
    async revokeModule(companyId, moduleId) {
        const entitlements = await this.entitlementRepo.getActiveByCompanyId(companyId);
        const normalizedModuleId = moduleId.toLowerCase();
        for (const entitlement of entitlements) {
            const hasItem = entitlement.items.some((item) => item.itemType === 'module' && item.itemKey === normalizedModuleId);
            if (hasItem) {
                await this.entitlementRepo.removeItem(entitlement.id, normalizedModuleId);
            }
        }
    }
}
exports.EntitlementService = EntitlementService;
//# sourceMappingURL=EntitlementService.js.map