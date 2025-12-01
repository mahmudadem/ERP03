"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModuleSettingsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ModuleSettingsValidator_1 = require("../../../application/module-settings/ModuleSettingsValidator");
class CompanyModuleSettingsController {
    static async getSettings(req, res, next) {
        try {
            const { companyId, moduleId } = req.params;
            await bindRepositories_1.diContainer.companyModuleSettingsRepository.ensureModuleIsActivated(companyId, moduleId);
            const def = await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
            const stored = await bindRepositories_1.diContainer.companyModuleSettingsRepository.getSettings(companyId, moduleId);
            const result = {
                definition: def,
                settings: stored || {},
            };
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    static async saveSettings(req, res, next) {
        var _a;
        try {
            const { companyId, moduleId } = req.params;
            const userId = req.user.uid;
            const payload = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.settings) || {};
            await bindRepositories_1.diContainer.companyModuleSettingsRepository.ensureModuleIsActivated(companyId, moduleId);
            const def = await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
            if (!def)
                throw new Error('Settings definition not found');
            const validated = ModuleSettingsValidator_1.ModuleSettingsValidator.validate(def, payload);
            await bindRepositories_1.diContainer.companyModuleSettingsRepository.saveSettings(companyId, moduleId, validated, userId);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CompanyModuleSettingsController = CompanyModuleSettingsController;
//# sourceMappingURL=CompanyModuleSettingsController.js.map