"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleSettingsDefinitionsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
class ModuleSettingsDefinitionsController {
    static async list(req, res, next) {
        try {
            const defs = await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.listDefinitions();
            res.json({ success: true, data: defs });
        }
        catch (err) {
            next(err);
        }
    }
    static async get(req, res, next) {
        try {
            const { moduleId } = req.params;
            const def = await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
            res.json({ success: true, data: def });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const body = req.body;
            await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.createDefinition(Object.assign(Object.assign({}, body), { updatedAt: new Date() }));
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const { moduleId } = req.params;
            const body = req.body;
            await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.updateDefinition(moduleId, Object.assign(Object.assign({}, body), { updatedAt: new Date() }));
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async remove(req, res, next) {
        try {
            const { moduleId } = req.params;
            await bindRepositories_1.diContainer.moduleSettingsDefinitionRepository.deleteDefinition(moduleId);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ModuleSettingsDefinitionsController = ModuleSettingsDefinitionsController;
//# sourceMappingURL=ModuleSettingsDefinitionsController.js.map