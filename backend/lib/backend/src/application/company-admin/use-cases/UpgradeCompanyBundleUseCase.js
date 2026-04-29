"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeCompanyBundleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class UpgradeCompanyBundleUseCase {
    constructor(companyRepository, bundleRepo, bundleItemRepo, entitlementRepo) {
        this.companyRepository = companyRepository;
        this.bundleRepo = bundleRepo;
        this.bundleItemRepo = bundleItemRepo;
        this.entitlementRepo = entitlementRepo;
    }
    async execute(input) {
        if (!input.companyId || !input.bundleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        const bundle = await this.bundleRepo.getById(input.bundleId);
        if (!bundle) {
            throw ApiError_1.ApiError.badRequest("Invalid bundle");
        }
        if (bundle.lifecycleStatus !== 'ready') {
            throw ApiError_1.ApiError.badRequest(`Bundle '${bundle.name}' is not available. Only ready bundles can be selected.`);
        }
        if (company.subscriptionPlan === input.bundleId) {
            return { bundleId: input.bundleId, status: 'already_active' };
        }
        const oldBundleId = company.subscriptionPlan;
        const existingEntitlements = await this.entitlementRepo.getActiveByCompanyId(input.companyId);
        const oldBundleEntitlement = existingEntitlements.find(e => e.sourceType === 'bundle' && e.sourceId === oldBundleId);
        const newBundleItemModules = await this.bundleItemRepo.getModuleKeysByBundleId(input.bundleId);
        const newBundleItemCapabilities = await this.bundleItemRepo.getCapabilityKeysByBundleId(input.bundleId);
        let newBundleEntitlement;
        if (oldBundleEntitlement) {
            const oldItems = oldBundleEntitlement.items || [];
            const oldModules = new Set(oldItems.filter((i) => i.itemType === 'module').map((i) => i.itemKey));
            const oldCapabilities = new Set(oldItems.filter((i) => i.itemType === 'capability').map((i) => i.itemKey));
            const currentModules = new Set(newBundleItemModules);
            const currentCapabilities = new Set(newBundleItemCapabilities);
            const modulesToAdd = newBundleItemModules.filter(m => !oldModules.has(m));
            const modulesToRemove = [...oldModules].filter(m => !currentModules.has(m));
            const capabilitiesToAdd = newBundleItemCapabilities.filter(c => !oldCapabilities.has(c));
            const capabilitiesToRemove = [...oldCapabilities].filter(c => !currentCapabilities.has(c));
            for (const moduleKey of modulesToRemove) {
                await this.entitlementRepo.removeItem(oldBundleEntitlement.id, moduleKey);
            }
            for (const capabilityKey of capabilitiesToRemove) {
                await this.entitlementRepo.removeItem(oldBundleEntitlement.id, capabilityKey);
            }
            await this.entitlementRepo.updateEntitlement(oldBundleEntitlement.id, { sourceId: input.bundleId, updatedAt: new Date() });
            for (const moduleKey of modulesToAdd) {
                await this.entitlementRepo.addItem(oldBundleEntitlement.id, {
                    id: `item_${input.companyId}_${moduleKey}`,
                    entitlementId: oldBundleEntitlement.id,
                    itemType: 'module',
                    itemKey: moduleKey,
                    createdAt: new Date(),
                });
            }
            for (const capabilityKey of capabilitiesToAdd) {
                await this.entitlementRepo.addItem(oldBundleEntitlement.id, {
                    id: `item_${input.companyId}_${capabilityKey}`,
                    entitlementId: oldBundleEntitlement.id,
                    itemType: 'capability',
                    itemKey: capabilityKey,
                    createdAt: new Date(),
                });
            }
            newBundleEntitlement = Object.assign(Object.assign({}, oldBundleEntitlement), { sourceId: input.bundleId });
        }
        else {
            newBundleEntitlement = {
                id: `ent_${input.companyId}_${input.bundleId}`,
                companyId: input.companyId,
                sourceType: 'bundle',
                sourceId: input.bundleId,
                validFrom: new Date(),
                isActive: true,
                items: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await this.entitlementRepo.createEntitlement(newBundleEntitlement);
            newBundleEntitlement = await this.entitlementRepo.getEntitlementById(newBundleEntitlement.id);
            for (const moduleKey of newBundleItemModules) {
                await this.entitlementRepo.addItem(newBundleEntitlement.id, {
                    id: `item_${input.companyId}_${moduleKey}`,
                    entitlementId: newBundleEntitlement.id,
                    itemType: 'module',
                    itemKey: moduleKey,
                    createdAt: new Date(),
                });
            }
            for (const capabilityKey of newBundleItemCapabilities) {
                await this.entitlementRepo.addItem(newBundleEntitlement.id, {
                    id: `item_${input.companyId}_${capabilityKey}`,
                    entitlementId: newBundleEntitlement.id,
                    itemType: 'capability',
                    itemKey: capabilityKey,
                    createdAt: new Date(),
                });
            }
        }
        if (!newBundleEntitlement) {
            throw new Error("Failed to create or retrieve bundle entitlement");
        }
        const finalModules = await this.entitlementRepo.getEffectiveModules(input.companyId);
        const finalCapabilities = await this.entitlementRepo.getEffectiveCapabilities(input.companyId);
        await this.companyRepository.update(input.companyId, {
            subscriptionPlan: input.bundleId,
            modules: finalModules
        });
        return {
            bundleId: input.bundleId,
            status: 'upgraded',
            modules: finalModules,
            capabilities: finalCapabilities
        };
    }
}
exports.UpgradeCompanyBundleUseCase = UpgradeCompanyBundleUseCase;
//# sourceMappingURL=UpgradeCompanyBundleUseCase.js.map