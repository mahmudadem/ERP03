"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleAvailabilityController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ModuleRegistry_1 = require("../../../application/platform/ModuleRegistry");
const CheckModuleImplementationUseCase_1 = require("../../../application/super-admin/use-cases/CheckModuleImplementationUseCase");
const ModuleAvailabilityService_1 = require("../../../application/platform/ModuleAvailabilityService");
class ModuleAvailabilityController {
    /**
     * POST /super-admin/modules/:id/check-implementation
     * Run implementation check for a module and refresh cache
     */
    static async checkImplementation(req, res, next) {
        try {
            const { id } = req.params;
            const useCase = new CheckModuleImplementationUseCase_1.CheckModuleImplementationUseCase(bindRepositories_1.diContainer.moduleRegistryRepository, ModuleRegistry_1.ModuleRegistry.getInstance());
            const result = await useCase.execute(id);
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            if (service.isInitialized()) {
                await service.rebuildAvailabilityMap();
            }
            res.json({
                success: true,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /super-admin/modules/availability
     * Get full availability report for SuperAdmin
     */
    static async getAvailabilityReport(req, res, next) {
        try {
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            await service.rebuildAvailabilityMap();
            const report = service.getSuperAdminView();
            res.json({
                success: true,
                data: report,
            });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /super-admin/modules/:id/availability
     * Get availability state for a specific module
     */
    static async getModuleAvailability(req, res, next) {
        try {
            const { id } = req.params;
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            await service.rebuildAvailabilityMap();
            const info = service.getAvailabilityInfo(id);
            if (!info) {
                return res.status(404).json({
                    success: false,
                    error: 'Module not found',
                });
            }
            res.json({
                success: true,
                data: info,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ModuleAvailabilityController = ModuleAvailabilityController;
//# sourceMappingURL=ModuleAvailabilityController.js.map